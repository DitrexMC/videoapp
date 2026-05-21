import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";

import type { ServicePolicyRepository } from "../../../shared/application/ServicePolicyRepository.js";
import type { FileRepository } from "../../files/application/FileRepository.js";
import { resolveSafeName } from "../../files/domain/NameCollisionResolver.js";
import type { AuthApplicationService } from "../../identity/application/AuthApplicationService.js";
import type { Clock } from "../../../shared/domain/clock.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/domain/errors.js";
import { generateId } from "../../../shared/domain/id.js";
import type { LocalFileStorage } from "../../../shared/infrastructure/storage/LocalFileStorage.js";
import { assertChunkIndex } from "../domain/UploadSession.js";
import type { UploadRepository } from "./UploadRepository.js";

export interface UploadApplicationServiceDependencies {
  authService: AuthApplicationService;
  clock: Clock;
  fileRepository: FileRepository;
  policyRepository: ServicePolicyRepository;
  storage: LocalFileStorage;
  uploadRepository: UploadRepository;
}

interface FolderContextInput {
  folderId?: string;
  itemCount?: number;
  mode: "batch" | "existing" | "single";
}

export class UploadApplicationService {
  private readonly authService: AuthApplicationService;
  private readonly clock: Clock;
  private readonly fileRepository: FileRepository;
  private readonly policyRepository: ServicePolicyRepository;
  private readonly storage: LocalFileStorage;
  private readonly uploadRepository: UploadRepository;
  private readonly userChunkConcurrency: Map<string, number>;

  constructor(dependencies: UploadApplicationServiceDependencies) {
    this.authService = dependencies.authService;
    this.clock = dependencies.clock;
    this.fileRepository = dependencies.fileRepository;
    this.policyRepository = dependencies.policyRepository;
    this.storage = dependencies.storage;
    this.uploadRepository = dependencies.uploadRepository;
    this.userChunkConcurrency = new Map();
  }

  async directUpload(
    sessionToken: string,
    input: {
      expiresAt: string | null;
      groupId: string | null;
      isPublic: boolean;
      mimeType: string;
      name: string;
      size: number;
      tempPath: string;
    },
  ): Promise<{ fileId: string; url: string }> {
    const actor = this.authService.authenticate(sessionToken).user;
    const policies = this.policyRepository.findPolicies();
    const normalizedName = input.name.trim() || "upload";

    if (input.size <= 0) {
      throw new ValidationError("ファイルサイズが不正です。");
    }

    if (input.size > actor.maxFileSizeBytes) {
      throw new ValidationError("ユーザーの最大ファイルサイズを超えています。");
    }

    const currentStorageUsage = this.fileRepository.getStorageUsage(actor.id);
    if (currentStorageUsage + input.size > actor.storageLimitBytes) {
      throw new ValidationError("ユーザーのストレージ上限を超えています。");
    }

    const resolvedExpiresAt = resolveExpiresAt(
      this.clock.now(),
      input.expiresAt,
      policies.defaultFileExpiryDays,
      policies.maxFileExpiryDays,
    );

    if (input.groupId) {
      const existing = this.fileRepository.findGroupById(input.groupId);
      if (!existing) {
        this.fileRepository.createGroup({
          createdAt: this.clock.nowIsoString(),
          expiresAt: resolvedExpiresAt,
          id: input.groupId,
          isPrivate: !input.isPublic,
          label: "",
          ownerUserId: actor.id,
          updatedAt: this.clock.nowIsoString(),
        });
      }
    }

    const existingNames = this.fileRepository.listSafeNames(actor.id, null);
    const safeName = resolveSafeName(normalizedName, existingNames);
    const timestamp = this.clock.nowIsoString();
    const fileId = generateId();

    const finalized = await this.storage.storeDirectFile(input.tempPath);
    const preview = await this.storage.generatePreview(
      fileId,
      input.mimeType,
      finalized.storagePath,
    );

    this.fileRepository.createFile({
      checksum: finalized.checksum,
      createdAt: timestamp,
      expiresAt: resolvedExpiresAt,
      folderId: null,
      groupId: input.groupId,
      id: fileId,
      mimeType: input.mimeType,
      name: normalizedName,
      ownerUserId: actor.id,
      previewPath: preview.previewPath,
      previewStatus: preview.previewStatus,
      public: input.isPublic,
      safeName,
      sizeBytes: finalized.sizeBytes,
      storagePath: finalized.storagePath,
      updatedAt: timestamp,
    });

    return { fileId, url: `/file.html?id=${fileId}` };
  }

