import type Database from "better-sqlite3";

import type { ServicePolicyRepository } from "../../application/ServicePolicyRepository.js";
import type { ServicePolicies } from "../../domain/ServicePolicies.js";

interface PolicyRow {
  default_chunk_size_bytes: number;
  default_file_expiry_days: number | null;
  default_max_file_size_bytes: number;
  default_storage_limit_bytes: number;
  max_chunk_size_bytes: number;
  max_file_expiry_days: number | null;
  max_zip_file_count: number;
  max_zip_total_bytes: number;
  min_chunk_size_bytes: number;
  session_ttl_seconds: number;
  updated_at: string;
}

export class SqliteServicePolicyRepository implements ServicePolicyRepository {
  private readonly connection: Database.Database;

  constructor(connection: Database.Database) {
    this.connection = connection;
  }

  findPolicies(): ServicePolicies {
    const row = this.connection.prepare<unknown[], PolicyRow>(`
      SELECT
        default_storage_limit_bytes,
        default_max_file_size_bytes,
        max_zip_total_bytes,
        max_zip_file_count,
        default_chunk_size_bytes,
        min_chunk_size_bytes,
        max_chunk_size_bytes,
        session_ttl_seconds,
        default_file_expiry_days,
        max_file_expiry_days,
        updated_at
      FROM service_policies
      WHERE id = 1
      LIMIT 1
    `).get();

    if (!row) {
      throw new Error("service_policies row is missing");
    }

    return {
      defaultChunkSizeBytes: row.default_chunk_size_bytes,
      defaultFileExpiryDays: row.default_file_expiry_days,
      defaultMaxFileSizeBytes: row.default_max_file_size_bytes,
      defaultStorageLimitBytes: row.default_storage_limit_bytes,
      maxChunkSizeBytes: row.max_chunk_size_bytes,
      maxFileExpiryDays: row.max_file_expiry_days,
      maxZipFileCount: row.max_zip_file_count,
      maxZipTotalBytes: row.max_zip_total_bytes,
      minChunkSizeBytes: row.min_chunk_size_bytes,
      sessionTtlSeconds: row.session_ttl_seconds,
      updatedAt: row.updated_at
    };
  }
}