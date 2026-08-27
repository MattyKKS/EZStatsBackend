import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';

// Filenames differ between the curated demo folder and a raw worker run, so we
// probe candidates in priority order (merged/cleaned first, raw as fallback).
const REPORT_FILES = ['match_report_merged.json', 'match_report.json'];
const VIDEO_FILES: Record<'stats' | 'spatial', string[]> = {
  stats: ['stats_video.mp4', 'processed_video.mp4'],
  spatial: ['spatial_video.mp4', 'radar_video.mp4'],
};

const FFMPEG = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH?.trim() || 'ffprobe';

/** Video codec of a file's first video stream (e.g. "h264"), or null if unknown. */
function probeVideoCodec(input: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(
      FFPROBE,
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
        'stream=codec_name', '-of', 'default=nw=1:nk=1', input],
      { windowsHide: true },
    );
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('error', () => resolve(null)); // ffprobe missing
    proc.on('close', () => resolve(out.trim() || null));
  });
}

/** Transcode to browser-playable H.264/AAC mp4 (faststart), capped at 1280 wide. */
function transcodeToH264(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      FFMPEG,
      ['-y', '-i', input,
        '-vf', "scale='min(1280,iw)':-2",
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', output],
      { windowsHide: true },
    );
    let err = '';
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('error', reject); // ffmpeg missing
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`)),
    );
  });
}

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  // A team must exist AND belong to the current user, else 404 (no leak).
  private async assertTeamOwned(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.ownerId !== userId) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }
  }

  async create(teamId: string, dto: CreateMatchDto, userId: string) {
    await this.assertTeamOwned(teamId, userId);
    return this.prisma.match.create({
      data: {
        teamId,
        opponent: dto.opponent,
        teamColor: dto.teamColor,
        opponentColor: dto.opponentColor,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async findAllForTeam(teamId: string, userId: string) {
    await this.assertTeamOwned(teamId, userId);
    return this.prisma.match.findMany({
      where: { teamId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!match || match.team.ownerId !== userId) {
      throw new NotFoundException(`Match ${id} not found`);
    }
    return match;
  }

  async update(id: string, dto: UpdateMatchDto, userId: string) {
    await this.findOne(id, userId);
    const { date, ...rest } = dto;
    return this.prisma.match.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.match.delete({ where: { id } });
  }

  private readonly logger = new Logger(MatchesService.name);

  /**
   * Attach an uploaded video to a match. Transcodes to browser-playable H.264
   * when the source codec isn't (e.g. MPEG-4 Part 2, HEVC); if the source is
   * already H.264 it's served as-is. If ffmpeg is unavailable the raw file is
   * kept so the upload is never lost.
   */
  async ingestVideo(id: string, rawFilename: string, userId: string) {
    await this.findOne(id, userId);
    const dir = join(process.cwd(), 'uploads', 'videos');
    const rawPath = join(dir, rawFilename);

    const codec = await probeVideoCodec(rawPath);
    if (codec === 'h264') {
      return this.saveVideoPath(id, `/uploads/videos/${rawFilename}`);
    }

    const outName = `${rawFilename.replace(/\.[^.]+$/, '')}-h264.mp4`;
    const outPath = join(dir, outName);
    try {
      await transcodeToH264(rawPath, outPath);
      try {
        if (existsSync(rawPath)) unlinkSync(rawPath);
      } catch {
        /* leaving the raw file behind is harmless */
      }
      return this.saveVideoPath(id, `/uploads/videos/${outName}`);
    } catch (e) {
      // ffmpeg missing or failed — keep the raw upload (may not play in-browser).
      this.logger.warn(
        `Transcode failed for match ${id} (${String(e)}); serving raw upload.`,
      );
      return this.saveVideoPath(id, `/uploads/videos/${rawFilename}`);
    }
  }

  private saveVideoPath(id: string, videoPath: string) {
    return this.prisma.match.update({
      where: { id },
      data: { videoPath, status: 'UPLOADED' },
    });
  }

  // --- Player ID mapping (Feature #6): worker track_id → real roster Player ---

  /** Existing track→player assignments for a match. */
  async getTrackMaps(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.playerTrackMap.findMany({
      where: { matchId: id },
      orderBy: { trackId: 'asc' },
    });
  }

  /**
   * Replace the match's track→player assignments. Only players belonging to the
   * match's team are accepted; one player per track (last assignment wins).
   */
  async setTrackMaps(
    id: string,
    maps: { trackId: number; playerId: string }[],
    userId: string,
  ) {
    const match = await this.findOne(id, userId);
    const players = await this.prisma.player.findMany({
      where: { teamId: match.teamId },
      select: { id: true },
    });
    const valid = new Set(players.map((p) => p.id));

    const byTrack = new Map<number, string>();
    for (const m of maps ?? []) {
      if (
        Number.isInteger(m?.trackId) &&
        typeof m?.playerId === 'string' &&
        valid.has(m.playerId)
      ) {
        byTrack.set(m.trackId, m.playerId);
      }
    }
    const data = [...byTrack].map(([trackId, playerId]) => ({
      matchId: id,
      trackId,
      playerId,
    }));

    await this.prisma.$transaction([
      this.prisma.playerTrackMap.deleteMany({ where: { matchId: id } }),
      this.prisma.playerTrackMap.createMany({ data }),
    ]);

    return this.prisma.playerTrackMap.findMany({
      where: { matchId: id },
      orderBy: { trackId: 'asc' },
    });
  }

  // --- AI worker output serving (Features #3/#4) ---
  //
  // A match's analysis lives on disk under WORKER_OUTPUTS_DIR/<runId> (the same
  // folder the AI worker writes to). Until a real run is linked, we fall back to
  // WORKER_DEMO_DIR so the dashboard has data to show. These endpoints are public
  // (the browser loads them directly via <img>/<video>), so they resolve by match
  // id only and never assert ownership.

  /** Look up a match without owner scoping (for the public media endpoints). */
  private async getMatchOrThrow(id: string) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Match ${id} not found`);
    return match;
  }

  /** Resolve the on-disk run directory for a match, or null if none exists. */
  private resolveRunDir(runId: string | null): string | null {
    const base = process.env.WORKER_OUTPUTS_DIR?.trim();
    if (base && runId) {
      const dir = join(base, runId);
      if (existsSync(dir)) return dir;
    }
    const demo = process.env.WORKER_DEMO_DIR?.trim();
    if (demo && existsSync(demo)) return demo;
    return null;
  }

  /** Run directory for a match id, throwing 404 when nothing is available. */
  private async runDirFor(id: string): Promise<string> {
    const match = await this.getMatchOrThrow(id);
    const dir = this.resolveRunDir(match.runId);
    if (!dir) throw new NotFoundException(`No analysis output for match ${id}`);
    return dir;
  }

  /** First of `names` that exists in `dir`, else null. */
  private firstExisting(dir: string, names: string[]): string | null {
    for (const name of names) {
      const file = join(dir, name);
      if (existsSync(file)) return file;
    }
    return null;
  }

  /** Parsed match_report_merged.json (the frontend's MatchReport contract). */
  async getReport(id: string): Promise<unknown> {
    const dir = await this.runDirFor(id);
    const file = this.firstExisting(dir, REPORT_FILES);
    if (!file) throw new NotFoundException(`No report file for match ${id}`);
    return JSON.parse(await readFile(file, 'utf8'));
  }

  /** Absolute path to a match's overlay video, throwing 404 when absent. */
  async videoFile(id: string, kind: 'stats' | 'spatial'): Promise<string> {
    const dir = await this.runDirFor(id);
    const file = this.firstExisting(dir, VIDEO_FILES[kind]);
    if (!file) throw new NotFoundException(`No ${kind} video for match ${id}`);
    return file;
  }

  /**
   * Absolute path to a player-crop image referenced by the report's crop_path
   * (e.g. "player_crops/track_0001/frame_000000.jpg"). Guarded against path
   * traversal so a crafted path can't escape the run directory.
   */
  async cropFile(id: string, cropPath: string): Promise<string> {
    const root = resolve(await this.runDirFor(id));
    const target = resolve(root, cropPath);
    if (target !== root && !target.startsWith(root + sep)) {
      throw new NotFoundException('Invalid crop path');
    }
    if (!existsSync(target)) throw new NotFoundException('Crop not found');
    return target;
  }
}
