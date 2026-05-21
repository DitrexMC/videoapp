import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

loadDotEnv();

const booleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const nullableNumberSchema = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return null;
  }

  return value;
}, z.coerce.number().int().positive().nullable());

const environmentSchema = z.object({
  APP_HOST: z.string().default("127.0.0.1"),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DEV_MODE: booleanSchema.default(false),
  DATA_DIR: z.string().default("data"),
  DATABASE_PATH: z.string().optional(),
  STORAGE_ROOT: z.string().optional(),
  TEMP_UPLOAD_ROOT: z.string().optional(),
  PREVIEW_ROOT: z.string().optional(),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  DEFAULT_STORAGE_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(50 * 1024 * 1024 * 1024),
  DEFAULT_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024 * 1024),
  MAX_ZIP_TOTAL_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024 * 1024),
  MAX_ZIP_FILE_COUNT: z.coerce.number().int().positive().default(500),
  DEFAULT_CHUNK_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  MIN_CHUNK_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
  MAX_CHUNK_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(50 * 1024 * 1024),
  MAX_CHUNK_CONCURRENCY_PER_USER: z.coerce
    .number()
    .int()
    .positive()
    .default(12),
  MAX_FINALIZE_JOBS: z.coerce
    .number()
    .int()
    .positive()
    .default(8),
  DEFAULT_FILE_EXPIRY_DAYS: nullableNumberSchema.default(null),
  MAX_FILE_EXPIRY_DAYS: nullableNumberSchema.default(null),
  EMBED_WORKER: booleanSchema.default(true),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  BOOTSTRAP_ADMIN_USERNAME: z.string().min(1).default("admin"),
  BOOTSTRAP_ADMIN_ICON: z.string().default(""),
  BOOTSTRAP_ADMIN_LOGIN_TOKEN: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(
  source: Record<string, unknown> = process.env,
): AppConfig {
  const parsedConfiguration = environmentSchema.parse({
    ...source,
    DEV_MODE: source.DEV_MODE ?? source.DEVMODE,
  });
  const dataDirectoryPath = resolve(
    process.cwd(),
    parsedConfiguration.DATA_DIR,
  );

  return {
    ...parsedConfiguration,
    DATA_DIR: dataDirectoryPath,
    DATABASE_PATH: resolve(
      dataDirectoryPath,
      parsedConfiguration.DATABASE_PATH ?? "app.sqlite",
    ),
    STORAGE_ROOT: resolve(
      dataDirectoryPath,
      parsedConfiguration.STORAGE_ROOT ?? "storage",
    ),
    TEMP_UPLOAD_ROOT: resolve(
      dataDirectoryPath,
      parsedConfiguration.TEMP_UPLOAD_ROOT ?? "uploads",
    ),
    PREVIEW_ROOT: resolve(
      dataDirectoryPath,
      parsedConfiguration.PREVIEW_ROOT ?? "previews",
    ),
  };
}
