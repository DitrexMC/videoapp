import type Database from "better-sqlite3";

import type {
  CreateFolderInput,
  CreateFileInput,
  CreateGroupInput,
  FileListFilters,
  FileRepository,
} from "../application/FileRepository.js";
import type {
  FileRecord,
  FolderRecord,
  GroupRecord,
  PreviewStatus,
} from "../domain/FileRecord.js";

interface FileRow {
  checksum: string | null;
  created_at: string;
  expires_at: string | null;
  folder_id: string | null;
  group_id: string | null;
  id: string;
  is_deleted: number;
  mime_type: string;
  name: string;
  owner_user_id: string;
  preview_path: string | null;
  preview_status: PreviewStatus;
  public: number;
  safe_name: string;
  show_uploader: number;
  size_bytes: number;
  status: FileRecord["status"];
  storage_path: string | null;
  updated_at: string;
  upload_id: string | null;
}

interface FolderRow {
  created_at: string;
  deleted_at: string | null;
  id: string;
  name: string;
  owner_user_id: string;
  public: number;
  updated_at: string;
}

interface GroupRow {
  created_at: string;
  expires_at: string | null;
  id: string;
  is_private: number;
  label: string;
  owner_user_id: string;
  updated_at: string;
  file_count?: number;
  total_size?: number;
}

export class SqliteFileRepository implements FileRepository {
  private readonly connection: Database.Database;

  constructor(connection: Database.Database) {
    this.connection = connection;
  }

  countFilesInFolder(folderId: string): number {
    const row = this.connection
      .prepare<{ folderId: string }, { count: number }>(
        `
      SELECT COUNT(*) AS count
      FROM files
      WHERE folder_id = @folderId
        AND is_deleted = 0
    `,
      )
      .get({ folderId });

    return row?.count ?? 0;
  }

  createFile(input: CreateFileInput): FileRecord {
    const now = input.createdAt;

    this.connection
      .prepare(
        `
      INSERT INTO files (
        id, upload_id, folder_id, group_id, name, safe_name, size_bytes, mime_type,
        storage_path, owner_user_id, public, show_uploader, status, expires_at,
        preview_status, preview_path, checksum, created_at, updated_at, is_deleted
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ready', ?, ?, ?, ?, ?, ?, 0)
    `,
      )
      .run(
        input.id,
        input.folderId,
        input.groupId,
        input.name,
        input.safeName,
        input.sizeBytes,
        input.mimeType,
        input.storagePath,
        input.ownerUserId,
        input.public ? 1 : 0,
        input.expiresAt,
        input.previewStatus,
        input.previewPath,
        input.checksum,
        now,
        input.updatedAt,
      );

    return {
      checksum: input.checksum,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      folderId: input.folderId,
      groupId: input.groupId,
      id: input.id,
      isDeleted: false,
      mimeType: input.mimeType,
      name: input.name,
      ownerUserId: input.ownerUserId,
      previewPath: input.previewPath,
      previewStatus: input.previewStatus,
      public: input.public,
      safeName: input.safeName,
      showUploader: true,
      sizeBytes: input.sizeBytes,
      status: "ready",
      storagePath: input.storagePath,
      updatedAt: input.updatedAt,
      uploadId: null,
    };
  }

  createFolder(input: CreateFolderInput): FolderRecord {
    this.connection
      .prepare(
        `
      INSERT INTO folders (id, owner_user_id, name, public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        input.id,
        input.ownerUserId,
        input.name,
        input.public !== false ? 1 : 0,
        input.createdAt,
        input.updatedAt,
      );

    return {
      createdAt: input.createdAt,
      deletedAt: null,
      id: input.id,
      name: input.name,
      ownerUserId: input.ownerUserId,
      public: input.public !== false,
      updatedAt: input.updatedAt,
    };
  }

  createGroup(input: CreateGroupInput): GroupRecord {
    this.connection
      .prepare(
        `
      INSERT INTO groups (id, owner_user_id, label, created_at, updated_at, expires_at, is_private)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        input.id,
        input.ownerUserId,
        input.label,
        input.createdAt,
        input.updatedAt,
        input.expiresAt,
        input.isPrivate ? 1 : 0,
      );

    return {
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      id: input.id,
      isPrivate: input.isPrivate,
      label: input.label,
      ownerUserId: input.ownerUserId,
      updatedAt: input.updatedAt,
    };
  }

