import type { Clock } from "../../../shared/domain/clock.js";
import type { LocalFileStorage } from "../../../shared/infrastructure/storage/LocalFileStorage.js";
import type { FileRepository } from "../../files/application/FileRepository.js";
import { NotFoundError } from "../../../shared/domain/errors.js";
import type { UploadRepository } from "../../uploads/application/UploadRepository.js";

export interface BackgroundWorkerDependencies {
  clock: Clock;
  fileRepository: FileRepository;
  pollIntervalMilliseconds: number;
  storage: LocalFileStorage;
  uploadRepository: UploadRepository;
}

export class BackgroundWorker {
  private readonly clock: Clock;
  private readonly fileRepository: FileRepository;
  private inFlightRun: Promise<void> | null;
  private readonly pollIntervalMilliseconds: number;
  private readonly storage: LocalFileStorage;
  private readonly uploadRepository: UploadRepository;
  private intervalHandle: NodeJS.Timeout | null;

  constructor(dependencies: BackgroundWorkerDependencies) {
    this.clock = dependencies.clock;
    this.fileRepository = dependencies.fileRepository;
    this.inFlightRun = null;
    this.pollIntervalMilliseconds = dependencies.pollIntervalMilliseconds;
    this.storage = dependencies.storage;
    this.uploadRepository = dependencies.uploadRepository;
    this.intervalHandle = null;
  }

  start(): void {
    if (this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      if (!this.inFlightRun) {
        this.inFlightRun = this.runInternal().finally(() => {
          this.inFlightRun = null;
        });
      }
    }, this.pollIntervalMilliseconds);
  }

  async stop(): Promise<void> {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;

    if (this.inFlightRun) {
      await this.inFlightRun;
    }
  }

  async runOnce(): Promise<void> {
    if (!this.inFlightRun) {
      this.inFlightRun = this.runInternal().finally(() => {
        this.inFlightRun = null;
      });
    }

    await this.inFlightRun;
  }

  private async runInternal(): Promise<void> {
    const now = this.clock.nowIsoString();
    this.uploadRepository.expireDueResources(now);

    const job = this.uploadRepository.findFinalizeJob(now);

    if (!job) {
      return;
    }

    const timestamp = this.clock.nowIsoString();

    this.uploadRepository.markFinalizeJobRunning(job.id, timestamp);

    try {
      await this.processJobWithTimeout(job);
    } catch (error) {
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
    } catch (err) {
      cancelled.value = true;
      throw err;
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