  initDirectUpload(
    sessionToken: string,
    input: {
      expiresAt: string | null;
      groupId: string | null;
      isPublic: boolean;
      mimeType: string;
      name: string;
      size: number;
    },
  ): { fileId: string; uploadId: string; url: string } {
    const actor = this.authService.authenticate(sessionToken).user;
    const policies = this.policyRepository.findPolicies();
    const normalizedName = input.name.trim() || "upload";

    if (input.size <= 0) {
      throw new ValidationError("ファイルサイズが不正です。");
    }

    if (input.size > actor.maxFileSizeBytes) {
      throw new ValidationError("ユーザーの最大ファイルサイズを超えています。");
    }

    const currentStorageUsage = this.fileRepository.getStorageUsage(actor.id);
    if (currentStorageUsage + input.size > actor.storageLimitBytes) {
      throw new ValidationError("ユーザーのストレージ上限を超えています。");
    }

    const resolvedExpiresAt = resolveExpiresAt(
      this.clock.now(),
      input.expiresAt,
      policies.defaultFileExpiryDays,
      policies.maxFileExpiryDays,
    );

    if (input.groupId) {
      const existing = this.fileRepository.findGroupById(input.groupId);
      if (!existing) {
        this.fileRepository.createGroup({
          createdAt: this.clock.nowIsoString(),
          expiresAt: resolvedExpiresAt,
          id: input.groupId,
          isPrivate: !input.isPublic,
          label: "",
          ownerUserId: actor.id,
          updatedAt: this.clock.nowIsoString(),
        });
      }
    }

    const existingNames = this.fileRepository.listSafeNames(actor.id, null);
    const safeName = resolveSafeName(normalizedName, existingNames);
    const timestamp = this.clock.nowIsoString();
    const fileId = generateId();
    const uploadId = generateId();

    this.uploadRepository.createPendingUpload({
      chunkSizeBytes: input.size,
      createdAt: timestamp,
      expiresAt: resolvedExpiresAt,
      fileId,
      fileName: normalizedName,
      folderId: null,
      groupId: input.groupId,
      id: uploadId,
      mimeType: input.mimeType,
      ownerUserId: actor.id,
      safeName,
      sizeBytes: input.size,
      totalChunks: 1,
      updatedAt: timestamp,
      visibility: input.isPublic,
    });

    return {
      fileId,
      uploadId,
      url: `/file.html?id=${fileId}`,
    };
  }

  async completeDirectUpload(
    sessionToken: string,
    input: {
      tempPath: string;
      uploadId: string;
    },
  ): Promise<{ fileId: string; status: "ready"; url: string }> {
    const actor = this.authService.authenticate(sessionToken).user;
    const upload = this.uploadRepository.findUploadById(input.uploadId);

    if (!upload || upload.ownerUserId !== actor.id) {
      throw new NotFoundError("アップロードが見つかりません。");
    }

    const file = this.fileRepository.findFileById(upload.fileId);

    if (!file || file.isDeleted || file.status === "deleted") {
      throw new ConflictError(
        "削除済みファイルのアップロードは完了できません。",
      );
    }

    if (upload.status !== "uploading") {
      throw new ConflictError("このアップロードは完了できない状態です。", {
        status: upload.status,
      });
    }

    const tempFile = await this.storage.stat(input.tempPath);

    if (tempFile.size !== upload.totalSizeBytes) {
      throw new ValidationError("アップロード済みサイズが一致しません。");
    }

    const processingAt = this.clock.nowIsoString();
    this.uploadRepository.markUploadProcessing(upload.id, processingAt);

    try {
      const finalized = await this.storage.storeDirectFile(input.tempPath);
      const preview = await this.storage.generatePreview(
        file.id,
        file.mimeType,
        finalized.storagePath,
      );
      const updatedAt = this.clock.nowIsoString();

      this.uploadRepository.markUploadReadyFile(upload.id, {
        checksum: finalized.checksum,
        previewPath: preview.previewPath,
        previewStatus: preview.previewStatus,
        sizeBytes: finalized.sizeBytes,
        storagePath: finalized.storagePath,
        updatedAt,
      });

      return {
        fileId: file.id,
        status: "ready",
        url: `/file.html?id=${file.id}`,
      };
    } catch (error) {
      const updatedAt = this.clock.nowIsoString();
      const message =
        error instanceof Error ? error.message : "アップロードに失敗しました。";
      this.uploadRepository.markUploadFailed(upload.id, updatedAt, message);
      throw error;
    } finally {
      await rm(input.tempPath, { force: true }).catch(() => {});
    }
  }

