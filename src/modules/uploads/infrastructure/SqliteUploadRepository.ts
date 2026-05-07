import type Database from "better-sqlite3";

import type { FolderRecord } from "../../files/domain/FileRecord.js";
import type {
  CreatePendingUploadInput,
  FinalizeJob,
  UploadJobState,
  UploadRepository,
} from "../application/UploadRepository.js";
import type { UploadSession } from "../domain/UploadSession.js";

interface UploadRow {
  chunk_size_bytes: number;
  completed_at: string | null;
  created_at: string;
  file_id: string;
  id: string;
  owner_user_id: string;
  status: UploadSession["status"];
  total_chunks: number;
  total_size_bytes: number;
  updated_at: string;
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

interface JobRow {
  attempts: number;
  id: string;
  last_error: string | null;
  max_attempts: number;
  status: "completed" | "failed" | "pending" | "running";
  payload: string;
  subject_id: string;
  type: "finalize_upload";
}

export class SqliteUploadRepository implements UploadRepository {
  private readonly connection: Database.Database;

  constructor(connection: Database.Database) {
    this.connection = connection;
  }

  createPendingUpload(input: CreatePendingUploadInput): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        INSERT INTO files (
          id,
          upload_id,
          folder_id,
          name,
          safe_name,
          size_bytes,
          mime_type,
          storage_path,
          owner_user_id,
          public,
          show_uploader,
          status,
          expires_at,
          preview_status,
          preview_path,
          checksum,
          created_at,
          updated_at,
          is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, 'uploading', ?, 'none', NULL, NULL, ?, ?, 0)
      `,
        )
        .run(
          input.fileId,
          input.id,
          input.folderId,
          input.fileName,
          input.safeName,
          input.sizeBytes,
          input.mimeType,
          input.ownerUserId,
          input.visibility ? 1 : 0,
          input.expiresAt,
          input.createdAt,
          input.updatedAt,
        );

      this.connection
        .prepare(
          `
        INSERT INTO upload_sessions (
          id,
          file_id,
          owner_user_id,
          chunk_size_bytes,
          total_chunks,
          total_size_bytes,
          status,
          created_at,
          updated_at,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'uploading', ?, ?, NULL)
      `,
        )
        .run(
          input.id,
          input.fileId,
          input.ownerUserId,
          input.chunkSizeBytes,
          input.totalChunks,
          input.sizeBytes,
          input.createdAt,
          input.updatedAt,
        );
    })();
  }

  createSystemFolder(folder: FolderRecord): void {
    this.connection
      .prepare(
        `
      INSERT INTO folders (id, owner_user_id, name, public, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `,
      )
      .run(
        folder.id,
        folder.ownerUserId,
        folder.name,
        folder.public ? 1 : 0,
        folder.createdAt,
        folder.updatedAt,
      );
  }

  expireDueResources(nowIso: string): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE files
        SET status = 'expired',
            updated_at = ?
        WHERE expires_at IS NOT NULL
          AND expires_at <= ?
          AND status IN ('uploading', 'processing', 'ready')
          AND is_deleted = 0
      `,
        )
        .run(nowIso, nowIso);

