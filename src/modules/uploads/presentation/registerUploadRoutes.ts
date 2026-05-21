import { stat } from "node:fs/promises";
import { join } from "node:path";

import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import {
  AuthenticationError,
  ValidationError,
} from "../../../shared/domain/errors.js";

const MAX_FILE_SIZE_FALLBACK = 5 * 1024 * 1024 * 1024;

export async function registerUploadRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  const maxFileSize =
    runtime.config.DEFAULT_MAX_FILE_SIZE_BYTES ?? MAX_FILE_SIZE_FALLBACK;
  const tempDir = join(
    runtime.config.TEMP_UPLOAD_ROOT ?? `${runtime.config.DATA_DIR}/uploads`,
    "direct",
  );

  await app.register(multipart, {
    limits: {
      fileSize: maxFileSize,
      files: 1,
    },
  });

  app.post("/upload/init", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = z
      .object({
        chunkSize: z.number().int().positive().optional(),
        expiresAt: z.string().datetime().nullable().optional(),
        folderContext: z
          .object({
            folderId: z.string().uuid().optional(),
            itemCount: z.number().int().positive().optional(),
            mode: z.enum(["batch", "existing", "single"]),
          })
          .optional(),
        mime_type: z.string().min(1),
        name: z.string().min(1),
        public: z.boolean(),
        size: z.number().int().positive(),
      })
      .parse(request.body);

    const input: {
      chunkSize?: number;
      expiresAt?: string | null;
      folderContext?: {
        folderId?: string;
        itemCount?: number;
        mode: "batch" | "existing" | "single";
      };
      mime_type: string;
      name: string;
      public: boolean;
      size: number;
    } = {
      mime_type: body.mime_type,
      name: body.name,
      public: body.public,
      size: body.size,
    };

    if (body.chunkSize !== undefined) {
      input.chunkSize = body.chunkSize;
    }

    if (body.expiresAt !== undefined) {
      input.expiresAt = body.expiresAt;
    }

    if (body.folderContext !== undefined) {
      input.folderContext = {
        mode: body.folderContext.mode,
      };

      if (body.folderContext.folderId !== undefined) {
        input.folderContext.folderId = body.folderContext.folderId;
      }

      if (body.folderContext.itemCount !== undefined) {
        input.folderContext.itemCount = body.folderContext.itemCount;
      }
    }

    return reply.send(runtime.uploadService.initUpload(sessionToken, input));
  });

  app.post("/upload/direct/init", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = z
      .object({
        expiresAt: z.string().datetime().nullable().optional(),
        groupId: z.string().uuid().nullable().optional(),
        mime_type: z.string().min(1),
        name: z.string().min(1),
        public: z.boolean(),
        size: z.number().int().positive(),
      })
      .parse(request.body);

    return reply.send(
      runtime.uploadService.initDirectUpload(sessionToken, {
        expiresAt: body.expiresAt ?? null,
        groupId: body.groupId ?? null,
        isPublic: body.public,
        mimeType: body.mime_type,
        name: body.name,
        size: body.size,
      }),
    );
  });

  app.post("/upload/direct/:uploadId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ uploadId: z.string().uuid() })
      .parse(request.params);

    const saved = await request.saveRequestFiles({
      limits: { fileSize: maxFileSize },
      tmpdir: tempDir,
    });

    if (saved.files.length === 0) {
      throw new ValidationError("ファイルが添付されていません。");
    }

    const sf = saved.files[0]!;
    const fileStats = await stat(sf.filepath);
    const result = await runtime.uploadService.completeDirectUpload(
      sessionToken,
      {
        tempPath: sf.filepath,
        uploadId: params.uploadId,
      },
    );

    request.log.info(
      { action: "Upload" },
      `${sf.filename || "upload"} (${formatSize(fileStats.size)}, direct-session)`,
    );

    return reply.send(result);
  });

  app.put("/upload/:uploadId/:index", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({
        index: z.coerce.number().int().min(0),
        uploadId: z.string().uuid(),
      })
      .parse(request.params);
    const headers = z
      .object({
        "x-chunk-size": z.coerce.number().int().positive().optional(),
        "x-file-id": z.string().uuid().optional(),
        "x-total-chunks": z.coerce.number().int().positive().optional(),
        "x-total-size": z.coerce.number().int().positive().optional(),
      })
      .parse(request.headers);

    const body = Buffer.isBuffer(request.body)
      ? request.body
      : request.body instanceof Uint8Array
        ? Buffer.from(request.body)
        : null;

    if (!body) {
      throw new ValidationError("chunk ボディが不正です。");
    }

    const chunkHeaders: {
      chunkSize?: number;
      fileId?: string;
      totalChunks?: number;
      totalSize?: number;
    } = {};

    if (headers["x-chunk-size"] !== undefined) {
      chunkHeaders.chunkSize = headers["x-chunk-size"];
    }

    if (headers["x-file-id"] !== undefined) {
      chunkHeaders.fileId = headers["x-file-id"];
    }

    if (headers["x-total-chunks"] !== undefined) {
      chunkHeaders.totalChunks = headers["x-total-chunks"];
    }

    if (headers["x-total-size"] !== undefined) {
      chunkHeaders.totalSize = headers["x-total-size"];
    }

    const result = await runtime.uploadService.storeChunk(
      sessionToken,
      params.uploadId,
      params.index,
      chunkHeaders,
      body,
    );

    return reply.send(result);
  });

  app.post("/upload/complete", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = z
      .object({
        fileId: z.string().uuid(),
        totalChunks: z.number().int().positive(),
        totalSize: z.number().int().positive(),
        uploadId: z.string().uuid(),
      })
      .parse(request.body);

    const result = await runtime.uploadService.completeUpload(
      sessionToken,
      body,
    );

    return reply.status(202).send(result);
  });

  app.get("/upload/:uploadId/status", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ uploadId: z.string().uuid() })
      .parse(request.params);

    return reply.send(
      runtime.uploadService.getStatus(sessionToken, params.uploadId),
    );
  });

  app.delete("/upload/:uploadId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ uploadId: z.string().uuid() })
      .parse(request.params);

    await runtime.uploadService.cancelUpload(sessionToken, params.uploadId);

    return reply.status(204).send();
  });

  app.post("/upload", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);

    const saved = await request.saveRequestFiles({
      limits: { fileSize: maxFileSize },
      tmpdir: tempDir,
    });

    if (saved.files.length === 0) {
      throw new ValidationError("ファイルが添付されていません。");
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sf = saved.files[0]!;
    const filename = sf.filename || "upload";
    const mimetype = sf.mimetype || "application/octet-stream";
    const tempPath = sf.filepath;

    const publicVal = getFieldStr(saved.values, "public");
    const expiresAtVal = getFieldStr(saved.values, "expiresAt");
    const groupIdVal = getFieldStr(saved.values, "groupId");

    const isPublic = publicVal !== "0" && publicVal !== "false";
    const expiresAt = expiresAtVal || null;
    const groupId = groupIdVal || null;

    const fileStats = await stat(tempPath);

    const result = await runtime.uploadService.directUpload(sessionToken, {
      expiresAt,
      groupId,
      isPublic,
      mimeType: mimetype,
      name: filename,
      size: fileStats.size,
      tempPath,
    });

    request.log.info(
      { action: "Upload" },
      `${filename} (${formatSize(fileStats.size)}, direct)`,
    );

    return reply.send({ ok: true, fileId: result.fileId, url: result.url });
  });
}

function getRequiredBearerToken(
  authorizationHeader: string | string[] | undefined,
): string {
  if (typeof authorizationHeader !== "string") {
    throw new AuthenticationError();
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AuthenticationError();
  }

  return token;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

function getFieldStr(
  fields: Record<string, unknown>,
  key: string,
): string | null {
  const f = fields[key] as
    | { type: string; value: string }
    | { type: string; value: string }[]
    | undefined;
  if (!f) return null;
  const entry = Array.isArray(f) ? f[0] : f;
  if (!entry || entry.type !== "field") return null;
  return entry.value ?? null;
}
