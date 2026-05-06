import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import {
  AuthenticationError,
  ValidationError,
} from "../../../shared/domain/errors.js";

const SESSION_COOKIE_NAME = "va_session";

const loginRequestSchema = z.object({
  login_token: z.string().min(1),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const body = loginRequestSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError(
        "login_token は必須です。",
        body.error.flatten(),
      );
    }

    const loginResult = runtime.authService.login(body.data.login_token, {
      ipAddress: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });

    reply.header(
      "Set-Cookie",
      serializeSessionCookie(loginResult.session_token),
    );

    return loginResult;
  });

  app.get("/auth/me", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const user = runtime.authService.getCurrentUser(sessionToken);

    const storageRow = runtime.database.connection
      .prepare<
        string,
        { used: number }
      >("SELECT COALESCE(SUM(size_bytes), 0) AS used FROM files WHERE owner_user_id = ? AND is_deleted = 0")
      .get((user as { user_id: string }).user_id);

    return {
      user: {
        ...user,
        storage_used_bytes: storageRow?.used ?? 0,
      },
    };
  });

  app.get("/auth/verify", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    runtime.authService.getCurrentUser(sessionToken);

    return { valid: true };
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionToken = getBearerToken(request.headers.authorization);

    runtime.authService.logout(sessionToken);
    reply.header("Set-Cookie", clearSessionCookie());

    return reply.status(204).send();
  });

  app.post("/auth/logout_all", async (request, reply) => {
    const sessionToken = getBearerToken(request.headers.authorization);

    runtime.authService.logoutAll(sessionToken);
    reply.header("Set-Cookie", clearSessionCookie());

    return reply.status(204).send();
  });

  app.post("/auth/login-token/rotate", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);

    return runtime.authService.rotateLoginToken(sessionToken);
  });

  app.get("/auth/sessions", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const sessions = runtime.authService.getSessions(sessionToken);

    return {
      items: sessions.map((s) => ({
        created_at: s.createdAt,
        expires_at: s.expiresAt,
        id: s.id,
        ip_address: s.ipAddress,
        last_used_at: s.lastUsedAt,
        user_agent: s.userAgent,
      })),
    };
  });

  app.delete("/auth/sessions/:sessionId", async (request, reply) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const params = z
      .object({ sessionId: z.string().uuid() })
      .parse(request.params);

    runtime.authService.revokeUserSession(sessionToken, params.sessionId);

    return reply.status(204).send();
  });

  app.patch("/auth/username", async (request, reply) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const body = z
      .object({ username: z.string().min(1) })
      .safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("ユーザー名が不正です。", body.error.flatten());
    }

    runtime.authService.updateUsername(sessionToken, body.data.username);

    return reply.status(204).send();
  });
}

function getBearerToken(
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

function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function serializeSessionCookie(sessionToken: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax`;
}
