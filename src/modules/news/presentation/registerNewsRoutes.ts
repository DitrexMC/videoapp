import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import { AuthenticationError } from "../../../shared/domain/errors.js";

export async function registerNewsRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  app.get("/api/news/read-urls", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const { user } = runtime.authService.authenticate(sessionToken);
    const readUrls = runtime.newsService.getReadUrls(user.id);

    return { read_urls: readUrls };
  });

  const markReadSchema = z.object({
    article_url: z.string().min(1),
  });

  app.post("/api/news/read", async (request, reply) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const { user } = runtime.authService.authenticate(sessionToken);

    const body = markReadSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ code: "validation_error", message: "article_url は必須です。" });
    }

    runtime.newsService.markRead(user.id, body.data.article_url);

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
