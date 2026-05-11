import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppRuntime } from "../../../app/runtime.js";
import type { UpdateNewsArticleInput } from "../domain/NewsArticle.js";
import { AuthenticationError, AuthorizationError, ValidationError } from "../../../shared/domain/errors.js";
import { isAdmin } from "../../identity/domain/User.js";

const createArticleSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional().default(""),
  type: z.enum(["news", "update", "guide", "note", "danger"]),
  date: z.string().min(1),
  tags: z.string().optional().default(""),
  image: z.string().optional().default(""),
  content: z.string().optional().default(""),
});

const updateArticleSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  type: z.enum(["news", "update", "guide", "note", "danger"]).optional(),
  date: z.string().min(1).optional(),
  tags: z.string().optional(),
  image: z.string().optional(),
  content: z.string().optional(),
});

function requireAdmin(token: string, runtime: AppRuntime) {
  const { user } = runtime.authService.authenticate(token);
  if (!isAdmin(user)) {
    throw new AuthorizationError("管理者権限が必要です。");
  }
}

export async function registerNewsAdminRoutes(
  app: FastifyInstance,
  runtime: AppRuntime,
): Promise<void> {
  app.get("/admin/news", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    requireAdmin(sessionToken, runtime);
    const articles = runtime.newsService.listArticles(sessionToken);

    return {
      items: articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        subtitle: a.subtitle,
        type: a.type,
        date: a.date,
        tags: a.tags,
        image: a.image,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      })),
    };
  });

  app.get("/admin/news/:id", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    requireAdmin(sessionToken, runtime);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const article = runtime.newsService.listArticles(sessionToken)
      .find((a) => a.id === params.id);

    if (!article) {
      return { message: "記事が見つかりません。" };
    }

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

  app.post("/admin/news", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    requireAdmin(sessionToken, runtime);
    const body = createArticleSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("記事の入力が不正です。", body.error.flatten());
    }

    const article = runtime.newsService.createArticle(sessionToken, body.data);

    return reply.status(201).send({
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
    });
  });

  app.patch("/admin/news/:id", async (request) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    requireAdmin(sessionToken, runtime);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = updateArticleSchema.safeParse(request.body);

    if (!body.success) {
      throw new ValidationError("記事の入力が不正です。", body.error.flatten());
    }

    if (Object.keys(body.data).length === 0) {
      throw new ValidationError("更新するフィールドがありません。");
    }

    const article = runtime.newsService.updateArticle(sessionToken, params.id, buildUpdateInput(body.data));

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

  app.delete("/admin/news/:id", async (request, reply) => {
    const sessionToken = getRequiredBearerToken(request.headers.authorization);
    requireAdmin(sessionToken, runtime);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    runtime.newsService.deleteArticle(sessionToken, params.id);

    return reply.status(204).send();
  });
}

function buildUpdateInput(data: z.infer<typeof updateArticleSchema>): UpdateNewsArticleInput {
  const input: UpdateNewsArticleInput = {};

  if (data.slug !== undefined) input.slug = data.slug;
  if (data.title !== undefined) input.title = data.title;
  if (data.subtitle !== undefined) input.subtitle = data.subtitle;
  if (data.type !== undefined) input.type = data.type;
  if (data.date !== undefined) input.date = data.date;
  if (data.tags !== undefined) input.tags = data.tags;
  if (data.image !== undefined) input.image = data.image;
  if (data.content !== undefined) input.content = data.content;

  return input;
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
