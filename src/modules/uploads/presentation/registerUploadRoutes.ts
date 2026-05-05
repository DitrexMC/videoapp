import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import {
  AuthenticationError,
  ValidationError,
} from "../../../shared/domain/errors.js";

const folderContextSchema = z
  .object({
    folderId: z.string().uuid().optional(),
    itemCount: z.number().int().positive().optional(),
    mode: z.enum(["single", "existing", "batch"]),
  })
  .optional();

const initUploadSchema = z.object({
  chunkSize: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  folderContext: folderContextSchema,
  mime_type: z.string().min(1),
  name: z.string().min(1),
  public: z.boolean(),
  size: z.number().int().positive(),
});

const completeUploadSchema = z.object({
  fileId: z.string().uuid(),
  totalChunks: z.number().int().positive(),
  totalSize: z.number().int().positive(),
  uploadId: z.string().uuid(),
});

export async function registerUploadRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  app.post("/upload/init", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = initUploadSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError(
        "upload/init の入力が不正です。",
        body.error.flatten(),
      );
    }

    return runtime.uploadService.initUpload(
      sessionToken,
      buildInitUploadInput(body.data),
    );
  });

  app.put("/upload/:uploadId/:index", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({
        index: z.coerce.number().int().min(0),
        uploadId: z.string().uuid(),
      })
      .parse(request.params);

    if (!Buffer.isBuffer(request.body)) {
      throw new ValidationError("chunk本体はバイナリで送信してください。");
    }

    return runtime.uploadService.storeChunk(
      sessionToken,
      params.uploadId,
      params.index,
      buildChunkHeaderInput(request.headers),
      request.body,
    );
  });

  app.post("/upload/complete", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = completeUploadSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError(
        "upload/complete の入力が不正です。",
        body.error.flatten(),
      );
    }

    const result = await runtime.uploadService.completeUpload(
      sessionToken,
      body.data,
    );

    return reply.status(202).send(result);
  });

  app.get("/upload/:uploadId/status", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ uploadId: z.string().uuid() })
      .parse(request.params);

    return runtime.uploadService.getStatus(sessionToken, params.uploadId);
  });

  app.delete("/upload/:uploadId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z
      .object({ uploadId: z.string().uuid() })
      .parse(request.params);

    await runtime.uploadService.cancelUpload(sessionToken, params.uploadId);

    return reply.status(204).send();
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

function parseOptionalIntegerHeader(
  value: string | string[] | undefined,
): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isNaN(parsedValue) ? undefined : parsedValue;
}

function buildChunkHeaderInput(headers: Record<string, unknown>): {
  chunkSize?: number;
  fileId?: string;
  totalChunks?: number;
  totalSize?: number;
} {
  const chunkHeaderInput: {
    chunkSize?: number;
    fileId?: string;
    totalChunks?: number;
    totalSize?: number;
  } = {};
  const chunkSize = parseOptionalIntegerHeader(
    headers["x-chunk-size"] as string | string[] | undefined,
  );
  const totalChunks = parseOptionalIntegerHeader(
    headers["x-total-chunks"] as string | string[] | undefined,
  );
  const totalSize = parseOptionalIntegerHeader(
    headers["x-total-size"] as string | string[] | undefined,
  );
  const fileId =
    typeof headers["x-file-id"] === "string" ? headers["x-file-id"] : undefined;

  if (chunkSize !== undefined) {
    chunkHeaderInput.chunkSize = chunkSize;
  }

  if (totalChunks !== undefined) {
    chunkHeaderInput.totalChunks = totalChunks;
  }

  if (totalSize !== undefined) {
    chunkHeaderInput.totalSize = totalSize;
  }

  if (fileId) {
    chunkHeaderInput.fileId = fileId;
  }

  return chunkHeaderInput;
}

function buildInitUploadInput(data: z.infer<typeof initUploadSchema>): {
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
} {
  const initUploadInput: {
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
    mime_type: data.mime_type,
    name: data.name,
    public: data.public,
    size: data.size,
  };

  if (data.chunkSize !== undefined) {
    initUploadInput.chunkSize = data.chunkSize;
  }

  if (data.expiresAt !== undefined) {
    initUploadInput.expiresAt = data.expiresAt;
  }

  if (data.folderContext !== undefined) {
    const folderContext: {
      folderId?: string;
      itemCount?: number;
      mode: "batch" | "existing" | "single";
    } = {
      mode: data.folderContext.mode,
    };

    if (data.folderContext.folderId !== undefined) {
      folderContext.folderId = data.folderContext.folderId;
    }

    if (data.folderContext.itemCount !== undefined) {
      folderContext.itemCount = data.folderContext.itemCount;
    }

    initUploadInput.folderContext = folderContext;
  }

  return initUploadInput;
}
