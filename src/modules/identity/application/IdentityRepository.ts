import type { Session } from "../domain/Session.js";
import type { User, UserRole, UserStatus } from "../domain/User.js";

export interface CreateSessionInput {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  lastUsedAt: string;
  sessionTokenHash: string;
  userAgent: string | null;
  userId: string;
}

export interface CreateUserInput {
  createdAt: string;
  icon: string | null;
  id: string;
  loginTokenHash: string;
  maxFileSizeBytes: number;
  role: UserRole;
  status: UserStatus;
  storageLimitBytes: number;
  updatedAt: string;
  username: string;
}

export interface IdentityRepository {
  createSession(input: CreateSessionInput): Session;
  createUser(input: CreateUserInput): User;
  findSessionByTokenHash(sessionTokenHash: string): Session | null;
  findUserById(userId: string): User | null;
  findUserByUsername(username: string): User | null;
  findUserByLoginTokenHash(loginTokenHash: string): User | null;
  hasAdminUser(): boolean;
  listSessions(userId: string): Session[];
  revokeSession(
    sessionId: string,
    revokedAt: string,
    revokedReason: string,
  ): void;
  revokeSessionsForUser(
    userId: string,
    revokedAt: string,
    revokedReason: string,
  ): number;
  touchSession(sessionId: string, lastUsedAt: string): void;
  updateLoginTokenHash(
    userId: string,
    loginTokenHash: string,
    updatedAt: string,
  ): void;
  updateUsername(
    userId: string,
    username: string,
    updatedAt: string,
  ): void;
}
