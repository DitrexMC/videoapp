import type Database from "better-sqlite3";

import type {
  CreateSessionInput,
  CreateUserInput,
  IdentityRepository,
} from "../application/IdentityRepository.js";
import type { Session } from "../domain/Session.js";
import type { User } from "../domain/User.js";

interface SessionRow {
  created_at: string;
  expires_at: string;
  id: string;
  ip_address: string | null;
  last_used_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  session_token_hash: string;
  user_agent: string | null;
  user_id: string;
}

interface UserRow {
  created_at: string;
  deleted_at: string | null;
  icon: string | null;
  id: string;
  login_token_hash: string;
  max_file_size_bytes: number;
  role: User["role"];
  status: User["status"];
  storage_limit_bytes: number;
  updated_at: string;
  username: string;
}

export class SqliteIdentityRepository implements IdentityRepository {
  private readonly connection: Database.Database;

  constructor(connection: Database.Database) {
    this.connection = connection;
  }

  createSession(input: CreateSessionInput): Session {
    this.connection
      .prepare(
        `
      INSERT INTO sessions (
        id,
        user_id,
        session_token_hash,
        created_at,
        last_used_at,
        expires_at,
        user_agent,
        ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        input.id,
        input.userId,
        input.sessionTokenHash,
        input.createdAt,
        input.lastUsedAt,
        input.expiresAt,
        input.userAgent,
        input.ipAddress,
      );

    return {
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      id: input.id,
      ipAddress: input.ipAddress,
      lastUsedAt: input.lastUsedAt,
      revokedAt: null,
      revokedReason: null,
      sessionTokenHash: input.sessionTokenHash,
      userAgent: input.userAgent,
      userId: input.userId,
    };
  }

  createUser(input: CreateUserInput): User {
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
      icon: input.icon,
      id: input.id,
      loginTokenHash: input.loginTokenHash,
      maxFileSizeBytes: input.maxFileSizeBytes,
      role: input.role,
      status: input.status,
      storageLimitBytes: input.storageLimitBytes,
      updatedAt: input.updatedAt,
      username: input.username,
    };
  }

  findSessionByTokenHash(sessionTokenHash: string): Session | null {
    const row = this.connection
      .prepare<unknown[], SessionRow>(
        `
      SELECT
        id,
        user_id,
        session_token_hash,
        created_at,
        last_used_at,
        expires_at,
        revoked_at,
        revoked_reason,
        user_agent,
        ip_address
      FROM sessions
      WHERE session_token_hash = ?
      LIMIT 1
    `,
      )
      .get(sessionTokenHash);

    return row ? mapSession(row) : null;
  }

  findUserById(userId: string): User | null {
    const row = this.connection
      .prepare<unknown[], UserRow>(
        `
      SELECT
        id,
        username,
        icon,
        role,
        status,
        login_token_hash,
        storage_limit_bytes,
        max_file_size_bytes,
        created_at,
        updated_at,
        deleted_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
      )
      .get(userId);

    return row ? mapUser(row) : null;
  }

  findUserByUsername(username: string): User | null {
    const row = this.connection
      .prepare<unknown[], UserRow>(
        `
      SELECT
        id,
        username,
        icon,
        role,
        status,
        login_token_hash,
        storage_limit_bytes,
        max_file_size_bytes,
        created_at,
        updated_at,
        deleted_at
      FROM users
      WHERE username = ?
      ORDER BY deleted_at IS NOT NULL ASC, created_at ASC
      LIMIT 1
    `,
      )
      .get(username);

    return row ? mapUser(row) : null;
  }

  findUserByLoginTokenHash(loginTokenHash: string): User | null {
    const row = this.connection
      .prepare<unknown[], UserRow>(
        `
      SELECT
        id,
        username,
        icon,
        role,
        status,
        login_token_hash,
        storage_limit_bytes,
        max_file_size_bytes,
        created_at,
        updated_at,
        deleted_at
      FROM users
      WHERE login_token_hash = ?
      LIMIT 1
    `,
      )
      .get(loginTokenHash);

    return row ? mapUser(row) : null;
  }

  hasAdminUser(): boolean {
    const row = this.connection
      .prepare(
        "SELECT 1 FROM users WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1",
      )
      .get();

    return row !== undefined;
  }

  listSessions(userId: string): Session[] {
    const rows = this.connection.prepare<unknown[], SessionRow>(`
      SELECT id, user_id, session_token_hash, created_at, last_used_at, expires_at, revoked_at, revoked_reason, user_agent, ip_address
      FROM sessions
      WHERE user_id = ?
        AND revoked_at IS NULL
      ORDER BY last_used_at DESC
    `).all(userId);

    return rows.map(mapSession);
  }

  revokeSession(
    sessionId: string,
    revokedAt: string,
    revokedReason: string,
  ): void {
    this.connection
      .prepare(
        `
      UPDATE sessions
      SET revoked_at = COALESCE(revoked_at, ?),
          revoked_reason = COALESCE(revoked_reason, ?)
      WHERE id = ?
    `,
      )
      .run(revokedAt, revokedReason, sessionId);
  }

  revokeSessionsForUser(
    userId: string,
    revokedAt: string,
    revokedReason: string,
  ): number {
    const result = this.connection
      .prepare(
        `
      UPDATE sessions
      SET revoked_at = COALESCE(revoked_at, ?),
          revoked_reason = COALESCE(revoked_reason, ?)
      WHERE user_id = ?
        AND revoked_at IS NULL
    `,
      )
      .run(revokedAt, revokedReason, userId);

    return result.changes;
  }

  touchSession(sessionId: string, lastUsedAt: string): void {
    this.connection
      .prepare(
        `
      UPDATE sessions
      SET last_used_at = ?
      WHERE id = ?
    `,
      )
      .run(lastUsedAt, sessionId);
  }

  updateUser(input: {
    icon: string | null;
    loginTokenHash: string;
    maxFileSizeBytes: number;
    role: User["role"];
    status: User["status"];
    storageLimitBytes: number;
    updatedAt: string;
    userId: string;
  }): void {
    this.connection
      .prepare(
        `
      UPDATE users
      SET icon = ?,
          role = ?,
          status = ?,
          login_token_hash = ?,
          storage_limit_bytes = ?,
          max_file_size_bytes = ?,
          updated_at = ?,
          deleted_at = NULL
      WHERE id = ?
    `,
      )
      .run(
        input.icon,
        input.role,
        input.status,
        input.loginTokenHash,
        input.storageLimitBytes,
        input.maxFileSizeBytes,
        input.updatedAt,
        input.userId,
      );
  }

  updateLoginTokenHash(
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

  updateUsername(
    userId: string,
    username: string,
    updatedAt: string,
  ): void {
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

function mapSession(row: SessionRow): Session {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    ipAddress: row.ip_address,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    sessionTokenHash: row.session_token_hash,
    userAgent: row.user_agent,
    userId: row.user_id,
  };
}

function mapUser(row: UserRow): User {
  return {
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    icon: row.icon,
    id: row.id,
    loginTokenHash: row.login_token_hash,
    maxFileSizeBytes: row.max_file_size_bytes,
    role: row.role,
    status: row.status,
    storageLimitBytes: row.storage_limit_bytes,
    updatedAt: row.updated_at,
    username: row.username,
  };
}
