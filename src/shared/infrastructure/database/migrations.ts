import type Database from "better-sqlite3";

const migrations = [
  {
    id: "001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        icon TEXT,
        role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        login_token_hash TEXT NOT NULL UNIQUE,
        storage_limit_bytes INTEGER NOT NULL,
        max_file_size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        session_token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        revoked_reason TEXT,
        user_agent TEXT,
        ip_address TEXT
      );

      CREATE TABLE IF NOT EXISTS service_policies (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        default_storage_limit_bytes INTEGER NOT NULL,
        default_max_file_size_bytes INTEGER NOT NULL,
        max_zip_total_bytes INTEGER NOT NULL,
        max_zip_file_count INTEGER NOT NULL,
        default_chunk_size_bytes INTEGER NOT NULL,
        min_chunk_size_bytes INTEGER NOT NULL,
        max_chunk_size_bytes INTEGER NOT NULL,
        session_ttl_seconds INTEGER NOT NULL,
        default_file_expiry_days INTEGER,
        max_file_expiry_days INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        public INTEGER NOT NULL CHECK (public IN (0, 1)) DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        upload_id TEXT UNIQUE,
        folder_id TEXT REFERENCES folders(id),
        group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        safe_name TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT,
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        public INTEGER NOT NULL CHECK (public IN (0, 1)),
        show_uploader INTEGER NOT NULL CHECK (show_uploader IN (0, 1)) DEFAULT 1,
        status TEXT NOT NULL CHECK (status IN ('uploading', 'processing', 'ready', 'expired', 'deleted')),
        expires_at TEXT,
        preview_status TEXT NOT NULL CHECK (preview_status IN ('none', 'pending', 'ready', 'failed')),
        preview_path TEXT,
        checksum TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER NOT NULL CHECK (is_deleted IN (0, 1)) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS upload_sessions (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL UNIQUE REFERENCES files(id),
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        chunk_size_bytes INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        total_size_bytes INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('uploading', 'processing', 'ready', 'expired', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS upload_parts (
        upload_id TEXT NOT NULL REFERENCES upload_sessions(id),
        part_index INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (upload_id, part_index)
      );

      CREATE TABLE IF NOT EXISTS processing_jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('finalize_upload', 'generate_preview')),
        subject_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL,
        run_after TEXT NOT NULL,
        claimed_at TEXT,
        lease_expires_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)) DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_active_lookup ON sessions(session_token_hash, revoked_at);
      CREATE INDEX IF NOT EXISTS idx_files_owner_created_at ON files(owner_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_files_visibility_created_at ON files(public, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_upload_parts_upload_id ON upload_parts(upload_id, part_index);
      CREATE INDEX IF NOT EXISTS idx_processing_jobs_status_run_after ON processing_jobs(status, run_after);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_files_safe_name_owner_folder_active
        ON files(owner_user_id, IFNULL(folder_id, ''), safe_name)
        WHERE is_deleted = 0;
    `,
  },
  {
    id: "002_add_groups",
    sql: `
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        is_private INTEGER NOT NULL CHECK (is_private IN (0, 1)) DEFAULT 0
      );

      ALTER TABLE files ADD COLUMN group_id TEXT REFERENCES groups(id) ON DELETE SET NULL;
    `,
  },
  {
    id: "003_add_folder_visibility",
    sql: `
      ALTER TABLE folders ADD COLUMN public INTEGER NOT NULL CHECK (public IN (0, 1)) DEFAULT 1;
    `,
  },
  {
    id: "004_add_file_show_uploader",
    sql: `
      ALTER TABLE files ADD COLUMN show_uploader INTEGER NOT NULL CHECK (show_uploader IN (0, 1)) DEFAULT 1;
    `,
  },
  {
    id: "005_announcement_reads",
    sql: `
      CREATE TABLE IF NOT EXISTS announcement_reads (
        user_id TEXT NOT NULL REFERENCES users(id),
        article_url TEXT NOT NULL,
        read_at TEXT NOT NULL,
        PRIMARY KEY (user_id, article_url)
      );
    `,
  },
] as const;

export interface DefaultPolicySeed {
  createdAt?: string;
  defaultChunkSizeBytes: number;
  defaultFileExpiryDays: number | null;
  defaultMaxFileSizeBytes: number;
  defaultStorageLimitBytes: number;
  maxChunkSizeBytes: number;
  maxFileExpiryDays: number | null;
  maxZipFileCount: number;
  maxZipTotalBytes: number;
  minChunkSizeBytes: number;
  sessionTtlSeconds: number;
  updatedAt: string;
}

export function runMigrations(connection: Database.Database): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const hasMigrationStatement = connection.prepare(
    "SELECT 1 FROM _migrations WHERE id = ? LIMIT 1",
  );
  const recordMigrationStatement = connection.prepare(
    "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    const alreadyApplied = hasMigrationStatement.get(migration.id);

    if (alreadyApplied) {
      continue;
    }

    const applyMigration = connection.transaction(() => {
      connection.exec(migration.sql);
      recordMigrationStatement.run(migration.id, new Date().toISOString());
    });

    applyMigration();
  }
}

export function seedDefaultPolicy(
  connection: Database.Database,
  policy: DefaultPolicySeed,
): void {
  const existingPolicy = connection
    .prepare("SELECT id FROM service_policies WHERE id = 1")
    .get();

  if (existingPolicy) {
    return;
  }

  connection
    .prepare(
      `
    INSERT INTO service_policies (
      id,
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
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      1,
      policy.defaultStorageLimitBytes,
      policy.defaultMaxFileSizeBytes,
      policy.maxZipTotalBytes,
      policy.maxZipFileCount,
      policy.defaultChunkSizeBytes,
      policy.minChunkSizeBytes,
      policy.maxChunkSizeBytes,
      policy.sessionTtlSeconds,
      policy.defaultFileExpiryDays,
      policy.maxFileExpiryDays,
      policy.createdAt ?? policy.updatedAt,
      policy.updatedAt,
    );
}
