import type Database from "better-sqlite3";

import type { FileRecord, GroupRecord } from "../../files/domain/FileRecord.js";
import type { UserRole, UserStatus } from "../../identity/domain/User.js";
import type { ServicePolicies } from "../../../shared/domain/ServicePolicies.js";
import type {
  AdminFileRecord,
  AdminGroupRecord,
  AdminSessionRecord,
  AdministrationRepository,
  AdminUserRecord,
  CreateManagedUserInput,
} from "../application/AdministrationRepository.js";

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

interface SessionRow {
  created_at: string;
  expires_at: string;
  id: string;
  ip_address: string | null;
  last_used_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  user_agent: string | null;
  user_id: string;
}

interface UserRow {
  created_at: string;
  deleted_at: string | null;
  file_count: number;
  icon: string | null;
  id: string;
  max_file_size_bytes: number;
  role: UserRole;
  status: UserStatus;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  updated_at: string;
  username: string;
}

interface AdminFileRow {
  checksum: string | null;
  created_at: string;
  expires_at: string | null;
  folder_id: string | null;
  id: string;
  is_deleted: number;
  mime_type: string;
  name: string;
  owner_user_id: string;
  owner_username: string;
  preview_path: string | null;
  preview_status: FileRecord["previewStatus"];
  public: number;
  safe_name: string;
  show_uploader: number;
  size_bytes: number;
  status: FileRecord["status"];
  storage_path: string | null;
  updated_at: string;
  upload_id: string | null;
}

interface AdminGroupRow {
  created_at: string;
  expires_at: string | null;
  file_count: number;
  id: string;
  is_private: number;
  label: string;
  owner_user_id: string;
  owner_username: string;
  total_size: number;
  updated_at: string;
}

export class SqliteAdministrationRepository implements AdministrationRepository {
  private readonly connection: Database.Database;

  constructor(connection: Database.Database) {
    this.connection = connection;
  }

