export interface Session {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  lastUsedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  sessionTokenHash: string;
  userAgent: string | null;
  userId: string;
}