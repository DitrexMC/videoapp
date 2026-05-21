import { ValidationError } from "../../../shared/domain/errors.js";

export type UploadStatus = "cancelled" | "expired" | "processing" | "ready" | "uploading";

export interface UploadSession {
  chunkSizeBytes: number;
  completedAt: string | null;
  createdAt: string;
  fileId: string;
  id: string;
  ownerUserId: string;
  status: UploadStatus;
  totalChunks: number;
  totalSizeBytes: number;
  updatedAt: string;
}

export function assertChunkIndex(index: number, totalChunks: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= totalChunks) {
    throw new ValidationError("chunk index が不正です。");
  }
}