import { AuthenticationError, AuthorizationError, NotFoundError } from "../../../shared/domain/errors.js";
import { isAdmin, type User } from "../../identity/domain/User.js";

export type FileStatus = "deleted" | "expired" | "processing" | "ready" | "uploading";
export type PreviewStatus = "failed" | "none" | "ready";

export interface FileRecord {
  checksum: string | null;
  createdAt: string;
  expiresAt: string | null;
  folderId: string | null;
  groupId: string | null;
  id: string;
  isDeleted: boolean;
  mimeType: string;
  name: string;
  ownerUserId: string;
  previewPath: string | null;
  previewStatus: PreviewStatus;
  public: boolean;
  safeName: string;
  sizeBytes: number;
  status: FileStatus;
  storagePath: string | null;
  updatedAt: string;
  uploadId: string | null;
}

export interface FolderRecord {
  createdAt: string;
  deletedAt: string | null;
  id: string;
  name: string;
  ownerUserId: string;
  public: boolean;
  updatedAt: string;
}

export interface GroupRecord {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  isPrivate: boolean;
  label: string;
  ownerUserId: string;
  updatedAt: string;
  fileCount?: number | undefined;
  totalSize?: number | undefined;
}

export function assertCanManageFile(file: FileRecord, actor: User): void {
  if (actor.id === file.ownerUserId || isAdmin(actor)) {
    return;
  }

  throw new NotFoundError("ファイルが見つかりません。");
}

export function assertCanReadFile(file: FileRecord, actor: User | null): void {
  if (file.public) {
    return;
  }

  if (!actor) {
    throw new AuthenticationError();
  }

  if (actor.id === file.ownerUserId || isAdmin(actor)) {
    return;
  }

  throw new NotFoundError("ファイルが見つかりません。");
}

export function assertFileIsDownloadable(file: FileRecord): void {
  if (file.isDeleted || file.status === "deleted") {
    throw new NotFoundError("ファイルが見つかりません。");
  }

  if (file.status !== "ready") {
    throw new AuthorizationError("このファイルはまだ利用できません。", {
      status: file.status
    });
  }

  if (file.expiresAt && new Date(file.expiresAt).getTime() <= Date.now()) {
    throw new AuthorizationError("このファイルは期限切れです。");
  }
}