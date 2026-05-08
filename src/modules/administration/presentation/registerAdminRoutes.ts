import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import { AuthenticationError, ValidationError } from "../../../shared/domain/errors.js";

const createUserSchema = z.object({
  icon: z.string().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
  username: z.string().min(1)
});

const updatePoliciesSchema = z.object({
  defaultChunkSizeBytes: z.number().int().positive().optional(),
  defaultFileExpiryDays: z.number().int().positive().nullable().optional(),
  defaultMaxFileSizeBytes: z.number().int().positive().optional(),
  defaultStorageLimitBytes: z.number().int().positive().optional(),
  maxChunkSizeBytes: z.number().int().positive().optional(),
  maxFileExpiryDays: z.number().int().positive().nullable().optional(),
  maxZipFileCount: z.number().int().positive().optional(),
  maxZipTotalBytes: z.number().int().positive().optional(),
  minChunkSizeBytes: z.number().int().positive().optional(),
  sessionTtlSeconds: z.number().int().positive().optional()
});

export async function registerAdminRoutes(app: FastifyInstance, runtime: AppRuntime): Promise<void> {
  app.get("/admin/users", async (request) => ({
    items: runtime.administrationService.listUsers(getRequiredBearerToken(request.headers.authorization))
  }));

  app.post("/admin/users", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = createUserSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("ユーザー作成入力が不正です。", body.error.flatten());
    }

    return runtime.administrationService.createUser(sessionToken, buildCreateUserInput(body.data));
  });

  app.delete("/admin/users/:userId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);

    runtime.administrationService.deleteUser(sessionToken, params.userId);

    return reply.status(204).send();
  });

  app.patch("/admin/users/:userId/disable", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);

    runtime.administrationService.disableUser(sessionToken, params.userId);

    return reply.status(204).send();
  });

  app.patch("/admin/users/:userId/enable", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);

    runtime.administrationService.enableUser(sessionToken, params.userId);

    return reply.status(204).send();
  });

  app.patch("/admin/users/:userId/username", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = z.object({ username: z.string().min(1) }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("username が不正です。", body.error.flatten());
    }

    runtime.administrationService.updateUsername(sessionToken, params.userId, body.data.username);

    return reply.status(204).send();
  });

  app.patch("/admin/users/:userId/icon/reset", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);

    runtime.administrationService.resetUserIcon(sessionToken, params.userId);

    return reply.status(204).send();
  });

  app.get("/admin/users/:userId/sessions", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);

    return {
      items: runtime.administrationService.getUserSessions(sessionToken, params.userId)
    };
  });

  app.post("/admin/users/:userId/login-token/rotate", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);

    return runtime.administrationService.rotateUserLoginToken(sessionToken, params.userId);
  });

  app.patch("/admin/users/:userId/storage-limit", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = z.object({ storageLimitBytes: z.number().int().positive() }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("storageLimitBytes が不正です。", body.error.flatten());
    }

    runtime.administrationService.updateUserLimits(sessionToken, params.userId, { storageLimitBytes: body.data.storageLimitBytes });

    return reply.status(204).send();
  });

  app.patch("/admin/users/:userId/file-limit", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = z.object({ maxFileSizeBytes: z.number().int().positive() }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("maxFileSizeBytes が不正です。", body.error.flatten());
    }

    runtime.administrationService.updateUserLimits(sessionToken, params.userId, { maxFileSizeBytes: body.data.maxFileSizeBytes });

    return reply.status(204).send();
  });

  app.get("/admin/files", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const query = z.object({
      search: z.string().optional()
    }).parse(request.query);
    const files = runtime.administrationService.listFiles(sessionToken, query.search);

    return {
      items: files.map(file => ({
        created_at: file.createdAt,
        expires_at: file.expiresAt,
        folder_id: file.folderId,
        id: file.id,
        mime_type: file.mimeType,
        name: file.name,
        owner_user_id: file.ownerUserId,
        owner_username: file.ownerUsername,
        preview_status: file.previewStatus,
        public: file.public,
        safe_name: file.safeName,
        size: file.sizeBytes,
        status: file.status,
        updated_at: file.updatedAt
      }))
    };
  });

  app.get("/admin/files/:fileId", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ fileId: z.string().uuid() }).parse(request.params);
    const file = runtime.administrationService.getFile(sessionToken, params.fileId);

    return {
      created_at: file.createdAt,
      expires_at: file.expiresAt,
      folder_id: file.folderId,
      id: file.id,
      mime_type: file.mimeType,
      name: file.name,
      owner_user_id: file.ownerUserId,
      owner_username: file.ownerUsername,
      preview_status: file.previewStatus,
      public: file.public,
      safe_name: file.safeName,
      size: file.sizeBytes,
      status: file.status,
      updated_at: file.updatedAt
    };
  });

  app.delete("/admin/files/:fileId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ fileId: z.string().uuid() }).parse(request.params);

    await runtime.administrationService.softDeleteFile(sessionToken, params.fileId);

    return reply.status(204).send();
  });

  app.patch("/admin/files/:fileId/expire", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ fileId: z.string().uuid() }).parse(request.params);
    const body = z.object({ expiresAt: z.string().datetime().nullable() }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("expiresAt が不正です。", body.error.flatten());
    }

    runtime.administrationService.setFileExpiration(sessionToken, params.fileId, body.data.expiresAt);

    return reply.status(204).send();
  });

  app.patch("/admin/files/:fileId/public", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ fileId: z.string().uuid() }).parse(request.params);
    const body = z.object({ public: z.boolean() }).safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("public が不正です。", body.error.flatten());
    }

    runtime.administrationService.setFileVisibility(sessionToken, params.fileId, body.data.public);

    return reply.status(204).send();
  });

  app.get("/admin/groups", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const query = z.object({
      search: z.string().optional()
    }).parse(request.query);
    const groups = runtime.administrationService.listGroups(sessionToken, query.search);

    return {
      items: groups
    };
  });

  app.delete("/admin/groups/:groupId", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const params = z.object({ groupId: z.string().uuid() }).parse(request.params);

    runtime.administrationService.deleteGroup(sessionToken, params.groupId);

    return reply.status(204).send();
  });

  app.get("/admin/policies", async (request) => runtime.administrationService.getPolicies(getRequiredBearerToken(request.headers.authorization)));

  app.patch("/admin/policies", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    const body = updatePoliciesSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("ポリシー入力が不正です。", body.error.flatten());
    }

    return runtime.administrationService.updatePolicies(sessionToken, buildPolicyPatchInput(body.data));
  });
}

