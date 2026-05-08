import type { AuthApplicationService } from "../../identity/application/AuthApplicationService.js";
import { isAdmin, type UserRole } from "../../identity/domain/User.js";
import type { Clock } from "../../../shared/domain/clock.js";
import type { ServicePolicies } from "../../../shared/domain/ServicePolicies.js";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../shared/domain/errors.js";
import { generateId } from "../../../shared/domain/id.js";
import type { TokenService } from "../../../shared/infrastructure/security/TokenService.js";
import type { LocalFileStorage } from "../../../shared/infrastructure/storage/LocalFileStorage.js";
import type { AdministrationRepository } from "./AdministrationRepository.js";

export interface AdministrationServiceDependencies {
  administrationRepository: AdministrationRepository;
  authService: AuthApplicationService;
  clock: Clock;
  storage: LocalFileStorage;
  tokenService: TokenService;
}

export class AdministrationService {
  private readonly administrationRepository: AdministrationRepository;
  private readonly authService: AuthApplicationService;
  private readonly clock: Clock;
  private readonly storage: LocalFileStorage;
  private readonly tokenService: TokenService;

  constructor(dependencies: AdministrationServiceDependencies) {
    this.administrationRepository = dependencies.administrationRepository;
    this.authService = dependencies.authService;
    this.clock = dependencies.clock;
    this.storage = dependencies.storage;
    this.tokenService = dependencies.tokenService;
  }

  createUser(
    sessionToken: string,
    input: { icon?: string | null; role?: UserRole; username: string },
  ) {
    this.requireAdmin(sessionToken);
    const policies = this.administrationRepository.findPolicies();
    const normalizedUsername = input.username.trim();

    if (normalizedUsername.length === 0) {
      throw new ValidationError("username は必須です。");
    }

    const loginToken = this.tokenService.issueToken("login");
    const timestamp = this.clock.nowIsoString();

    return {
      login_token: loginToken,
      user: this.administrationRepository.createUser({
        createdAt: timestamp,
        icon: input.icon ?? null,
        id: generateId(),
        loginTokenHash: this.tokenService.hash(loginToken),
        maxFileSizeBytes: policies.defaultMaxFileSizeBytes,
        role: input.role ?? "user",
        status: "active",
        storageLimitBytes: policies.defaultStorageLimitBytes,
        updatedAt: timestamp,
        username: normalizedUsername,
      }),
    };
  }

  deleteUser(sessionToken: string, userId: string): void {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);
    const timestamp = this.clock.nowIsoString();

