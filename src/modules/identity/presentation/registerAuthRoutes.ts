import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import {
  AuthenticationError,
  ValidationError,
} from "../../../shared/domain/errors.js";

const loginRequestSchema = z.object({
  login_token: z.string().min(1),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  app.post("/auth/login", async (request) => {
    const body = loginRequestSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError(
        "login_token は必須です。",
        body.error.flatten(),
      );
    }

    return runtime.authService.login(body.data.login_token, {
      ipAddress: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
  });

  app.post("/auth/admin-bypass", async (request) => {
    const bootstrapAdminToken = runtime.config.BOOTSTRAP_ADMIN_LOGIN_TOKEN;

    if (!bootstrapAdminToken) {
      throw new AuthenticationError();
    }

    return runtime.authService.login(bootstrapAdminToken, {
      ipAddress: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
  });

  app.get("/auth/me", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);

    return {
      user: runtime.authService.getCurrentUser(sessionToken),
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

    return reply.status(204).send();
  });

  app.post("/auth/logout_all", async (request, reply) => {
    const sessionToken = getBearerToken(request.headers.authorization);

    runtime.authService.logoutAll(sessionToken);

    return reply.status(204).send();
  });

  app.post("/auth/login-token/rotate", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);

    return runtime.authService.rotateLoginToken(sessionToken);
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
