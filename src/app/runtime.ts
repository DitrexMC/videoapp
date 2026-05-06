import type { AppConfig } from "./config.js";
import { AdministrationService } from "../modules/administration/application/AdministrationService.js";
import { SqliteAdministrationRepository } from "../modules/administration/infrastructure/SqliteAdministrationRepository.js";
import { FileApplicationService } from "../modules/files/application/FileApplicationService.js";
import { SqliteFileRepository } from "../modules/files/infrastructure/SqliteFileRepository.js";
import { AuthApplicationService } from "../modules/identity/application/AuthApplicationService.js";
import { SqliteIdentityRepository } from "../modules/identity/infrastructure/SqliteIdentityRepository.js";
import { BackgroundWorker } from "../modules/processing/application/BackgroundWorker.js";
import { UploadApplicationService } from "../modules/uploads/application/UploadApplicationService.js";
import { SqliteUploadRepository } from "../modules/uploads/infrastructure/SqliteUploadRepository.js";
import { SystemClock } from "../shared/domain/clock.js";
import { generateId } from "../shared/domain/id.js";
import { SqliteDatabase } from "../shared/infrastructure/database/SqliteDatabase.js";
import { SqliteServicePolicyRepository } from "../shared/infrastructure/database/SqliteServicePolicyRepository.js";
import { TokenService } from "../shared/infrastructure/security/TokenService.js";
import { LocalFileStorage } from "../shared/infrastructure/storage/LocalFileStorage.js";

export interface AppRuntime {
  administrationService: AdministrationService;
  authService: AuthApplicationService;
  clock: SystemClock;
  config: AppConfig;
  database: SqliteDatabase;
  fileService: FileApplicationService;
  identityRepository: SqliteIdentityRepository;
  policyRepository: SqliteServicePolicyRepository;
  tokenService: TokenService;
  uploadService: UploadApplicationService;
  worker: BackgroundWorker;
}

export async function createRuntime(config: AppConfig): Promise<AppRuntime> {
  const clock = new SystemClock();
  const databasePath = config.DATABASE_PATH ?? `${config.DATA_DIR}/app.sqlite`;
  const database = new SqliteDatabase(databasePath);
  const tokenService = new TokenService();

  database.migrate();
  database.seedDefaultPolicy({
    defaultChunkSizeBytes: config.DEFAULT_CHUNK_SIZE_BYTES,
    defaultFileExpiryDays: config.DEFAULT_FILE_EXPIRY_DAYS,
    defaultMaxFileSizeBytes: config.DEFAULT_MAX_FILE_SIZE_BYTES,
    defaultStorageLimitBytes: config.DEFAULT_STORAGE_LIMIT_BYTES,
    maxChunkSizeBytes: config.MAX_CHUNK_SIZE_BYTES,
    maxFileExpiryDays: config.MAX_FILE_EXPIRY_DAYS,
    maxZipFileCount: config.MAX_ZIP_FILE_COUNT,
    maxZipTotalBytes: config.MAX_ZIP_TOTAL_BYTES,
    minChunkSizeBytes: config.MIN_CHUNK_SIZE_BYTES,
    sessionTtlSeconds: config.SESSION_TTL_SECONDS,
    updatedAt: clock.nowIsoString(),
  });

  const identityRepository = new SqliteIdentityRepository(database.connection);
  const administrationRepository = new SqliteAdministrationRepository(
    database.connection,
  );
  const servicePolicyRepository = new SqliteServicePolicyRepository(
    database.connection,
  );
  const fileRepository = new SqliteFileRepository(database.connection);
  const uploadRepository = new SqliteUploadRepository(database.connection);
  const storage = new LocalFileStorage({
    previewRoot: config.PREVIEW_ROOT ?? `${config.DATA_DIR}/previews`,
    storageRoot: config.STORAGE_ROOT ?? `${config.DATA_DIR}/storage`,
    tempUploadRoot: config.TEMP_UPLOAD_ROOT ?? `${config.DATA_DIR}/uploads`,
  });

  await storage.ensureBaseDirectories();
  const runtimeStateReset = database.resetRuntimeState(clock.nowIsoString());
  await storage.clearTransientUploadRoot();
  await Promise.all([
    ...runtimeStateReset.previewPaths.map((filePath) =>
      storage.removeFile(filePath),
    ),
    ...runtimeStateReset.storagePaths.map((filePath) =>
      storage.removeFile(filePath),
    ),
  ]);

  if (config.BOOTSTRAP_ADMIN_LOGIN_TOKEN) {
    const timestamp = clock.nowIsoString();
    const hashedLoginToken = tokenService.hash(
      config.BOOTSTRAP_ADMIN_LOGIN_TOKEN,
    );
    const existingAdminUser = identityRepository.findUserByUsername(
      config.BOOTSTRAP_ADMIN_USERNAME,
    );

    if (!existingAdminUser) {
      identityRepository.createUser({
        createdAt: timestamp,
        icon: config.BOOTSTRAP_ADMIN_ICON,
        id: generateId(),
        loginTokenHash: hashedLoginToken,
        maxFileSizeBytes: config.DEFAULT_MAX_FILE_SIZE_BYTES,
        role: "admin",
        status: "active",
        storageLimitBytes: config.DEFAULT_STORAGE_LIMIT_BYTES,
        updatedAt: timestamp,
        username: config.BOOTSTRAP_ADMIN_USERNAME,
      });
    }
  }

  const authService = new AuthApplicationService({
    clock,
    identityRepository,
    policyRepository: servicePolicyRepository,
    tokenService,
  });

  const uploadService = new UploadApplicationService({
    authService,
    clock,
    fileRepository,
    policyRepository: servicePolicyRepository,
    storage,
    uploadRepository,
  });

  const fileService = new FileApplicationService({
    authService,
    clock,
    fileRepository,
    policyRepository: servicePolicyRepository,
    storage,
  });

  const worker = new BackgroundWorker({
    clock,
    fileRepository,
    pollIntervalMilliseconds: config.WORKER_POLL_INTERVAL_MS,
    storage,
    uploadRepository,
  });

  if (config.EMBED_WORKER) {
    worker.start();
  }

  const administrationService = new AdministrationService({
    administrationRepository,
    authService,
    clock,
    tokenService,
  });

  return {
    administrationService,
    authService,
    clock,
    config,
    database,
    fileService,
    identityRepository,
    policyRepository: servicePolicyRepository,
    tokenService,
    uploadService,
    worker,
  };
}
