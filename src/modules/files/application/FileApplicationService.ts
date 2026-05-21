import archiver from "archiver";
import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";

import type { ServicePolicyRepository } from "../../../shared/application/ServicePolicyRepository.js";
import type { AuthApplicationService } from "../../identity/application/AuthApplicationService.js";
import type { User } from "../../identity/domain/User.js";
import type { Clock } from "../../../shared/domain/clock.js";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/domain/errors.js";
import type { LocalFileStorage } from "../../../shared/infrastructure/storage/LocalFileStorage.js";
import {
  assertCanManageFile,
  assertCanReadFile,
  assertFileIsDownloadable,
  type FileRecord,
} from "../domain/FileRecord.js";
import { resolveSafeName } from "../domain/NameCollisionResolver.js";
import type { CreateFolderInput, FileRepository } from "./FileRepository.js";

export interface FileApplicationServiceDependencies {
  authService: AuthApplicationService;
  clock: Clock;
  fileRepository: FileRepository;
  policyRepository: ServicePolicyRepository;
  storage: LocalFileStorage;
}

export interface FileArchiveResult {
  archive: archiver.Archiver;
  excluded: number;
  included: number;
}

export class FileApplicationService {
  private readonly authService: AuthApplicationService;
  private readonly clock: Clock;
  private readonly fileRepository: FileRepository;
  private readonly policyRepository: ServicePolicyRepository;
  private readonly storage: LocalFileStorage;

  constructor(dependencies: FileApplicationServiceDependencies) {
    this.authService = dependencies.authService;
    this.clock = dependencies.clock;
    this.fileRepository = dependencies.fileRepository;
    this.policyRepository = dependencies.policyRepository;
    this.storage = dependencies.storage;
  }

  async createZipArchive(
    sessionToken: string | null,
    fileIds: string[],
  ): Promise<FileArchiveResult> {
    const policies = this.policyRepository.findPolicies();

    if (fileIds.length === 0) {
      throw new ValidationError("file_ids は1件以上必要です。");
    }

    if (fileIds.length > policies.maxZipFileCount) {
      throw new ValidationError(
        "ZIPに含められるファイル数の上限を超えています。",
      );
    }

    this.authenticateOptional(sessionToken);
    const files = this.fileRepository.findFilesByIds(fileIds);
    const includedFiles: FileRecord[] = [];
    let excluded = 0;
    let totalSize = 0;
    const reservedNames: string[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    for (const file of files) {
      try {
        if (!file.public) {
          excluded += 1;
          continue;
        }

        assertFileIsDownloadable(file);

        totalSize += file.sizeBytes;

        if (totalSize > policies.maxZipTotalBytes) {
          throw new ValidationError("ZIP合計サイズの上限を超えています。");
        }

        if (!file.storagePath) {
          throw new NotFoundError("ファイル本体が見つかりません。");
        }

        const zipEntryName = resolveSafeName(file.safeName, reservedNames);
        reservedNames.push(zipEntryName);
        archive.append(createReadStream(file.storagePath), {
          name: zipEntryName,
        });
        includedFiles.push(file);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }

        excluded += 1;
      }
    }

    if (includedFiles.length === 0) {
      throw new ValidationError("ZIP対象のファイルがありません。");
    }

    void archive.finalize();

    return {
      archive,
      excluded,
      included: includedFiles.length,
    };
  }

  createFolder(
    sessionToken: string,
    name: string,
    isPublic: boolean = true,
  ): CreateFolderInput {
    const actor = this.authService.authenticate(sessionToken).user;
    const normalizedName = name.trim();

    if (normalizedName.length === 0) {
      throw new ValidationError("フォルダ名は必須です。");
    }

    const timestamp = this.clock.nowIsoString();

    return this.fileRepository.createFolder({
      createdAt: timestamp,
      id: crypto.randomUUID(),
      name: normalizedName,
      ownerUserId: actor.id,
      public: isPublic,
      updatedAt: timestamp,
    });
  }

  async getDownload(
    sessionToken: string | null,
    fileId: string,
  ): Promise<{ file: FileRecord; stream: Readable }> {
    const actor = this.authenticateOptional(sessionToken);
    const file = this.getReadableFile(fileId, actor);

    if (!file.storagePath) {
      throw new NotFoundError("ファイル本体が見つかりません。");
    }

    await this.storage.ensureReadable(file.storagePath);

    return {
      file,
      stream: createReadStream(file.storagePath),
    };
  }

