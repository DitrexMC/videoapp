import type { Clock } from "../../../shared/domain/clock.js";
import { AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from "../../../shared/domain/errors.js";
import { generateId } from "../../../shared/domain/id.js";
import type { ServicePolicyRepository } from "../../../shared/application/ServicePolicyRepository.js";
import type { TokenService } from "../../../shared/infrastructure/security/TokenService.js";
import type { Session } from "../domain/Session.js";
import { assertUserIsActive, toPublicUser, type PublicUser, type User } from "../domain/User.js";
import type { IdentityRepository } from "./IdentityRepository.js";

export interface AuthenticatedContext {
  session: Session;
  user: User;
}

export interface AuthApplicationServiceDependencies {
  clock: Clock;
  identityRepository: IdentityRepository;
  policyRepository: ServicePolicyRepository;
  tokenService: TokenService;
}

export interface LoginResult {
  session_token: string;
  user: PublicUser;
}

export class AuthApplicationService {
  private readonly clock: Clock;
  private readonly identityRepository: IdentityRepository;
  private readonly policyRepository: ServicePolicyRepository;
  private readonly tokenService: TokenService;

  constructor(dependencies: AuthApplicationServiceDependencies) {
    this.clock = dependencies.clock;
    this.identityRepository = dependencies.identityRepository;
    this.policyRepository = dependencies.policyRepository;
    this.tokenService = dependencies.tokenService;
  }

  authenticate(sessionToken: string): AuthenticatedContext {
    const tokenHash = this.tokenService.hash(sessionToken);
    const session = this.identityRepository.findSessionByTokenHash(tokenHash);

    if (!session || session.revokedAt) {
      throw new AuthenticationError();
    }

    const now = this.clock.now();

    if (new Date(session.expiresAt).getTime() <= now.getTime()) {
      this.identityRepository.revokeSession(session.id, now.toISOString(), "session_expired");
      throw new AuthenticationError("セッションの有効期限が切れています。");
    }

    const user = this.identityRepository.findUserById(session.userId);

    if (!user || user.deletedAt) {
      throw new AuthenticationError();
    }

    if (user.status === "disabled") {
      this.identityRepository.revokeSessionsForUser(user.id, now.toISOString(), "user_disabled");
      throw new AuthorizationError("このユーザーは現在利用できません。", {
        reason: "user_disabled",
        userId: user.id
      });
    }

    this.identityRepository.touchSession(session.id, now.toISOString());

    return {
      session: {
        ...session,
        lastUsedAt: now.toISOString()
      },
      user
    };
  }

  getCurrentUser(sessionToken: string): PublicUser {
    return toPublicUser(this.authenticate(sessionToken).user);
  }

  login(loginToken: string, context: { ipAddress: string | null; userAgent: string | null }): LoginResult {
    const normalizedToken = loginToken.trim();

    if (normalizedToken.length === 0) {
      throw new AuthenticationError();
    }

    const loginTokenHash = this.tokenService.hash(normalizedToken);
    const user = this.identityRepository.findUserByLoginTokenHash(loginTokenHash);

    if (!user || user.deletedAt) {
      throw new AuthenticationError();
    }

    assertUserIsActive(user);

    const now = this.clock.now();
    const sessionTtlSeconds = this.policyRepository.findPolicies().sessionTtlSeconds;
    const sessionToken = this.tokenService.issueToken("session");
    const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000).toISOString();

    this.identityRepository.createSession({
      createdAt: now.toISOString(),
      expiresAt,
      id: generateId(),
      ipAddress: context.ipAddress,
      lastUsedAt: now.toISOString(),
      sessionTokenHash: this.tokenService.hash(sessionToken),
      userAgent: context.userAgent,
      userId: user.id
    });

    return {
      session_token: sessionToken,
      user: toPublicUser(user)
    };
  }

  logout(sessionToken: string): void {
    const { session } = this.authenticate(sessionToken);
    this.identityRepository.revokeSession(session.id, this.clock.nowIsoString(), "logout");
  }

  logoutAll(sessionToken: string): void {
    const { user } = this.authenticate(sessionToken);
    this.identityRepository.revokeSessionsForUser(user.id, this.clock.nowIsoString(), "logout_all");
  }

  rotateLoginToken(sessionToken: string): { login_token: string; user: PublicUser } {
    const { user } = this.authenticate(sessionToken);
    const now = this.clock.nowIsoString();
    const newLoginToken = this.tokenService.issueToken("login");

    this.identityRepository.updateLoginTokenHash(user.id, this.tokenService.hash(newLoginToken), now);
    this.identityRepository.revokeSessionsForUser(user.id, now, "login_token_rotated");

    return {
      login_token: newLoginToken,
      user: toPublicUser(user)
    };
  }

  getSessions(sessionToken: string) {
    const { user } = this.authenticate(sessionToken);
    return this.identityRepository.listSessions(user.id);
  }

  revokeUserSession(sessionToken: string, sessionId: string): void {
    const { user, session } = this.authenticate(sessionToken);
    const targetSession = this.identityRepository.listSessions(user.id).find(s => s.id === sessionId);
    if (!targetSession || targetSession.userId !== user.id) {
      throw new NotFoundError("セッションが見つかりません。");
    }
    if (targetSession.id === session.id) {
      throw new ValidationError("現在のこのセッション自体は削除できません。ログアウトを使用してください。");
    }
    this.identityRepository.revokeSession(sessionId, this.clock.nowIsoString(), "user_revoked");
  }

  updateUsername(sessionToken: string, username: string) {
    const { user } = this.authenticate(sessionToken);
    const normalized = username.trim();
    if (normalized.length === 0) {
      throw new ValidationError("ユーザー名は必須です。");
    }
    this.identityRepository.updateUsername(user.id, normalized, this.clock.nowIsoString());
  }
}