  deleteFolder(folderId: string, deletedAt: string): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE files
        SET folder_id = NULL,
            is_deleted = 1,
            status = 'deleted',
            updated_at = ?
        WHERE folder_id = ? AND is_deleted = 0
      `,
        )
        .run(deletedAt, folderId);
      this.connection
        .prepare(
          `
        UPDATE files
        SET folder_id = NULL
        WHERE folder_id = ?
      `,
        )
        .run(folderId);
      this.connection
        .prepare(
          `
        DELETE FROM folders WHERE id = ?
      `,
        )
        .run(folderId);
    })();
  }

  findFileById(fileId: string): FileRecord | null {
    const row = this.connection
      .prepare<unknown[], FileRow>(
        `
      SELECT
        id,
        upload_id,
        folder_id,
        group_id,
        name,
        safe_name,
        size_bytes,
        mime_type,
        storage_path,
        owner_user_id,
        public,
        status,
        expires_at,
        preview_status,
        preview_path,
        show_uploader,
        checksum,
        created_at,
        updated_at,
        is_deleted
      FROM files
      WHERE id = ?
      LIMIT 1
    `,
      )
      .get(fileId);

    return row ? mapFile(row) : null;
  }

  findFilesByIds(fileIds: string[]): FileRecord[] {
    if (fileIds.length === 0) {
      return [];
    }

    const placeholders = fileIds.map(() => "?").join(", ");
    const rows = this.connection
      .prepare<unknown[], FileRow>(
        `
      SELECT
        id,
        upload_id,
        folder_id,
        group_id,
        name,
        safe_name,
        size_bytes,
        mime_type,
        storage_path,
        owner_user_id,
        public,
        status,
        expires_at,
        preview_status,
        preview_path,
        show_uploader,
        checksum,
        created_at,
        updated_at,
        is_deleted
      FROM files
      WHERE id IN (${placeholders})
    `,
      )
      .all(...fileIds);

    return rows.map(mapFile);
  }

  getStorageUsage(ownerUserId: string): number {
    const row = this.connection
      .prepare<unknown[], { used_bytes: number | null }>(
        `
      SELECT SUM(size_bytes) AS used_bytes
      FROM files
      WHERE owner_user_id = ?
        AND is_deleted = 0
        AND status IN ('uploading', 'processing', 'ready')
    `,
      )
      .get(ownerUserId);

    return row?.used_bytes ?? 0;
  }

  findFolderById(folderId: string): FolderRecord | null {
    const row = this.connection
      .prepare<unknown[], FolderRow>(
        `
      SELECT id, owner_user_id, name, public, created_at, updated_at, deleted_at
      FROM folders
      WHERE id = ?
      LIMIT 1
    `,
      )
      .get(folderId);

    return row ? mapFolder(row) : null;
  }

  listFiles(filters: FileListFilters): FileRecord[] {
    const parameters: Record<string, unknown> = {
      cursor: filters.cursor ?? null,
      folderId: filters.folderId ?? null,
      groupId: filters.groupId ?? null,
      limit: filters.limit,
      ownerUserId: filters.ownerUserId,
      status: filters.status ?? null,
    };
    const rows = this.connection
      .prepare<Record<string, unknown>, FileRow>(
        `
      SELECT
        id,
        upload_id,
        folder_id,
        group_id,
        name,
        safe_name,
        size_bytes,
        mime_type,
        storage_path,
        owner_user_id,
        public,
        status,
        expires_at,
        preview_status,
        preview_path,
        show_uploader,
        checksum,
        created_at,
        updated_at,
        is_deleted
      FROM files
      WHERE owner_user_id = @ownerUserId
        AND is_deleted = 0
        AND (@folderId IS NULL OR folder_id = @folderId)
        AND (@groupId IS NULL OR group_id = @groupId)
        AND (@status IS NULL OR status = @status)
        AND (@cursor IS NULL OR created_at < @cursor)
      ORDER BY created_at DESC
      LIMIT @limit
    `,
      )
      .all(parameters);

    return rows.map(mapFile);
  }

  listFolders(ownerUserId: string): FolderRecord[] {
    const rows = this.connection
      .prepare<unknown[], FolderRow>(
        `
      SELECT id, owner_user_id, name, public, created_at, updated_at, deleted_at
      FROM folders
      WHERE owner_user_id = ?
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `,
      )
      .all(ownerUserId);

    return rows.map(mapFolder);
  }

  listSafeNames(ownerUserId: string, folderId: string | null): string[] {
    const rows = this.connection
      .prepare<unknown[], { safe_name: string }>(
        `
      SELECT safe_name
      FROM files
      WHERE owner_user_id = ?
        AND IFNULL(folder_id, '') = IFNULL(?, '')
        AND is_deleted = 0
    `,
      )
      .all(ownerUserId, folderId);

    return rows.map((row) => row.safe_name);
  }

  renameFolder(folderId: string, name: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE folders
      SET name = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(name, updatedAt, folderId);
  }

  softDeleteFile(fileId: string, deletedAt: string): void {
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
      .run(deletedAt, fileId);
  }

  countNonDeletedFilesByStoragePath(storagePath: string): number {
    const row = this.connection
      .prepare<[string], { cnt: number }>(
        `
      SELECT COUNT(*) AS cnt
      FROM files
      WHERE storage_path = ?
        AND is_deleted = 0
    `,
      )
      .get(storagePath);
    return row?.cnt ?? 0;
  }

  updateFilePreview(
    fileId: string,
    previewPath: string | null,
    previewStatus: PreviewStatus,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE files
      SET preview_path = ?,
          preview_status = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(previewPath, previewStatus, updatedAt, fileId);
  }

  updateFileVisibility(
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

  updateFileShowUploader(
    fileId: string,
    showUploader: boolean,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE files
      SET show_uploader = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(showUploader ? 1 : 0, updatedAt, fileId);
  }

  listGroups(ownerUserId: string): GroupRecord[] {
    const rows = this.connection
      .prepare<unknown[], GroupRow>(
        `
      SELECT g.*,
        (SELECT COUNT(*) FROM files f WHERE f.group_id = g.id AND f.is_deleted = 0) AS file_count,
        (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.group_id = g.id AND f.is_deleted = 0) AS total_size
      FROM groups g
      WHERE g.owner_user_id = ?
      ORDER BY g.created_at DESC
    `,
      )
      .all(ownerUserId);

    return rows.map(mapGroup);
  }

  findGroupById(groupId: string): GroupRecord | null {
    const row = this.connection
      .prepare<unknown[], GroupRow>(
        `
      SELECT g.*,
        (SELECT COUNT(*) FROM files f WHERE f.group_id = g.id AND f.is_deleted = 0) AS file_count,
        (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.group_id = g.id AND f.is_deleted = 0) AS total_size
      FROM groups g
      WHERE g.id = ?
      LIMIT 1
    `,
      )
      .get(groupId);

    return row ? mapGroup(row) : null;
  }

  deleteGroup(groupId: string, deletedAt: string): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE files SET is_deleted = 1, updated_at = ? WHERE group_id = ? AND is_deleted = 0
      `,
        )
        .run(deletedAt, groupId);
      this.connection
        .prepare(
          `
        DELETE FROM groups WHERE id = ?
      `,
        )
        .run(groupId);
    })();
  }

  renameFile(
    fileId: string,
    name: string,
    safeName: string,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE files
      SET name = ?, safe_name = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(name, safeName, updatedAt, fileId);
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
      SET expires_at = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(expiresAt, updatedAt, fileId);
  }

  renameGroup(groupId: string, label: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE groups SET label = ?, updated_at = ? WHERE id = ?
    `,
      )
      .run(label, updatedAt, groupId);
  }

  updateGroupPrivacy(
    groupId: string,
    isPrivate: boolean,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE groups SET is_private = ?, updated_at = ? WHERE id = ?
    `,
      )
      .run(isPrivate ? 1 : 0, updatedAt, groupId);
  }

  softDeleteFilesInFolder(folderId: string, deletedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE files
      SET is_deleted = 1,
          status = 'deleted',
          updated_at = ?
      WHERE folder_id = ? AND is_deleted = 0
    `,
      )
      .run(deletedAt, folderId);
  }

  updateFolderVisibility(
    folderId: string,
    isPublic: boolean,
    updatedAt: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE folders
      SET public = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(isPublic ? 1 : 0, updatedAt, folderId);
  }
}

function mapFile(row: FileRow): FileRecord {
  return {
    checksum: row.checksum,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    folderId: row.folder_id,
    groupId: row.group_id,
    id: row.id,
    isDeleted: row.is_deleted === 1,
    mimeType: row.mime_type,
    name: row.name,
    ownerUserId: row.owner_user_id,
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

function mapFolder(row: FolderRow): FolderRecord {
  return {
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    public: row.public === 1,
    updatedAt: row.updated_at,
  };
}

function mapGroup(row: GroupRow): GroupRecord {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    isPrivate: row.is_private === 1,
    label: row.label,
    ownerUserId: row.owner_user_id,
    updatedAt: row.updated_at,
    fileCount: row.file_count,
    totalSize: row.total_size,
  };
}
