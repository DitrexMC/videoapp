import type { FolderRecord } from "../../files/domain/FileRecord.js";
import type { UploadSession } from "../domain/UploadSession.js";

export interface CreatePendingUploadInput {
  chunkSizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
  fileId: string;
  fileName: string;
  folderId: string | null;
  groupId: string | null;
  id: string;
  mimeType: string;
  ownerUserId: string;
  safeName: string;
  sizeBytes: number;
  totalChunks: number;
  updatedAt: string;
  visibility: boolean;
}

export interface FinalizeJob {
  attempts: number;
  id: string;
  maxAttempts: number;
  payload: string;
  subjectId: string;
  type: "finalize_upload";
}

export interface UploadJobState {
  attempts: number;
  lastError: string | null;
  maxAttempts: number;
  status: "completed" | "failed" | "pending" | "running";
}

export interface UploadRepository {
  createPendingUpload(input: CreatePendingUploadInput): void;
  createSystemFolder(folder: FolderRecord): void;
  expireDueResources(nowIso: string): void;
  findFinalizeJob(nowIso: string): FinalizeJob | null;
  findLatestJobState(uploadId: string): UploadJobState | null;
  findUploadById(uploadId: string): UploadSession | null;
  findUploadedByteCount(uploadId: string): number;
  findUploadReceivedIndices(uploadId: string): number[];
  findUploadSafeNames(ownerUserId: string, folderId: string | null): string[];
  findUserFolder(folderId: string, ownerUserId: string): FolderRecord | null;
  markFinalizeJobCompleted(jobId: string, updatedAt: string): void;
  markFinalizeJobFailed(
    jobId: string,
    updatedAt: string,
    errorMessage: string,
    retryAfter: string,
  ): void;
  markFinalizeJobRunning(jobId: string, updatedAt: string): void;
  markUploadCancelled(uploadId: string, updatedAt: string): void;
  markUploadFailed(
    uploadId: string,
    updatedAt: string,
    errorMessage: string,
  ): void;
  markUploadProcessing(uploadId: string, updatedAt: string): void;
  markUploadReady(uploadId: string, updatedAt: string): void;
  markUploadReadyFile(
    uploadId: string,
    data: {
      checksum: string;
      previewPath: string | null;
      previewStatus: "failed" | "none" | "ready";
      sizeBytes: number;
      storagePath: string;
      updatedAt: string;
    },
  ): void;
  markUploadProcessingAndQueueJob(
    jobId: string,
    uploadId: string,
    createdAt: string,
  ): void;
  storeUploadPart(
    uploadId: string,
    index: number,
    sizeBytes: number,
    checksum: string,
    createdAt: string,
  ): void;
}