  async completeUpload(
    sessionToken: string,
    input: {
      fileId: string;
      totalChunks: number;
      totalSize: number;
      uploadId: string;
    },
  ) {
    const actor = this.authService.authenticate(sessionToken).user;
    const upload = this.uploadRepository.findUploadById(input.uploadId);
    const file = this.fileRepository.findFileById(input.fileId);

    if (
      !upload ||
      upload.ownerUserId !== actor.id ||
      upload.fileId !== input.fileId
    ) {
      throw new NotFoundError("アップロードが見つかりません。");
    }

    if (!file || file.isDeleted || file.status === "deleted") {
      throw new ConflictError(
        "削除済みファイルのアップロードは完了できません。",
      );
    }

    if (upload.status === "processing" || upload.status === "ready") {
      return {
        fileId: upload.fileId,
        missingChunks: [],
        status: upload.status,
      };
    }

    if (upload.status !== "uploading") {
      throw new ConflictError("このアップロードは完了できない状態です。", {
        status: upload.status,
      });
    }

    if (
      upload.totalChunks !== input.totalChunks ||
      upload.totalSizeBytes !== input.totalSize
    ) {
      throw new ValidationError("アップロードの総量情報が一致しません。");
    }

    const receivedChunks = this.uploadRepository.findUploadReceivedIndices(
      upload.id,
    );
    const missingChunks: number[] = [];

    for (let index = 0; index < upload.totalChunks; index += 1) {
      if (!receivedChunks.includes(index)) {
        missingChunks.push(index);
      }
    }

    const uploadedByteCount = this.uploadRepository.findUploadedByteCount(
      upload.id,
    );

    if (uploadedByteCount !== upload.totalSizeBytes) {
      throw new ConflictError("アップロード済みサイズが一致しません。", {
        expectedSize: upload.totalSizeBytes,
        uploadedByteCount,
      });
    }

    if (missingChunks.length > 0) {
      throw new ConflictError("未送信のchunkがあります。", { missingChunks });
    }

    const timestamp = this.clock.nowIsoString();
    const jobId = generateId();

    this.uploadRepository.markUploadProcessingAndQueueJob(
      jobId,
      upload.id,
      timestamp,
    );

    return {
      fileId: upload.fileId,
      missingChunks: [],
      status: "processing",
    };
  }

  getStatus(sessionToken: string, uploadId: string) {
    const actor = this.authService.authenticate(sessionToken).user;
    const upload = this.uploadRepository.findUploadById(uploadId);

    if (!upload || upload.ownerUserId !== actor.id) {
      throw new NotFoundError("アップロードが見つかりません。");
    }

    const receivedChunks =
      this.uploadRepository.findUploadReceivedIndices(uploadId);
    const latestJobState = this.uploadRepository.findLatestJobState(uploadId);
    const uploadProgress = Math.round(
      (receivedChunks.length / upload.totalChunks) * 100,
    );
    const processingProgress =
      upload.status === "ready"
        ? 100
        : latestJobState?.status === "failed"
          ? 100
          : upload.status === "processing"
            ? 50
            : 0;

    return {
      chunkSize: upload.chunkSizeBytes,
      fileId: upload.fileId,
      processingError:
        latestJobState?.status === "failed" ? latestJobState.lastError : null,
      processingProgress,
      processingState: latestJobState?.status ?? null,
      receivedChunks,
      status: upload.status,
      totalChunks: upload.totalChunks,
      uploadId: upload.id,
      uploadProgress,
    };
  }

