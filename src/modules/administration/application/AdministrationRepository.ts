import type { UserRole, UserStatus } from "../../identity/domain/User.js";
import type { FileRecord } from "../../files/domain/FileRecord.js";
import type { ServicePolicies } from "../../../shared/domain/ServicePolicies.js";

export interface AdminFileRecord extends FileRecord {
  ownerUsername: string;
}

export interface AdminSessionRecord {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  lastUsedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  userAgent: string | null;
  userId: string;
}

export interface AdminUserRecord {
  createdAt: string;
  deletedAt: string | null;
  fileCount: number;
  icon: string | null;
  id: string;
  maxFileSizeBytes: number;
  role: UserRole;
  status: UserStatus;
  storageLimitBytes: number;
  storageUsedBytes: number;
  updatedAt: string;
  username: string;
}

export interface CreateManagedUserInput {
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

export interface AdministrationRepository {
  createUser(input: CreateManagedUserInput): AdminUserRecord;
  deleteUser(userId: string, updatedAt: string): void;
  findAdminFileById(fileId: string): AdminFileRecord | null;
  listAdminFiles(search?: string): AdminFileRecord[];
  findPolicies(): ServicePolicies;
  findUserById(userId: string): AdminUserRecord | null;
  listUserSessions(userId: string): AdminSessionRecord[];
  listUsers(): AdminUserRecord[];
  revokeSessionsForUser(userId: string, revokedAt: string, reason: string): void;
  resetUserIcon(userId: string, updatedAt: string): void;
  rotateLoginToken(userId: string, loginTokenHash: string, updatedAt: string): void;
  setFileExpiration(fileId: string, expiresAt: string | null, updatedAt: string): void;
  setFileVisibility(fileId: string, isPublic: boolean, updatedAt: string): void;
  setUserStatus(userId: string, status: UserStatus, updatedAt: string): void;
  softDeleteFile(fileId: string, updatedAt: string): void;
  updatePolicies(policies: ServicePolicies): void;
  updateUserLimits(userId: string, maxFileSizeBytes: number | null, storageLimitBytes: number | null, updatedAt: string): void;
  updateUsername(userId: string, username: string, updatedAt: string): void;
}