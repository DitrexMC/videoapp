import type Database from "better-sqlite3";
import type { NewsRepository } from "../application/NewsRepository.js";

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
}