  initUpload(
    sessionToken: string,
    input: {
      chunkSize?: number;
      expiresAt?: string | null;
      folderContext?: FolderContextInput;
      mime_type: string;
      name: string;
      public: boolean;
      size: number;
    },
  ) {
    const actor = this.authService.authenticate(sessionToken).user;
    const policies = this.policyRepository.findPolicies();
    const normalizedName = input.name.trim();

    if (normalizedName.length === 0) {
      throw new ValidationError("name は必須です。");
    }

    if (!Number.isInteger(input.size) || input.size <= 0) {
      throw new ValidationError("size は正の整数である必要があります。");
    }

    if (input.size > actor.maxFileSizeBytes) {
      throw new ValidationError("ユーザーの最大ファイルサイズを超えています。");
    }

    const currentStorageUsage = this.fileRepository.getStorageUsage(actor.id);

    if (currentStorageUsage + input.size > actor.storageLimitBytes) {
      throw new ValidationError("ユーザーのストレージ上限を超えています。");
    }

    const chunkSize = input.chunkSize ?? policies.defaultChunkSizeBytes;

    if (
      chunkSize < policies.minChunkSizeBytes ||
      chunkSize > policies.maxChunkSizeBytes
    ) {
      throw new ValidationError("chunkSize は許可された範囲外です。");
    }

    const resolvedExpiresAt = resolveExpiresAt(
      this.clock.now(),
      input.expiresAt ?? null,
      policies.defaultFileExpiryDays,
      policies.maxFileExpiryDays,
    );

    const folderId = this.resolveFolder(actor.id, input.folderContext);
    const existingNames = this.fileRepository.listSafeNames(actor.id, folderId);
    const safeName = resolveSafeName(normalizedName, existingNames);
    const timestamp = this.clock.nowIsoString();
    const fileId = generateId();
    const uploadId = generateId();
    const totalChunks = Math.ceil(input.size / chunkSize);

    this.uploadRepository.createPendingUpload({
      chunkSizeBytes: chunkSize,
      createdAt: timestamp,
      expiresAt: resolvedExpiresAt,
      fileId,
      fileName: normalizedName,
      folderId,
      groupId: null,
      id: uploadId,
      mimeType: input.mime_type,
      ownerUserId: actor.id,
      safeName,
      sizeBytes: input.size,
      totalChunks,
      updatedAt: timestamp,
      visibility: input.public,
    });

    return {
      chunkSize,
      fileId,
      folderId,
      maxChunks: totalChunks,
      status: "uploading",
      uploadId,
      url: `/file/${fileId}`,
    };
  }

  async storeChunk(
    sessionToken: string,
    uploadId: string,
    index: number,
    headers: {
      chunkSize?: number;
      fileId?: string;
      totalChunks?: number;
      totalSize?: number;
    },
    body: Buffer,
  ) {
    const actor = this.authService.authenticate(sessionToken).user;
    const policies = this.policyRepository.findPolicies();
    const upload = this.uploadRepository.findUploadById(uploadId);

    if (!upload || upload.ownerUserId !== actor.id) {
      throw new NotFoundError("アップロードが見つかりません。");
    }

    if (upload.status !== "uploading") {
      throw new ConflictError("このアップロードはchunk受付中ではありません。");
    }

    // Per-user chunk concurrency rate limiting
    const current = this.userChunkConcurrency.get(actor.id) ?? 0;
    if (current >= policies.maxChunkConcurrencyPerUser) {
      throw new ConflictError(
        "同時処理チャンク数が上限を超えています。しばらく待ってから再送してください。",
      );
    }
    this.userChunkConcurrency.set(actor.id, current + 1);

    try {
      assertChunkIndex(index, upload.totalChunks);

      if (headers.fileId && headers.fileId !== upload.fileId) {
        throw new ValidationError("X-File-Id が一致しません。");
      }

      if (headers.chunkSize && headers.chunkSize !== upload.chunkSizeBytes) {
        throw new ValidationError("X-Chunk-Size が一致しません。");
      }

      if (headers.totalChunks && headers.totalChunks !== upload.totalChunks) {
        throw new ValidationError("X-Total-Chunks が一致しません。");
      }

      if (headers.totalSize && headers.totalSize !== upload.totalSizeBytes) {
        throw new ValidationError("X-Total-Size が一致しません。");
      }

      const isFinalChunk = index === upload.totalChunks - 1;
      const finalChunkExpectedSize =
        upload.totalSizeBytes -
        upload.chunkSizeBytes * (upload.totalChunks - 1);

      if (!isFinalChunk && body.length !== upload.chunkSizeBytes) {
        throw new ValidationError(
          "最終chunk以外は固定chunkSizeである必要があります。",
        );
      }

      if (isFinalChunk && body.length !== finalChunkExpectedSize) {
        throw new ValidationError("最終chunkのサイズが不正です。");
      }

      const checksum = createHash("sha256").update(body).digest("hex");

      await this.storage.writeUploadPart(upload.id, index, body);
      this.uploadRepository.storeUploadPart(
        upload.id,
        index,
        body.length,
        checksum,
        this.clock.nowIsoString(),
      );

      return {
        index,
        received: true,
        storedSize: body.length,
      };
    } finally {
      const count = this.userChunkConcurrency.get(actor.id) ?? 0;
      if (count <= 1) {
        this.userChunkConcurrency.delete(actor.id);
      } else {
        this.userChunkConcurrency.set(actor.id, count - 1);
      }
    }
  }

