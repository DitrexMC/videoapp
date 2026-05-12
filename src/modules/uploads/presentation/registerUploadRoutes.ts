import { stat } from "node:fs/promises";
import { join } from "node:path";

import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";

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