function getRequiredBearerToken(authorizationHeader: string | string[] | undefined): string {
  if (typeof authorizationHeader !== "string") {
    throw new AuthenticationError();
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AuthenticationError();
  }

  return token;
}

function buildCreateUserInput(data: z.infer<typeof createUserSchema>): { icon?: string | null; role?: "admin" | "user"; username: string } {
  const input: { icon?: string | null; role?: "admin" | "user"; username: string } = {
    username: data.username
  };

  if (data.icon !== undefined) {
    input.icon = data.icon;
  }

  if (data.role !== undefined) {
    input.role = data.role;
  }

  return input;
}

function buildPolicyPatchInput(data: z.infer<typeof updatePoliciesSchema>): Partial<{
  defaultChunkSizeBytes: number;
  defaultFileExpiryDays: number | null;
  defaultMaxFileSizeBytes: number;
  defaultStorageLimitBytes: number;
  maxChunkSizeBytes: number;
  maxFileExpiryDays: number | null;
  maxZipFileCount: number;
  maxZipTotalBytes: number;
  minChunkSizeBytes: number;
  sessionTtlSeconds: number;
}> {
  const input: Partial<{
    defaultChunkSizeBytes: number;
    defaultFileExpiryDays: number | null;
    defaultMaxFileSizeBytes: number;
    defaultStorageLimitBytes: number;
    maxChunkSizeBytes: number;
    maxFileExpiryDays: number | null;
    maxZipFileCount: number;
    maxZipTotalBytes: number;
    minChunkSizeBytes: number;
    sessionTtlSeconds: number;
  }> = {};

  if (data.defaultChunkSizeBytes !== undefined) {
    input.defaultChunkSizeBytes = data.defaultChunkSizeBytes;
  }

  if (data.defaultFileExpiryDays !== undefined) {
    input.defaultFileExpiryDays = data.defaultFileExpiryDays;
  }

  if (data.defaultMaxFileSizeBytes !== undefined) {
    input.defaultMaxFileSizeBytes = data.defaultMaxFileSizeBytes;
  }

  if (data.defaultStorageLimitBytes !== undefined) {
    input.defaultStorageLimitBytes = data.defaultStorageLimitBytes;
  }

  if (data.maxChunkSizeBytes !== undefined) {
    input.maxChunkSizeBytes = data.maxChunkSizeBytes;
  }

  if (data.maxFileExpiryDays !== undefined) {
    input.maxFileExpiryDays = data.maxFileExpiryDays;
  }

  if (data.maxZipFileCount !== undefined) {
    input.maxZipFileCount = data.maxZipFileCount;
  }

  if (data.maxZipTotalBytes !== undefined) {
    input.maxZipTotalBytes = data.maxZipTotalBytes;
  }

  if (data.minChunkSizeBytes !== undefined) {
    input.minChunkSizeBytes = data.minChunkSizeBytes;
  }

  if (data.sessionTtlSeconds !== undefined) {
    input.sessionTtlSeconds = data.sessionTtlSeconds;
  }

  return input;
}