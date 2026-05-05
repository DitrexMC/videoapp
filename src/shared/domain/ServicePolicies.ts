export interface ServicePolicies {
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