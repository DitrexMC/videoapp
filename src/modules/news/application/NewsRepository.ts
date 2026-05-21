import type { CreateNewsArticleInput, NewsArticle, UpdateNewsArticleInput } from "../domain/NewsArticle.js";

export interface NewsRepository {
  getReadUrls(userId: string): string[];
  markRead(userId: string, articleUrl: string, readAt: string): void;
  listArticles(): NewsArticle[];
  getArticleBySlug(slug: string): NewsArticle | null;
  getArticleById(id: string): NewsArticle | null;
  slugExists(slug: string, excludeId?: string): boolean;
  createArticle(input: CreateNewsArticleInput & { id: string; createdAt: string; updatedAt: string }): void;
  updateArticle(id: string, input: UpdateNewsArticleInput & { updatedAt: string }): void;
  deleteArticle(id: string): void;
}
