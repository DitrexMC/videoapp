import { AuthorizationError } from "../../../shared/domain/errors.js";

export type UserRole = "admin" | "user";
export type UserStatus = "active" | "disabled";

export interface User {
  createdAt: string;
  deletedAt: string | null;
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

export interface PublicUser {
  icon: string | null;
  max_file_size_bytes: number;
  role: UserRole;
  storage_limit_bytes: number;
  status: UserStatus;
  user_id: string;
  username: string;
}

export function assertUserIsActive(user: User): void {
  if (user.status === "disabled") {
    throw new AuthorizationError("無効化されたユーザーです。", {
      reason: "user_disabled",
      userId: user.id,
    });
  }
}

export function isAdmin(user: User): boolean {
  return user.role === "admin";
}

export function toPublicUser(user: User): PublicUser {
  return {
    icon: user.icon,
    max_file_size_bytes: user.maxFileSizeBytes,
    role: user.role,
    storage_limit_bytes: user.storageLimitBytes,
    status: user.status,
    user_id: user.id,
    username: user.username,
  };
}
