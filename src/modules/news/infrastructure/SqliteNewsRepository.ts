import type Database from "better-sqlite3";
import type { NewsRepository } from "../application/NewsRepository.js";
import type { CreateNewsArticleInput, NewsArticle, UpdateNewsArticleInput } from "../domain/NewsArticle.js";

interface NewsArticleRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  type: "news" | "update" | "guide" | "note" | "danger";
  date: string;
  tags: string;
  image: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: NewsArticleRow): NewsArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    type: row.type,
    date: row.date,
    tags: row.tags,
    image: row.image,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteNewsRepository implements NewsRepository {
  private readonly connection: Database.Database;

  constructor(connection: Database.Database) {
    this.connection = connection;
  }

  getReadUrls(userId: string): string[] {
    const rows = this.connection
      .prepare<[string], { article_url: string }>(
        `SELECT article_url FROM announcement_reads WHERE user_id = ?`,
      )
      .all(userId);

    return rows.map((r) => r.article_url);
  }

  markRead(userId: string, articleUrl: string, readAt: string): void {
    this.connection
      .prepare(
        `INSERT OR IGNORE INTO announcement_reads (user_id, article_url, read_at) VALUES (?, ?, ?)`,
      )
      .run(userId, articleUrl, readAt);
  }

  listArticles(): NewsArticle[] {
    const rows = this.connection
      .prepare<[], NewsArticleRow>(
        `SELECT * FROM news_articles ORDER BY date DESC`,
      )
      .all();

    return rows.map(mapRow);
  }

  getArticleBySlug(slug: string): NewsArticle | null {
    const row = this.connection
      .prepare<[string], NewsArticleRow>(
        `SELECT * FROM news_articles WHERE slug = ?`,
      )
      .get(slug);

    return row ? mapRow(row) : null;
  }

  getArticleById(id: string): NewsArticle | null {
    const row = this.connection
      .prepare<[string], NewsArticleRow>(
        `SELECT * FROM news_articles WHERE id = ?`,
      )
      .get(id);

    return row ? mapRow(row) : null;
  }

  slugExists(slug: string, excludeId?: string): boolean {
    if (excludeId) {
      const row = this.connection
        .prepare<[string, string], { 1: number }>(
          `SELECT 1 FROM news_articles WHERE slug = ? AND id != ? LIMIT 1`,
        )
        .get(slug, excludeId);
      return !!row;
    }
    const row = this.connection
      .prepare<[string], { 1: number }>(
        `SELECT 1 FROM news_articles WHERE slug = ? LIMIT 1`,
      )
      .get(slug);
    return !!row;
  }

  createArticle(
    input: CreateNewsArticleInput & { id: string; createdAt: string; updatedAt: string },
  ): void {
    this.connection
      .prepare(
        `INSERT INTO news_articles (id, slug, title, subtitle, type, date, tags, image, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.slug,
        input.title,
        input.subtitle,
        input.type,
        input.date,
        input.tags,
        input.image,
        input.content,
        input.createdAt,
        input.updatedAt,
      );
  }

  updateArticle(id: string, input: UpdateNewsArticleInput & { updatedAt: string }): void {
    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (input.slug !== undefined) { fields.push("slug = ?"); values.push(input.slug); }
    if (input.title !== undefined) { fields.push("title = ?"); values.push(input.title); }
    if (input.subtitle !== undefined) { fields.push("subtitle = ?"); values.push(input.subtitle); }
    if (input.type !== undefined) { fields.push("type = ?"); values.push(input.type); }
    if (input.date !== undefined) { fields.push("date = ?"); values.push(input.date); }
    if (input.tags !== undefined) { fields.push("tags = ?"); values.push(input.tags); }
    if (input.image !== undefined) { fields.push("image = ?"); values.push(input.image); }
    if (input.content !== undefined) { fields.push("content = ?"); values.push(input.content); }

    fields.push("updated_at = ?");
    values.push(input.updatedAt);
    values.push(id);

    this.connection
      .prepare(`UPDATE news_articles SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteArticle(id: string): void {
    this.connection
      .prepare(`DELETE FROM news_articles WHERE id = ?`)
      .run(id);
  }
}
