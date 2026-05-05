import BetterSqlite3 from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { DefaultPolicySeed } from "./migrations.js";
import { runMigrations, seedDefaultPolicy } from "./migrations.js";

export class SqliteDatabase {
  readonly connection: BetterSqlite3.Database;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });

    this.connection = new BetterSqlite3(databasePath);
    this.connection.pragma("foreign_keys = ON");
    this.connection.pragma("journal_mode = WAL");
    this.connection.pragma("synchronous = NORMAL");
  }

  close(): void {
    this.connection.close();
  }

  migrate(): void {
    runMigrations(this.connection);
  }

  ping(): boolean {
    return this.connection.prepare("SELECT 1 AS alive").get() !== undefined;
  }

  seedDefaultPolicy(policy: DefaultPolicySeed): void {
    seedDefaultPolicy(this.connection, policy);
  }

  resetRuntimeState(updatedAt: string): {
    previewPaths: string[];
    storagePaths: string[];
  } {
    const transientFiles = this.connection
      .prepare<
        unknown[],
        { preview_path: string | null; storage_path: string | null }
      >(
        `
      SELECT preview_path, storage_path
      FROM files
      WHERE status IN ('uploading', 'processing')
    `,
      )
      .all();

    this.connection.transaction(() => {
      this.connection.prepare("DELETE FROM sessions").run();
      this.connection.prepare("DELETE FROM processing_jobs").run();
      this.connection.prepare("DELETE FROM upload_parts").run();
      this.connection.prepare("DELETE FROM upload_sessions").run();
      this.connection
        .prepare(
          `
        UPDATE files
        SET is_deleted = 1,
            status = 'deleted',
            updated_at = ?
        WHERE status IN ('uploading', 'processing')
      `,
        )
        .run(updatedAt);
    })();

    return {
      previewPaths: transientFiles.flatMap((file) =>
        file.preview_path ? [file.preview_path] : [],
      ),
      storagePaths: transientFiles.flatMap((file) =>
        file.storage_path ? [file.storage_path] : [],
      ),
    };
  }
}
