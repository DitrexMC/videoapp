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
    this.uploadRepository.expireDueResources(this.clock.nowIsoString());

    const job = this.uploadRepository.findFinalizeJob();

    if (!job) {
      return;
    }

    const timestamp = this.clock.nowIsoString();

    this.uploadRepository.markFinalizeJobRunning(job.id, timestamp);

    try {
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
      const preview = await this.storage.generatePreview(file.id, file.mimeType, finalizedUpload.storagePath);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.uploadRepository.markFinalizeJobFailed(job.id, this.clock.nowIsoString(), message);

      if (job.attempts + 1 >= job.maxAttempts) {
        await this.storage.removeUploadDirectory(job.subjectId);
      }
    }
  }
}