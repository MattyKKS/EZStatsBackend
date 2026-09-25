import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Runs the EZ Stats AI worker on an uploaded match video.
 *
 * The worker is a separate Python repository with heavy ML dependencies
 * (torch, ultralytics). It is invoked as a child process rather than imported,
 * so nothing about it leaks into this service's dependency tree — the same
 * boundary the data contract in docs/BACKEND_INTEGRATION.md describes.
 *
 * DISABLED BY DEFAULT. `AI_WORKER_AUTORUN` must be set to "true" to arm it.
 * A full run takes from several minutes to a few hours depending on clip length
 * and whether a GPU is present, which is far longer than a live demo can wait,
 * so the presentation path uses pre-computed runs instead. The invocation below
 * is real and exercised by `runNow()`; the flag only decides whether an upload
 * triggers it automatically.
 */
@Injectable()
export class AiWorkerService {
  private readonly logger = new Logger(AiWorkerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Whether an upload should automatically start processing. */
  get autorunEnabled(): boolean {
    return process.env.AI_WORKER_AUTORUN === 'true';
  }

  private get workerDir(): string {
    return (
      process.env.AI_WORKER_DIR ??
      resolve(process.cwd(), '..', 'Desktop', 'EZ Stats AI Worker')
    );
  }

  private get pythonBin(): string {
    return process.env.AI_WORKER_PYTHON ?? 'python';
  }

  /**
   * Called after a video upload. Starts the worker only when armed, so the
   * default path leaves the match at UPLOADED for an operator to process.
   */
  async onVideoUploaded(matchId: string, videoPath: string): Promise<void> {
    if (!this.autorunEnabled) {
      this.logger.log(
        `Autorun disabled (AI_WORKER_AUTORUN is not "true"); match ${matchId} ` +
          `left at UPLOADED. Set the flag, or POST /matches/${matchId}/process.`,
      );
      return;
    }
    await this.runNow(matchId, videoPath);
  }

  /**
   * Start the worker for a match. Returns as soon as the process is spawned;
   * the match status is updated when it finishes. A video can be hours long, so
   * this deliberately does not block the HTTP request.
   */
  async runNow(matchId: string, videoPath: string): Promise<void> {
    const cwd = this.workerDir;
    if (!existsSync(cwd)) {
      this.logger.error(`AI worker directory not found: ${cwd}`);
      await this.setStatus(matchId, 'FAILED');
      return;
    }

    // videoPath is stored as a public URL such as /uploads/videos/x.mp4
    const absVideo = isAbsolute(videoPath)
      ? videoPath
      : join(process.cwd(), videoPath.replace(/^\//, ''));
    if (!existsSync(absVideo)) {
      this.logger.error(`Uploaded video not found on disk: ${absVideo}`);
      await this.setStatus(matchId, 'FAILED');
      return;
    }

    await this.setStatus(matchId, 'QUEUED');

    const args = ['run_pipeline_v2.py', '--video', absVideo];
    this.logger.log(`Starting AI worker: ${this.pythonBin} ${args.join(' ')} (cwd=${cwd})`);

    const child = spawn(this.pythonBin, args, { cwd, windowsHide: true });
    void this.setStatus(matchId, 'PROCESSING');

    let runDir: string | null = null;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        // The runner prints "Run dir: outputs/<run_id>" once the folder exists.
        const m = /^Run dir:\s*(.+)$/.exec(line.trim());
        if (m) runDir = m[1].trim();
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c: string) => this.logger.warn(`[worker] ${c.trim()}`));

    child.on('error', (err) => {
      this.logger.error(`Failed to start AI worker: ${err.message}`);
      void this.setStatus(matchId, 'FAILED');
    });

    child.on('close', (code) => {
      if (code === 0 && runDir) {
        const reportPath = join(runDir, 'match_report_merged.json');
        this.logger.log(`AI worker finished for match ${matchId}: ${reportPath}`);
        void this.prisma.match.update({
          where: { id: matchId },
          data: { status: 'COMPLETED', reportPath },
        });
      } else {
        this.logger.error(
          `AI worker exited with code ${code} for match ${matchId}` +
            (runDir ? '' : ' (no run directory was reported)'),
        );
        void this.setStatus(matchId, 'FAILED');
      }
    });
  }

  private setStatus(
    id: string,
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
  ) {
    return this.prisma.match
      .update({ where: { id }, data: { status } })
      .catch((e: unknown) =>
        this.logger.warn(`Could not set status ${status} on ${id}: ${String(e)}`),
      );
  }

  /** Reported by the health/status endpoint so the UI can explain itself. */
  describe() {
    return {
      autorunEnabled: this.autorunEnabled,
      workerDir: this.workerDir,
      workerDirExists: existsSync(this.workerDir),
      entrypoint: 'run_pipeline_v2.py',
      note: this.autorunEnabled
        ? 'Uploads start the AI worker automatically.'
        : 'Autorun is disabled: a full run takes minutes to hours, which a live ' +
          'demo cannot wait for. Uploads stop at UPLOADED; processing is started ' +
          'explicitly via POST /matches/:id/process.',
    };
  }
}