  async cancelUpload(sessionToken: string, uploadId: string): Promise<void> {
    const actor = this.authService.authenticate(sessionToken).user;
    const upload = this.uploadRepository.findUploadById(uploadId);

    if (!upload || upload.ownerUserId !== actor.id) {
      throw new NotFoundError("アップロードが見つかりません。");
    }

    if (upload.status === "processing" || upload.status === "ready") {
      throw new ConflictError(
        "このアップロードはすでに処理中または完了済みです。",
      );
    }

    this.uploadRepository.markUploadCancelled(
      uploadId,
      this.clock.nowIsoString(),
    );
    await this.storage.removeUploadDirectory(uploadId);
  }

  private resolveFolder(
    ownerUserId: string,
    folderContext?: FolderContextInput,
  ): string | null {
    if (!folderContext || folderContext.mode === "single") {
      return null;
    }

    if (folderContext.mode === "existing") {
      if (!folderContext.folderId) {
        throw new ValidationError("existing モードでは folderId が必要です。");
      }

      const folder = this.uploadRepository.findUserFolder(
        folderContext.folderId,
        ownerUserId,
      );

      if (!folder || folder.deletedAt) {
        throw new NotFoundError("フォルダが見つかりません。");
      }

      return folder.id;
    }

    if (folderContext.mode === "batch" && folderContext.folderId) {
      const folder = this.uploadRepository.findUserFolder(
        folderContext.folderId,
        ownerUserId,
      );

      if (!folder || folder.deletedAt) {
        throw new NotFoundError("フォルダが見つかりません。");
      }

      return folder.id;
    }

    const timestamp = this.clock.nowIsoString();
    const folder = {
      createdAt: timestamp,
      deletedAt: null,
      id: generateId(),
      name: `フォルダ (${folderContext.itemCount ?? 0}件)`,
      ownerUserId: ownerUserId,
      public: true,
      updatedAt: timestamp,
    };

    this.uploadRepository.createSystemFolder(folder);

    return folder.id;
  }
}

function resolveExpiresAt(
  now: Date,
  requestedExpiresAt: string | null,
  defaultFileExpiryDays: number | null,
  maxFileExpiryDays: number | null,
): string | null {
  if (requestedExpiresAt) {
    const parsedExpiresAt = new Date(requestedExpiresAt);

    if (
      Number.isNaN(parsedExpiresAt.getTime()) ||
      parsedExpiresAt.getTime() <= now.getTime()
    ) {
      throw new ValidationError("expiresAt は未来日時である必要があります。");
    }

    if (maxFileExpiryDays !== null) {
      const maximumAllowedExpiresAt = new Date(
        now.getTime() + maxFileExpiryDays * 24 * 60 * 60 * 1000,
      );

      if (parsedExpiresAt.getTime() > maximumAllowedExpiresAt.getTime()) {
        throw new ValidationError(
          "expiresAt が許可された最大期限を超えています。",
        );
      }
    }

    return parsedExpiresAt.toISOString();
  }

  if (defaultFileExpiryDays === null) {
    return null;
  }

  return new Date(
    now.getTime() + defaultFileExpiryDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}