    this.administrationRepository.revokeSessionsForUser(
      userId,
      timestamp,
      "admin_deleted_user",
    );
    this.administrationRepository.deleteUser(userId, timestamp);
  }

  disableUser(sessionToken: string, userId: string): void {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);
    this.administrationRepository.setUserStatus(
      userId,
      "disabled",
      this.clock.nowIsoString(),
    );
  }

  enableUser(sessionToken: string, userId: string): void {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);
    this.administrationRepository.setUserStatus(
      userId,
      "active",
      this.clock.nowIsoString(),
    );
  }

  getFile(sessionToken: string, fileId: string) {
    this.requireAdmin(sessionToken);
    const file = this.administrationRepository.findAdminFileById(fileId);

    if (!file) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    return file;
  }

  listFiles(sessionToken: string, search?: string) {
    this.requireAdmin(sessionToken);
    return this.administrationRepository.listAdminFiles(search);
  }

  listGroups(sessionToken: string, search?: string) {
    this.requireAdmin(sessionToken);
    return this.administrationRepository.listAdminGroups(search);
  }

  deleteGroup(sessionToken: string, groupId: string): void {
    this.requireAdmin(sessionToken);
    this.administrationRepository.deleteAdminGroup(groupId);
  }

  getPolicies(sessionToken: string): ServicePolicies {
    this.requireAdmin(sessionToken);
    return this.administrationRepository.findPolicies();
  }

  getUserSessions(sessionToken: string, userId: string) {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);
    return this.administrationRepository.listUserSessions(userId);
  }

  listUsers(sessionToken: string) {
    this.requireAdmin(sessionToken);
    return this.administrationRepository.listUsers();
  }

  resetUserIcon(sessionToken: string, userId: string): void {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);
    this.administrationRepository.resetUserIcon(
      userId,
      this.clock.nowIsoString(),
    );
  }

  rotateUserLoginToken(sessionToken: string, userId: string) {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);
    const loginToken = this.tokenService.issueToken("login");
    const timestamp = this.clock.nowIsoString();

    this.administrationRepository.rotateLoginToken(
      userId,
      this.tokenService.hash(loginToken),
      timestamp,
    );
    this.administrationRepository.revokeSessionsForUser(
      userId,
      timestamp,
      "admin_rotated_login_token",
    );

    return {
      login_token: loginToken,
    };
  }

  setFileExpiration(
    sessionToken: string,
    fileId: string,
    expiresAt: string | null,
  ): void {
    this.requireAdmin(sessionToken);
    const file = this.administrationRepository.findAdminFileById(fileId);

    if (!file) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    this.administrationRepository.setFileExpiration(
      fileId,
      expiresAt,
      this.clock.nowIsoString(),
    );
  }

  setFileVisibility(
    sessionToken: string,
    fileId: string,
    isPublic: boolean,
  ): void {
    this.requireAdmin(sessionToken);
    const file = this.administrationRepository.findAdminFileById(fileId);

    if (!file) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    if (!file.public && isPublic) {
      throw new ValidationError(
        "管理者は他人の非公開ファイルを公開に変更できません。",
      );
    }

    this.administrationRepository.setFileVisibility(
      fileId,
      isPublic,
      this.clock.nowIsoString(),
    );
  }

  async softDeleteFile(sessionToken: string, fileId: string): Promise<void> {
    this.requireAdmin(sessionToken);
    const file = this.administrationRepository.findAdminFileById(fileId);

    if (!file) {
      throw new NotFoundError("ファイルが見つかりません。");
    }

    this.administrationRepository.softDeleteFile(
      fileId,
      this.clock.nowIsoString(),
    );

    if (file.storagePath) {
      const remainingRefs = this.administrationRepository.countNonDeletedFilesByStoragePath(file.storagePath);
      if (remainingRefs === 0) {
        await this.storage.removeFile(file.storagePath);
      }
    }
    if (file.previewPath) {
      await this.storage.removeFile(file.previewPath);
    }
  }

  updatePolicies(
    sessionToken: string,
    input: Partial<Omit<ServicePolicies, "updatedAt">>,
  ): ServicePolicies {
    this.requireAdmin(sessionToken);
    const currentPolicies = this.administrationRepository.findPolicies();
    const nextPolicies: ServicePolicies = {
      ...currentPolicies,
      ...input,
      updatedAt: this.clock.nowIsoString(),
    };

    validatePolicyConsistency(nextPolicies);

    this.administrationRepository.updatePolicies(nextPolicies);

    return nextPolicies;
  }

  updateUserLimits(
    sessionToken: string,
    userId: string,
    input: { maxFileSizeBytes?: number; storageLimitBytes?: number },
  ): void {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);

    this.administrationRepository.updateUserLimits(
      userId,
      input.maxFileSizeBytes ?? null,
      input.storageLimitBytes ?? null,
      this.clock.nowIsoString(),
    );
  }

  updateUsername(sessionToken: string, userId: string, username: string): void {
    this.requireExistingUser(this.requireAdmin(sessionToken), userId);
    const normalizedUsername = username.trim();

    if (normalizedUsername.length === 0) {
      throw new ValidationError("username は必須です。");
    }

    this.administrationRepository.updateUsername(
      userId,
      normalizedUsername,
      this.clock.nowIsoString(),
    );
  }

  private requireAdmin(sessionToken: string) {
    const actor = this.authService.authenticate(sessionToken).user;

    if (!isAdmin(actor)) {
      throw new AuthorizationError("管理者権限が必要です。");
    }

    return actor;
  }

  private requireExistingUser(actor: { id: string }, userId: string) {
    const user = this.administrationRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundError("ユーザーが見つかりません。");
    }

    if (actor.id === userId && user.role === "admin") {
      throw new ValidationError("自分自身の管理操作は制限されています。");
    }

    return user;
  }
}

function validatePolicyConsistency(policies: ServicePolicies): void {
  if (policies.minChunkSizeBytes > policies.maxChunkSizeBytes) {
    throw new ValidationError(
      "minChunkSizeBytes は maxChunkSizeBytes 以下である必要があります。",
    );
  }

  if (
    policies.defaultChunkSizeBytes < policies.minChunkSizeBytes ||
    policies.defaultChunkSizeBytes > policies.maxChunkSizeBytes
  ) {
    throw new ValidationError(
      "defaultChunkSizeBytes は min/max 範囲内である必要があります。",
    );
  }

  if (
    policies.defaultFileExpiryDays !== null &&
    policies.maxFileExpiryDays !== null &&
    policies.defaultFileExpiryDays > policies.maxFileExpiryDays
  ) {
    throw new ValidationError(
      "defaultFileExpiryDays は maxFileExpiryDays 以下である必要があります。",
    );
  }
}
