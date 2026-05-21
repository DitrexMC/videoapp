import type { Clock } from "../../../shared/domain/clock.js";
import type { LocalFileStorage } from "../../../shared/infrastructure/storage/LocalFileStorage.js";
import type { FileRepository } from "../../files/application/FileRepository.js";
import { NotFoundError } from "../../../shared/domain/errors.js";
import type { UploadRepository } from "../../uploads/application/UploadRepository.js";

export interface BackgroundWorkerDependencies {
  clock: Clock;
  fileRepository: FileRepository;
  maxConcurrentJobs: number;
  pollIntervalMilliseconds: number;
  storage: LocalFileStorage;
  uploadRepository: UploadRepository;
}

export class BackgroundWorker {
  private readonly maxConcurrentJobs: number;

  private readonly clock: Clock;
  private readonly fileRepository: FileRepository;
  private inFlightCount: number;
  private readonly pollIntervalMilliseconds: number;
  private readonly storage: LocalFileStorage;
  private readonly uploadRepository: UploadRepository;
  private intervalHandle: NodeJS.Timeout | null;
  private pendingRuns: Set<Promise<void>>;

  constructor(dependencies: BackgroundWorkerDependencies) {
    this.clock = dependencies.clock;
    this.fileRepository = dependencies.fileRepository;
    this.inFlightCount = 0;
    this.maxConcurrentJobs = dependencies.maxConcurrentJobs;
    this.pollIntervalMilliseconds = dependencies.pollIntervalMilliseconds;
    this.storage = dependencies.storage;
    this.uploadRepository = dependencies.uploadRepository;
    this.intervalHandle = null;
    this.pendingRuns = new Set();
  }

  start(): void {
    if (this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      this.tick();
    }, this.pollIntervalMilliseconds);
  }

  async stop(): Promise<void> {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;

    const pending = Array.from(this.pendingRuns);
    if (pending.length > 0) {
      await Promise.all(pending);
    }
  }

  async runOnce(): Promise<void> {
    await this.tick();

    const pending = Array.from(this.pendingRuns);
    if (pending.length > 0) {
      await Promise.all(pending);
    }
  }

  private tick(): void {
    this.uploadRepository.expireDueResources(this.clock.nowIsoString());

    for (;;) {
      if (this.inFlightCount >= this.maxConcurrentJobs) {
        break;
      }

      const now = this.clock.nowIsoString();
      const job = this.uploadRepository.findFinalizeJob(now);

      if (!job) {
        break;
      }

      this.uploadRepository.markFinalizeJobRunning(job.id, now);

      this.inFlightCount++;
      const promise = this.processJobWithTimeout(job).finally(() => {
        this.inFlightCount--;
        this.pendingRuns.delete(promise);
      });
      this.pendingRuns.add(promise);
    }
  }

  private async processJobWithTimeout(job: { id: string; subjectId: string; maxAttempts: number; attempts: number }): Promise<void> {
    const JOB_TIMEOUT_MS = 120_000;
    const cancelled = { value: false };

    try {
      await Promise.race<void>([
        this.processJob(job, cancelled),
        new Promise<void>((_, reject) =>
          setTimeout(() => {
            cancelled.value = true;
            reject(new Error("Job timed out after 120 seconds"));
          }, JOB_TIMEOUT_MS)
        ),
      ]);
    } catch (error) {
      cancelled.value = true;
      const message = error instanceof Error ? error.message : "unknown error";
      const nowIso = this.clock.nowIsoString();
      const retryAfter = new Date(Date.now() + 30_000).toISOString();

      this.uploadRepository.markFinalizeJobFailed(job.id, nowIso, message, retryAfter);

      if (job.attempts + 1 >= job.maxAttempts) {
        this.uploadRepository.markUploadFailed(job.subjectId, nowIso, message);
        await this.storage.removeUploadDirectory(job.subjectId);
      }
    }
  }

  private async processJob(job: { id: string; subjectId: string }, cancelled: { value: boolean }): Promise<void> {
    const upload = this.uploadRepository.findUploadById(job.subjectId);

    if (!upload) {
      throw new NotFoundError("アップロードが見つかりません。");
    }

    if (upload.status !== "processing") {
      this.uploadRepository.markFinalizeJobCompleted(job.id, this.clock.nowIsoString());
      await this.storage.removeUploadDirectory(upload.id);
      return;
    }

    const file = this.fileRepository.findFileById(upload.fileId);

    if (!file || file.isDeleted || file.status === "deleted") {
      this.uploadRepository.markFinalizeJobCompleted(job.id, this.clock.nowIsoString());
      await this.storage.removeUploadDirectory(upload.id);
      throw new NotFoundError("ファイルが見つかりません。");
    }

    const finalizedUpload = await this.storage.finalizeUpload(upload.id, upload.totalChunks);
    if (cancelled.value) return;

    const preview = await this.storage.generatePreview(file.id, file.mimeType, finalizedUpload.storagePath);
    if (cancelled.value) return;
    const updatedAt = this.clock.nowIsoString();

    this.uploadRepository.markUploadReadyFile(upload.id, {
      checksum: finalizedUpload.checksum,
      previewPath: preview.previewPath,
      previewStatus: preview.previewStatus,
      sizeBytes: finalizedUpload.sizeBytes,
      storagePath: finalizedUpload.storagePath,
      updatedAt
    });
    this.uploadRepository.markFinalizeJobCompleted(job.id, updatedAt);
    await this.storage.removeUploadDirectory(upload.id);
  }
}