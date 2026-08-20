import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
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

  /** Attach an uploaded video file to a match (local storage for now). */
  async setVideo(id: string, videoPath: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.match.update({
      where: { id },
      data: { videoPath, status: 'UPLOADED' },
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