      this.connection
        .prepare(
          `
        UPDATE upload_sessions
        SET status = 'expired',
            updated_at = ?
        WHERE file_id IN (
          SELECT id
          FROM files
          WHERE expires_at IS NOT NULL
            AND expires_at <= ?
            AND is_deleted = 0
        )
          AND status IN ('uploading', 'processing', 'ready')
      `,
        )
        .run(nowIso, nowIso);
    })();
  }

  findFinalizeJob(nowIso: string): FinalizeJob | null {
    const row = this.connection
      .prepare<unknown[], JobRow>(
        `
      SELECT id, subject_id, payload, type, attempts, max_attempts, status, last_error
      FROM processing_jobs
      WHERE status = 'pending'
        AND type = 'finalize_upload'
        AND run_after <= ?
      ORDER BY created_at ASC
      LIMIT 1
    `,
      )
      .get(nowIso);

    if (!row) {
      return null;
    }

    return {
      attempts: row.attempts,
      id: row.id,
      maxAttempts: row.max_attempts,
      payload: row.payload,
      subjectId: row.subject_id,
      type: row.type,
    };
  }

  findLatestJobState(uploadId: string): UploadJobState | null {
    const row = this.connection
      .prepare<unknown[], JobRow>(
        `
      SELECT id, subject_id, payload, type, attempts, max_attempts, status, last_error
      FROM processing_jobs
      WHERE subject_id = ?
        AND type = 'finalize_upload'
      ORDER BY created_at DESC
      LIMIT 1
    `,
      )
      .get(uploadId);

    if (!row) {
      return null;
    }

    return {
      attempts: row.attempts,
      lastError: row.last_error,
      maxAttempts: row.max_attempts,
      status: row.status,
    };
  }

  findUploadById(uploadId: string): UploadSession | null {
    const row = this.connection
      .prepare<unknown[], UploadRow>(
        `
      SELECT id, file_id, owner_user_id, chunk_size_bytes, total_chunks, total_size_bytes, status, created_at, updated_at, completed_at
      FROM upload_sessions
      WHERE id = ?
      LIMIT 1
    `,
      )
      .get(uploadId);

    return row ? mapUpload(row) : null;
  }

  findUploadedByteCount(uploadId: string): number {
    const row = this.connection
      .prepare<unknown[], { total_bytes: number | null }>(
        `
      SELECT SUM(size_bytes) AS total_bytes
      FROM upload_parts
      WHERE upload_id = ?
    `,
      )
      .get(uploadId);

    return row?.total_bytes ?? 0;
  }

  findUploadReceivedIndices(uploadId: string): number[] {
    const rows = this.connection
      .prepare<unknown[], { part_index: number }>(
        `
      SELECT part_index
      FROM upload_parts
      WHERE upload_id = ?
      ORDER BY part_index ASC
    `,
      )
      .all(uploadId);

    return rows.map((row) => row.part_index);
  }

  findUploadSafeNames(ownerUserId: string, folderId: string | null): string[] {
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

  findUserFolder(folderId: string, ownerUserId: string): FolderRecord | null {
    const row = this.connection
      .prepare<unknown[], FolderRow>(
        `
      SELECT id, owner_user_id, name, public, created_at, updated_at, deleted_at
      FROM folders
      WHERE id = ?
        AND owner_user_id = ?
      LIMIT 1
    `,
      )
      .get(folderId, ownerUserId);

    if (!row) {
      return null;
    }

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

  markFinalizeJobCompleted(jobId: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE processing_jobs
      SET status = 'completed', updated_at = ?
      WHERE id = ?
    `,
      )
      .run(updatedAt, jobId);
  }

  markFinalizeJobFailed(
    jobId: string,
    updatedAt: string,
    errorMessage: string,
    retryAfter: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE processing_jobs
      SET status = CASE WHEN attempts < max_attempts THEN 'pending' ELSE 'failed' END,
          last_error = ?,
          run_after = ?,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(errorMessage, retryAfter, updatedAt, jobId);
  }

  markFinalizeJobRunning(jobId: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE processing_jobs
      SET status = 'running',
          attempts = attempts + 1,
          updated_at = ?
      WHERE id = ?
    `,
      )
      .run(updatedAt, jobId);
  }

  markUploadCancelled(uploadId: string, updatedAt: string): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE upload_sessions
        SET status = 'cancelled', updated_at = ?
        WHERE id = ?
      `,
        )
        .run(updatedAt, uploadId);

      this.connection
        .prepare(
          `
        UPDATE files
        SET status = 'deleted', is_deleted = 1, updated_at = ?
        WHERE upload_id = ?
      `,
        )
        .run(updatedAt, uploadId);

      this.connection
        .prepare(
          `
        DELETE FROM upload_parts
        WHERE upload_id = ?
      `,
        )
        .run(uploadId);

      this.connection
        .prepare(
          `
        DELETE FROM processing_jobs
        WHERE subject_id = ?
          AND status = 'pending'
      `,
        )
        .run(uploadId);
    })();
  }

  markUploadReady(uploadId: string, updatedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE upload_sessions
      SET status = 'ready', updated_at = ?
      WHERE id = ?
    `,
      )
      .run(updatedAt, uploadId);
  }

  markUploadReadyFile(
    uploadId: string,
    data: {
      checksum: string;
      previewPath: string | null;
      previewStatus: "failed" | "none" | "ready";
      sizeBytes: number;
      storagePath: string;
      updatedAt: string;
    },
  ): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE upload_sessions
        SET status = 'ready',
            updated_at = ?,
            completed_at = ?
        WHERE id = ?
          AND status = 'processing'
      `,
        )
        .run(data.updatedAt, data.updatedAt, uploadId);

      this.connection
        .prepare(
          `
        UPDATE files
        SET status = 'ready',
            storage_path = ?,
            checksum = ?,
            preview_status = ?,
            preview_path = ?,
            size_bytes = ?,
            updated_at = ?
        WHERE upload_id = ?
          AND is_deleted = 0
          AND status = 'processing'
      `,
        )
        .run(
          data.storagePath,
          data.checksum,
          data.previewStatus,
          data.previewPath,
          data.sizeBytes,
          data.updatedAt,
          uploadId,
        );
    })();
  }

  markUploadFailed(
    uploadId: string,
    updatedAt: string,
    errorMessage: string,
  ): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE upload_sessions
        SET status = 'failed', updated_at = ?
        WHERE id = ?
      `,
        )
        .run(updatedAt, uploadId);

      this.connection
        .prepare(
          `
        UPDATE files
        SET status = 'failed', is_deleted = 1, updated_at = ?
        WHERE upload_id = ?
          AND is_deleted = 0
          AND status = 'processing'
      `,
        )
        .run(updatedAt, uploadId);
    })();
  }

  markUploadProcessingAndQueueJob(
    jobId: string,
    uploadId: string,
    createdAt: string,
  ): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE upload_sessions
        SET status = 'processing', updated_at = ?, completed_at = ?
        WHERE id = ?
      `,
        )
        .run(createdAt, createdAt, uploadId);

      this.connection
        .prepare(
          `
        UPDATE files
        SET status = 'processing', updated_at = ?
        WHERE upload_id = ?
      `,
        )
        .run(createdAt, uploadId);

      this.connection
        .prepare(
          `
        INSERT INTO processing_jobs (id, type, subject_id, payload, status, attempts, max_attempts, run_after, claimed_at, lease_expires_at, last_error, created_at, updated_at)
        VALUES (?, 'finalize_upload', ?, ?, 'pending', 0, 3, ?, NULL, NULL, NULL, ?, ?)
      `,
        )
        .run(
          jobId,
          uploadId,
          JSON.stringify({ uploadId }),
          createdAt,
          createdAt,
          createdAt,
        );
    })();
  }

  markUploadProcessing(uploadId: string, updatedAt: string): void {
    this.connection.transaction(() => {
      this.connection
        .prepare(
          `
        UPDATE upload_sessions
        SET status = 'processing', updated_at = ?, completed_at = ?
        WHERE id = ?
      `,
        )
        .run(updatedAt, updatedAt, uploadId);

      this.connection
        .prepare(
          `
        UPDATE files
        SET status = 'processing', updated_at = ?
        WHERE upload_id = ?
      `,
        )
        .run(updatedAt, uploadId);
    })();
  }

  queueFinalizeUpload(
    jobId: string,
    uploadId: string,
    createdAt: string,
  ): void {
    this.connection
      .prepare(
        `
      INSERT INTO processing_jobs (id, type, subject_id, payload, status, attempts, max_attempts, run_after, claimed_at, lease_expires_at, last_error, created_at, updated_at)
      VALUES (?, 'finalize_upload', ?, ?, 'pending', 0, 3, ?, NULL, NULL, NULL, ?, ?)
    `,
      )
      .run(
        jobId,
        uploadId,
        JSON.stringify({ uploadId }),
        createdAt,
        createdAt,
        createdAt,
      );
  }

  storeUploadPart(
    uploadId: string,
    index: number,
    sizeBytes: number,
    checksum: string,
    createdAt: string,
  ): void {
    this.connection
      .prepare(
        `
      INSERT OR REPLACE INTO upload_parts (upload_id, part_index, size_bytes, checksum, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(upload_id, part_index)
      DO UPDATE SET size_bytes = excluded.size_bytes, checksum = excluded.checksum, created_at = excluded.created_at
    `,
      )
      .run(uploadId, index, sizeBytes, checksum, createdAt);
  }
}

function mapUpload(row: UploadRow): UploadSession {
  return {
    chunkSizeBytes: row.chunk_size_bytes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    fileId: row.file_id,
    id: row.id,
    ownerUserId: row.owner_user_id,
    status: row.status,
    totalChunks: row.total_chunks,
    totalSizeBytes: row.total_size_bytes,
    updatedAt: row.updated_at,
  };
}