  async getPreview(
    sessionToken: string | null,
    fileId: string,
  ): Promise<{ file: FileRecord; stream: Readable }> {
    const actor = this.authenticateOptional(sessionToken);
    const file = this.getReadableFile(fileId, actor);

    if (file.previewStatus !== "ready" || !file.previewPath) {
      throw new NotFoundError("プレビューがありません。");
    }

    await this.storage.ensureReadable(file.previewPath);

    return {
      file,
      stream: createReadStream(file.previewPath),
    };
  }

  async getStream(
    sessionToken: string | null,
    fileId: string,
  ): Promise<FileRecord> {
    const actor = this.authenticateOptional(sessionToken);

    return this.getReadableFile(fileId, actor);
  }

  getFileDetail(sessionToken: string | null, fileId: string): FileRecord {
    const actor = this.authenticateOptional(sessionToken);
    const file = this.fileRepository.findFileById(fileId);

    if (!file || file.isDeleted) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    assertCanReadFile(file, actor);

    return file;
  }

  listFiles(
    sessionToken: string,
    filters: {
      cursor?: string;
      folderId?: string;
      groupId?: string;
      limit?: number;
      status?: FileRecord["status"];
    },
  ): FileRecord[] {
    const actor = this.authService.authenticate(sessionToken).user;
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const fileListFilters: Parameters<FileRepository["listFiles"]>[0] = {
      limit,
      ownerUserId: actor.id,
    };

    if (filters.cursor) {
      fileListFilters.cursor = filters.cursor;
    }

    if (filters.folderId) {
      fileListFilters.folderId = filters.folderId;
    }

    if (filters.groupId) {
      fileListFilters.groupId = filters.groupId;
    }

    if (filters.status) {
      fileListFilters.status = filters.status;
    }

    return this.fileRepository.listFiles(fileListFilters);
  }

  listFolders(sessionToken: string) {
    const actor = this.authService.authenticate(sessionToken).user;

    return this.fileRepository.listFolders(actor.id);
  }

  listGroups(sessionToken: string) {
    const actor = this.authService.authenticate(sessionToken).user;

    return this.fileRepository.listGroups(actor.id);
  }

  renameGroup(sessionToken: string, groupId: string, label: string): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const group = this.fileRepository.findGroupById(groupId);

    if (!group) {
      throw new NotFoundError("グループが見つかりません。");
    }

    if (group.ownerUserId !== actor.id) {
      throw new NotFoundError("グループが見つかりません。");
    }

    const normalizedLabel = label.trim();
    if (normalizedLabel.length === 0) {
      throw new ValidationError("グループ名は必須です。");
    }