  createUser(input: CreateManagedUserInput): AdminUserRecord {
    this.connection
      .prepare(
        `
      INSERT INTO users (
        id,
        username,
        icon,
        role,
        status,
        login_token_hash,
        storage_limit_bytes,
        max_file_size_bytes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        input.id,
        input.username,
        input.icon,
        input.role,
        input.status,
        input.loginTokenHash,
        input.storageLimitBytes,
        input.maxFileSizeBytes,
        input.createdAt,
        input.updatedAt,
      );

    return {
      createdAt: input.createdAt,
      deletedAt: null,
      fileCount: 0,
      icon: input.icon,
      id: input.id,
      maxFileSizeBytes: input.maxFileSizeBytes,
      role: input.role,
      status: input.status,
      storageLimitBytes: input.storageLimitBytes,
      storageUsedBytes: 0,
      updatedAt: input.updatedAt,
      username: input.username,
    };
  }

  deleteUser(userId: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE users
      SET deleted_at = ?,
          status = 'disabled',
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(updatedAt, updatedAt, userId);
  }

  findAdminFileById(fileId: string): AdminFileRecord | null {
    const row = this.connection
      .prepare<unknown[], AdminFileRow>(
        `
      SELECT
        f.id,
        f.upload_id,
        f.folder_id,
        f.name,
        f.safe_name,
        f.size_bytes,
        f.mime_type,
        f.storage_path,
        f.owner_user_id,
        u.username AS owner_username,
        f.public,
        f.show_uploader,
        f.status,
        f.expires_at,
        f.preview_status,
        f.preview_path,
        f.checksum,
        f.created_at,
        f.updated_at,
        f.is_deleted
      FROM files f
      INNER JOIN users u ON u.id = f.owner_user_id
      WHERE f.id = ?
      LIMIT 1
    `,
      )
      .get(fileId);

    return row ? mapAdminFile(row) : null;
  }

  listAdminFiles(search?: string): AdminFileRecord[] {
    const baseQuery = `
      SELECT
        f.id,
        f.upload_id,
        f.folder_id,
        f.name,
        f.safe_name,
        f.size_bytes,
        f.mime_type,
        f.storage_path,
        f.owner_user_id,
        u.username AS owner_username,
        f.public,
        f.show_uploader,
        f.status,
        f.expires_at,
        f.preview_status,
        f.preview_path,
        f.checksum,
        f.created_at,
        f.updated_at,
        f.is_deleted
      FROM files f
      INNER JOIN users u ON u.id = f.owner_user_id
    `;

    if (search) {
      const rows = this.connection
        .prepare<unknown[], AdminFileRow>(
          `
        ${baseQuery}
        WHERE f.safe_name LIKE ? AND f.is_deleted = 0
        ORDER BY f.created_at DESC
      `,
        )
        .all(`%${search}%`);

      return rows.map(mapAdminFile);
    }

    const rows = this.connection
      .prepare<unknown[], AdminFileRow>(
        `
      ${baseQuery}
      WHERE f.is_deleted = 0
      ORDER BY f.created_at DESC
    `,
      )
      .all();

    return rows.map(mapAdminFile);
  }

  listAdminGroups(search?: string): AdminGroupRecord[] {
    const baseQuery = `
      SELECT
        g.id,
        g.owner_user_id,
        u.username AS owner_username,
        g.label,
        g.created_at,
        g.updated_at,
        g.expires_at,
        g.is_private,
        COALESCE((SELECT COUNT(*) FROM files f WHERE f.group_id = g.id AND f.is_deleted = 0), 0) AS file_count,
        COALESCE((SELECT SUM(f.size_bytes) FROM files f WHERE f.group_id = g.id AND f.is_deleted = 0), 0) AS total_size
      FROM groups g
      INNER JOIN users u ON u.id = g.owner_user_id
    `;

    if (search) {
      const rows = this.connection
        .prepare<unknown[], AdminGroupRow>(
          `
        ${baseQuery}
        WHERE g.label LIKE ? OR EXISTS (SELECT 1 FROM files f WHERE f.group_id = g.id AND f.safe_name LIKE ?)
        ORDER BY g.created_at DESC
      `,
        )
        .all(`%${search}%`, `%${search}%`);

      return rows.map(mapAdminGroup);
    }

    const rows = this.connection
      .prepare<unknown[], AdminGroupRow>(
        `
      ${baseQuery}
      ORDER BY g.created_at DESC
    `,
      )
      .all();

    return rows.map(mapAdminGroup);
  }

  deleteAdminGroup(groupId: string): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE files SET group_id = NULL WHERE group_id = ?
      `,
        )
        .run(groupId);
      this.connection
        .prepare(
          `
        DELETE FROM groups WHERE id = ?
      `,
        )
        .run(groupId);
    })();
  }

  findPolicies(): ServicePolicies {
    const row = this.connection
      .prepare<unknown[], PolicyRow>(
        `
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
    `,
      )
      .get();

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
      updatedAt: row.updated_at,
    };
  }

  findUserById(userId: string): AdminUserRecord | null {
    const row = this.connection
      .prepare<unknown[], UserRow>(
        `
      SELECT
        u.id,
        u.username,
        u.icon,
        u.role,
        u.status,
        u.storage_limit_bytes,
        u.max_file_size_bytes,
        u.created_at,
        u.updated_at,
        u.deleted_at,
        COALESCE((SELECT SUM(f.size_bytes) FROM files f WHERE f.owner_user_id = u.id AND f.is_deleted = 0), 0) AS storage_used_bytes,
        COALESCE((SELECT COUNT(*) FROM files f WHERE f.owner_user_id = u.id AND f.is_deleted = 0), 0) AS file_count
      FROM users u
      WHERE u.id = ? AND u.deleted_at IS NULL
      LIMIT 1
    `,
      )
      .get(userId);

    return row ? mapAdminUser(row) : null;
  }

  listUserSessions(userId: string): AdminSessionRecord[] {
    const rows = this.connection
      .prepare<unknown[], SessionRow>(
        `
      SELECT id, user_id, created_at, last_used_at, expires_at, revoked_at, revoked_reason, user_agent, ip_address
      FROM sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `,
      )
      .all(userId);

    return rows.map(mapSession);
  }

  listUsers(): AdminUserRecord[] {
    const rows = this.connection
      .prepare<unknown[], UserRow>(
        `
      SELECT
        u.id,
        u.username,
        u.icon,
        u.role,
        u.status,
        u.storage_limit_bytes,
        u.max_file_size_bytes,
        u.created_at,
        u.updated_at,
        u.deleted_at,
        COALESCE((SELECT SUM(f.size_bytes) FROM files f WHERE f.owner_user_id = u.id AND f.is_deleted = 0), 0) AS storage_used_bytes,
        COALESCE((SELECT COUNT(*) FROM files f WHERE f.owner_user_id = u.id AND f.is_deleted = 0), 0) AS file_count
      FROM users u
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at ASC
    `,
      )
      .all();

    return rows.map(mapAdminUser);
  }

  revokeSessionsForUser(
    userId: string,
    revokedAt: string,
    reason: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE sessions
      SET revoked_at = COALESCE(revoked_at, ?),
          revoked_reason = COALESCE(revoked_reason, ?)
      WHERE user_id = ?
    `,
      )
      .run(revokedAt, reason, userId);
  }

  resetUserIcon(userId: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE users
      SET icon = NULL,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(updatedAt, userId);
  }

  rotateLoginToken(
    userId: string,
    loginTokenHash: string,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE users
      SET login_token_hash = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(loginTokenHash, updatedAt, userId);
  }

  setFileExpiration(
    fileId: string,
    expiresAt: string | null,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE files
      SET expires_at = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(expiresAt, updatedAt, fileId);
  }

  setFileVisibility(
    fileId: string,
    isPublic: boolean,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE files
      SET public = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(isPublic ? 1 : 0, updatedAt, fileId);
  }

  setUserStatus(userId: string, status: UserStatus, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE users
      SET status = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(status, updatedAt, userId);
  }

  softDeleteFile(fileId: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE files
      SET is_deleted = 1,
          status = 'deleted',
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(updatedAt, fileId);
  }

  updatePolicies(policies: ServicePolicies): void {
    this.connection
      .prepare(
        `
      UPDATE service_policies
      SET default_storage_limit_bytes = ?,
          default_max_file_size_bytes = ?,
          max_zip_total_bytes = ?,
          max_zip_file_count = ?,
          default_chunk_size_bytes = ?,
          min_chunk_size_bytes = ?,
          max_chunk_size_bytes = ?,
          session_ttl_seconds = ?,
          default_file_expiry_days = ?,
          max_file_expiry_days = ?,
          updated_at = ?
      WHERE id = 1
    `,
      )
      .run(
        policies.defaultStorageLimitBytes,
        policies.defaultMaxFileSizeBytes,
        policies.maxZipTotalBytes,
        policies.maxZipFileCount,
        policies.defaultChunkSizeBytes,
        policies.minChunkSizeBytes,
        policies.maxChunkSizeBytes,
        policies.sessionTtlSeconds,
        policies.defaultFileExpiryDays,
        policies.maxFileExpiryDays,
        policies.updatedAt,
      );
  }

  updateUserLimits(
    userId: string,
    maxFileSizeBytes: number | null,
    storageLimitBytes: number | null,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE users
      SET storage_limit_bytes = COALESCE(?, storage_limit_bytes),
          max_file_size_bytes = COALESCE(?, max_file_size_bytes),
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(storageLimitBytes, maxFileSizeBytes, updatedAt, userId);
  }

  updateUsername(userId: string, username: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE users
      SET username = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(username, updatedAt, userId);
  }
}

function mapAdminFile(row: AdminFileRow): AdminFileRecord {
  return {
    checksum: row.checksum,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    folderId: row.folder_id,
    groupId: null,
    id: row.id,
    isDeleted: row.is_deleted === 1,
    mimeType: row.mime_type,
    name: row.name,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    previewPath: row.preview_path,
    previewStatus: row.preview_status,
    public: row.public === 1,
    safeName: row.safe_name,
    showUploader: row.show_uploader !== 0,
    sizeBytes: row.size_bytes,
    status: row.status,
    storagePath: row.storage_path,
    updatedAt: row.updated_at,
    uploadId: row.upload_id,
  };
}

function mapAdminUser(row: UserRow): AdminUserRecord {
  return {
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    fileCount: row.file_count,
    icon: row.icon,
    id: row.id,
    maxFileSizeBytes: row.max_file_size_bytes,
    role: row.role,
    status: row.status,
    storageLimitBytes: row.storage_limit_bytes,
    storageUsedBytes: row.storage_used_bytes,
    updatedAt: row.updated_at,
    username: row.username,
  };
}

function mapSession(row: SessionRow): AdminSessionRecord {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    ipAddress: row.ip_address,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    userAgent: row.user_agent,
    userId: row.user_id,
  };
}

function mapAdminGroup(row: AdminGroupRow): AdminGroupRecord {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    fileCount: row.file_count,
    id: row.id,
    isPrivate: row.is_private === 1,
    label: row.label,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    totalSize: row.total_size,
    updatedAt: row.updated_at,
  };
}
