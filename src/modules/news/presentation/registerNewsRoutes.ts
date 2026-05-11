import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import { AuthenticationError } from "../../../shared/domain/errors.js";

export async function registerNewsRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  app.get("/api/news/articles", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const articles = runtime.newsService.listArticles(sessionToken);

    return articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      subtitle: a.subtitle,
      type: a.type,
      date: a.date,
      tags: a.tags,
      image: a.image,
    }));
  });

  app.get("/api/news/articles/:slug", async (request) => {
    const sessionToken = getBearerToken(request.headers.authorization);
    const params = z.object({ slug: z.string().min(1) }).parse(request.params);
    const article = runtime.newsService.getArticleBySlug(sessionToken, params.slug);

    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      subtitle: article.subtitle,
      type: article.type,
      date: article.date,
      tags: article.tags,
      image: article.image,
      content: article.content,
      created_at: article.createdAt,
      updated_at: article.updatedAt,
    };
  });

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