    this.fileRepository.renameGroup(
      groupId,
      normalizedLabel,
      this.clock.nowIsoString(),
    );
  }

  updateGroupPrivacy(
    sessionToken: string,
    groupId: string,
    isPrivate: boolean,
  ): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const group = this.fileRepository.findGroupById(groupId);

    if (!group) {
      throw new NotFoundError("グループが見つかりません。");
    }

    if (group.ownerUserId !== actor.id) {
      throw new NotFoundError("グループが見つかりません。");
    }

    this.fileRepository.updateGroupPrivacy(
      groupId,
      isPrivate,
      this.clock.nowIsoString(),
    );
  }

  removeGroup(sessionToken: string, groupId: string): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const group = this.fileRepository.findGroupById(groupId);

    if (!group) {
      throw new NotFoundError("グループが見つかりません。");
    }

    if (group.ownerUserId !== actor.id) {
      throw new NotFoundError("グループが見つかりません。");
    }

    this.fileRepository.deleteGroup(groupId, this.clock.nowIsoString());
  }

  renameFolder(sessionToken: string, folderId: string, name: string): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const folder = this.fileRepository.findFolderById(folderId);
    const normalizedName = name.trim();

    if (!folder || folder.deletedAt) {
      throw new NotFoundError("フォルダが見つかりません。");
    }

    if (normalizedName.length === 0) {
      throw new ValidationError("フォルダ名は必須です。");
    }

    if (folder.ownerUserId !== actor.id) {
      throw new NotFoundError("フォルダが見つかりません。");
    }

    this.fileRepository.renameFolder(
      folderId,
      normalizedName,
      this.clock.nowIsoString(),
    );
  }

  renameFile(sessionToken: string, fileId: string, name: string): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const file = this.fileRepository.findFileById(fileId);
    const normalizedName = name.trim();

    if (!file || file.isDeleted) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    if (normalizedName.length === 0) {
      throw new ValidationError("ファイル名は必須です。");
    }

    assertCanManageFile(file, actor);

    const ext = file.safeName.includes(".")
      ? "." + file.safeName.split(".").pop()
      : "";
    const safeBase = normalizedName
      .replace(/[^a-zA-Z0-9._\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "");
    const alreadyHasExt =
      ext.length > 0 && safeBase.toLowerCase().endsWith(ext.toLowerCase());
    const safeName = ext && !alreadyHasExt ? safeBase + ext : safeBase;

    this.fileRepository.renameFile(
      file.id,
      normalizedName,
      safeName,
      this.clock.nowIsoString(),
    );
  }

  async removeFile(sessionToken: string, fileId: string): Promise<void> {
    const actor = this.authService.authenticate(sessionToken).user;
    const file = this.fileRepository.findFileById(fileId);

    if (!file || file.isDeleted) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    assertCanManageFile(file, actor);
    this.fileRepository.softDeleteFile(file.id, this.clock.nowIsoString());

    if (file.storagePath) {
      const remainingRefs =
        this.fileRepository.countNonDeletedFilesByStoragePath(file.storagePath);
      if (remainingRefs === 0) {
        await this.storage.removeFile(file.storagePath);
      }
    }
    if (file.previewPath) {
      await this.storage.removeFile(file.previewPath);
    }
  }

  removeFolder(sessionToken: string, folderId: string): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const folder = this.fileRepository.findFolderById(folderId);

    if (!folder || folder.deletedAt) {
      throw new NotFoundError("フォルダが見つかりません。");
    }

    if (folder.ownerUserId !== actor.id) {
      throw new NotFoundError("フォルダが見つかりません。");
    }

    this.fileRepository.deleteFolder(folderId, this.clock.nowIsoString());
  }

  setFileExpiration(
    sessionToken: string,
    fileId: string,
    expiresAt: string | null,
  ): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const file = this.fileRepository.findFileById(fileId);

    if (!file || file.isDeleted) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    assertCanManageFile(file, actor);
    this.fileRepository.setFileExpiration(
      file.id,
      expiresAt,
      this.clock.nowIsoString(),
    );
  }

  setFileVisibility(
    sessionToken: string,
    fileId: string,
    isPublic: boolean,
  ): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const file = this.fileRepository.findFileById(fileId);

    if (!file || file.isDeleted) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    assertCanManageFile(file, actor);
    this.fileRepository.updateFileVisibility(
      file.id,
      isPublic,
      this.clock.nowIsoString(),
    );
  }

  setFileShowUploader(
    sessionToken: string,
    fileId: string,
    showUploader: boolean,
  ): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const file = this.fileRepository.findFileById(fileId);

    if (!file || file.isDeleted) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    assertCanManageFile(file, actor);
    this.fileRepository.updateFileShowUploader(
      file.id,
      showUploader,
      this.clock.nowIsoString(),
    );
  }

  setFolderVisibility(
    sessionToken: string,
    folderId: string,
    isPublic: boolean,
  ): void {
    const actor = this.authService.authenticate(sessionToken).user;
    const folder = this.fileRepository.findFolderById(folderId);

    if (!folder || folder.deletedAt) {
      throw new NotFoundError("フォルダが見つかりません。");
    }

    if (folder.ownerUserId !== actor.id) {
      throw new NotFoundError("フォルダが見つかりません。");
    }

    this.fileRepository.updateFolderVisibility(
      folder.id,
      isPublic,
      this.clock.nowIsoString(),
    );
  }

  private authenticateOptional(sessionToken: string | null): User | null {
    if (!sessionToken) {
      return null;
    }

    try {
      return this.authService.authenticate(sessionToken).user;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof AuthorizationError
      ) {
        return null;
      }

      throw error;
    }
  }

  private getReadableFile(fileId: string, actor: User | null): FileRecord {
    const file = this.fileRepository.findFileById(fileId);

    if (!file || file.isDeleted) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    assertCanReadFile(file, actor);
    assertFileIsDownloadable(file);

    return file;
  }
}
