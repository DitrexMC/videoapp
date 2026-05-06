import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { parseFile } from "music-metadata";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import {
  AuthenticationError,
  ValidationError,
} from "../../../shared/domain/errors.js";

const setVisibilitySchema = z.object({
  public: z.boolean(),
});

const setShowUploaderSchema = z.object({
  showUploader: z.boolean(),
});

const zipRequestSchema = z.object({
  file_ids: z.array(z.string().uuid()).min(1),
});

export async function registerFileRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  const serializeFileListItem = (
    file: ReturnType<AppRuntime["fileService"]["listFiles"]>[number],
  ) => ({
    created_at: file.createdAt,
    expires_at: file.expiresAt,
    folder_id: file.folderId,
    group_id: file.groupId,
    id: file.id,
    mime_type: file.mimeType,
    name: file.name,
    owner_user_id: file.ownerUserId,
    preview_status: file.previewStatus,
    public: file.public,
    safe_name: file.safeName,
    show_uploader: file.showUploader,
    size: file.sizeBytes,
    status: file.status,
    updated_at: file.updatedAt,
  });

  const serializeFolderListItem = (
    folder: ReturnType<AppRuntime["fileService"]["listFolders"]>[number],
  ) => ({
    created_at: folder.createdAt,
    deleted_at: folder.deletedAt,
    id: folder.id,
    name: folder.name,
    owner_user_id: folder.ownerUserId,
    public: folder.public,
    updated_at: folder.updatedAt,
  });

  const sendFileDetail = (sessionToken: string | null, fileId: string) => {
    const file = runtime.fileService.getFileDetail(sessionToken, fileId);

    return {
      created_at: file.createdAt,
      expires_at: file.expiresAt,
      folder_id: file.folderId,
      id: file.id,
      mime_type: file.mimeType,
      name: file.name,
      owner_user_id: file.ownerUserId,
      preview_status: file.previewStatus,
      public: file.public,
      safe_name: file.safeName,
      show_uploader: file.showUploader,
      size: file.sizeBytes,
      status: file.status,
      updated_at: file.updatedAt,
    };
  };

  app.get("/files", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const query = z
      .object({
        cursor: z.string().optional(),
        folderId: z.string().uuid().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        status: z
          .enum(["uploading", "processing", "ready", "expired", "deleted"])
          .optional(),
      })
      .parse(request.query);
    const fileListQuery: {
      cursor?: string;
      folderId?: string;
      limit?: number;
      status?: "uploading" | "processing" | "ready" | "expired" | "deleted";
    } = {};

    if (query.cursor !== undefined) {
      fileListQuery.cursor = query.cursor;
    }

    if (query.folderId !== undefined) {
      fileListQuery.folderId = query.folderId;
    }

    if (query.limit !== undefined) {
      fileListQuery.limit = query.limit;
    }

    if (query.status !== undefined) {
      fileListQuery.status = query.status;
    }

    return {
      items: runtime.fileService
        .listFiles(sessionToken, fileListQuery)
        .map(serializeFileListItem),
    };
  });

  app.get("/files/:fileId", async (request) => {
    const sessionToken = getOptionalBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);

    return sendFileDetail(sessionToken, params.fileId);
  });

  app.get("/file/:fileId", async (request) => {
    const sessionToken = getOptionalBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);

    return sendFileDetail(sessionToken, params.fileId);
  });

  app.patch("/files/:fileId/rename", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);
    const body = z.object({ name: z.string().min(1) }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("ファイル名が不正です。", body.error.flatten());
    }

    runtime.fileService.renameFile(sessionToken, params.fileId, body.data.name);

    return reply.status(204).send();
  });

  app.patch("/files/:fileId/expire", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);
    const body = z
      .object({ expiresAt: z.string().datetime().nullable() })
      .safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("expiresAt が不正です。", body.error.flatten());
    }

    runtime.fileService.setFileExpiration(
      sessionToken,
      params.fileId,
      body.data.expiresAt,
    );

    return reply.status(204).send();
  });

  app.patch("/files/:fileId/public", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);
    const body = setVisibilitySchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError(
        "公開設定の入力が不正です。",
        body.error.flatten(),
      );
    }

    runtime.fileService.setFileVisibility(
      sessionToken,
      params.fileId,
      body.data.public,
    );

    return reply.status(204).send();
  });

  app.patch("/files/:fileId/show-uploader", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);
    const body = setShowUploaderSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError(
        "投稿者表示設定の入力が不正です。",
        body.error.flatten(),
      );
    }

    runtime.fileService.setFileShowUploader(
      sessionToken,
      params.fileId,
      body.data.showUploader,
    );

    return reply.status(204).send();
  });

  app.delete("/files/:fileId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);

    runtime.fileService.removeFile(sessionToken, params.fileId);

    return reply.status(204).send();
  });

  app.get("/files/:fileId/download", async (request, reply) => {
    const sessionToken = getOptionalBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);
    const { file, stream } = await runtime.fileService.getDownload(
      sessionToken,
      params.fileId,
    );

    reply.header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.safeName)}`,
    );
    reply.header("Content-Type", file.mimeType);

    return reply.send(stream);
  });

  app.get("/files/:fileId/stream", async (request, reply) => {
    const sessionToken = getOptionalBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);
    const file = await runtime.fileService.getStream(
      sessionToken,
      params.fileId,
    );

    if (!file.storagePath) {
      throw new ValidationError("ファイル本体が見つかりません。");
    }

    const rangeHeader =
      typeof request.headers.range === "string"
        ? request.headers.range
        : undefined;

    if (!rangeHeader) {
      reply.header("Content-Type", file.mimeType);
      return reply.send(createReadStream(file.storagePath));
    }

    const size = (await stat(file.storagePath)).size;
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

    if (!match) {
      throw new ValidationError("Range ヘッダが不正です。");
    }

    const rawStart = match[1] ?? "";
    const rawEnd = match[2] ?? "";
    const hasStart = rawStart.length > 0;
    const hasEnd = rawEnd.length > 0;

    if (!hasStart && !hasEnd) {
      throw new ValidationError("Range ヘッダが不正です。");
    }

    const parsedStart = hasStart ? Number.parseInt(rawStart, 10) : null;
    const parsedEnd = hasEnd ? Number.parseInt(rawEnd, 10) : null;
    const start = hasStart ? parsedStart : Math.max(size - (parsedEnd ?? 0), 0);
    const end = hasStart ? (parsedEnd ?? size - 1) : size - 1;

    if (
      start === null ||
      start < 0 ||
      end === null ||
      end >= size ||
      start > end
    ) {
      throw new ValidationError("Range ヘッダが不正です。");
    }

    reply.code(206);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Length", String(end - start + 1));
    reply.header("Content-Range", `bytes ${start}-${end}/${size}`);
    reply.header("Content-Type", file.mimeType);

    return reply.send(createReadStream(file.storagePath, { end, start }));
  });

  app.get("/files/:fileId/preview", async (request, reply) => {
    const sessionToken = getOptionalBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);
    const { file, stream } = await runtime.fileService.getPreview(
      sessionToken,
      params.fileId,
    );

    reply.header(
      "Content-Type",
      file.previewPath?.endsWith(".jpg") ? "image/jpeg" : file.mimeType,
    );

    return reply.send(stream);
  });

  app.get("/files/:fileId/meta", async (request, reply) => {
    const sessionToken = getOptionalBearerToken(request.headers.authorization);
    const params = z
      .object({ fileId: z.string().uuid() })
      .parse(request.params);

    let file;
    try {
      file = runtime.fileService.getFileDetail(sessionToken, params.fileId);
    } catch {
      return reply.send({});
    }

    if (!file || !file.mimeType.startsWith("audio/")) {
      return reply.send({});
    }

    if (!file.storagePath || !existsSync(file.storagePath)) {
      return reply.send({});
    }

    try {
      const metadata = await parseFile(file.storagePath, {
        skipCovers: false,
        duration: false,
      });
      const c = metadata.common;
      const result: Record<string, unknown> = {
        title: c.title || null,
        artist: c.artist || (c.artists ? c.artists.join(", ") : null),
        album: c.album || null,
        year: c.year || null,
        genre: c.genre ? c.genre.join(", ") : null,
        track:
          c.track && c.track.no
            ? String(c.track.no) + (c.track.of ? "/" + c.track.of : "")
            : null,
      };
      if (c.picture && c.picture.length > 0) {
        const pic = c.picture[0];
        if (pic) {
          result.coverArt =
            "data:" +
            pic.format +
            ";base64," +
            Buffer.from(pic.data).toString("base64");
        }
      }
      return reply.send(result);
    } catch {
      return reply.send({});
    }
  });

  app.post("/files/zip", async (request, reply) => {
    const sessionToken = getOptionalBearerToken(request.headers.authorization);
    const body = zipRequestSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError(
        "file_ids の入力が不正です。",
        body.error.flatten(),
      );
    }

    const result = await runtime.fileService.createZipArchive(
      sessionToken,
      body.data.file_ids,
    );

    reply.header("Content-Disposition", "attachment; filename=files.zip");
    reply.header("Content-Type", "application/zip");
    reply.header("X-Included-Count", String(result.included));
    reply.header("X-Excluded-Count", String(result.excluded));

    return reply.send(result.archive);
  });

  app.get("/folders/:folderId/files", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ folderId: z.string().uuid() })
      .parse(request.params);

    return {
      items: runtime.fileService
        .listFiles(sessionToken, {
          folderId: params.folderId,
        })
        .map(serializeFileListItem),
    };
  });

  app.get("/folders", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);

    return {
      items: runtime.fileService
        .listFolders(sessionToken)
        .map(serializeFolderListItem),
    };
  });

  app.post("/folders", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = z
      .object({ name: z.string().min(1), public: z.boolean().optional() })
      .safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("フォルダ名が不正です。", body.error.flatten());
    }

    return runtime.fileService.createFolder(
      sessionToken,
      body.data.name,
      body.data.public ?? true,
    );
  });

  app.patch("/folders/:folderId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ folderId: z.string().uuid() })
      .parse(request.params);
    const body = z.object({ name: z.string().min(1) }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("フォルダ名が不正です。", body.error.flatten());
    }

    runtime.fileService.renameFolder(
      sessionToken,
      params.folderId,
      body.data.name,
    );

    return reply.status(204).send();
  });

  app.patch("/folders/:folderId/visibility", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ folderId: z.string().uuid() })
      .parse(request.params);
    const body = z.object({ public: z.boolean() }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("公開設定が不正です。", body.error.flatten());
    }

    runtime.fileService.setFolderVisibility(
      sessionToken,
      params.folderId,
      body.data.public,
    );

    return reply.status(204).send();
  });

  app.delete("/folders/:folderId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ folderId: z.string().uuid() })
      .parse(request.params);

    runtime.fileService.removeFolder(sessionToken, params.folderId);

    return reply.status(204).send();
  });

  app.get("/groups", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);

    return {
      items: runtime.fileService.listGroups(sessionToken).map((g) => ({
        created_at: g.createdAt,
        expires_at: g.expiresAt,
        file_count: g.fileCount,
        id: g.id,
        is_private: g.isPrivate,
        label: g.label,
        total_size: g.totalSize,
        updated_at: g.updatedAt,
      })),
    };
  });

  app.patch("/groups/:groupId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ groupId: z.string().uuid() })
      .parse(request.params);
    const body = z
      .object({
        label: z.string().min(1).optional(),
        is_private: z.boolean().optional(),
      })
      .safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("入力が不正です。", body.error.flatten());
    }

    if (body.data.label !== undefined) {
      runtime.fileService.renameGroup(
        sessionToken,
        params.groupId,
        body.data.label,
      );
    }

    if (body.data.is_private !== undefined) {
      runtime.fileService.updateGroupPrivacy(
        sessionToken,
        params.groupId,
        body.data.is_private,
      );
    }

    return reply.status(204).send();
  });

  app.delete("/groups/:groupId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ groupId: z.string().uuid() })
      .parse(request.params);

    runtime.fileService.removeGroup(sessionToken, params.groupId);

    return reply.status(204).send();
  });
}

function getRequiredBearerToken(
  authorizationHeader: string | string[] | undefined,
): string {
  const token = getOptionalBearerToken(authorizationHeader, true);

  if (!token) {
    throw new AuthenticationError();
  }

  return token;
}

function getOptionalBearerToken(
  authorizationHeader: string | string[] | undefined,
  required = false,
): string | null {
  if (authorizationHeader === undefined) {
    if (required) {
      throw new AuthenticationError();
    }

    return null;
  }

  if (typeof authorizationHeader !== "string") {
    throw new AuthenticationError();
  }

  const normalizedHeader = authorizationHeader.trim();

  if (normalizedHeader.length === 0) {
    if (required) {
      throw new AuthenticationError();
    }

    return null;
  }

  const [scheme, token] = normalizedHeader.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AuthenticationError();
  }

  return token;
}
