export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly statusCode: number;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "認証に失敗しました。", details?: unknown) {
    super(message, 401, "authentication_error", details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "この操作を実行する権限がありません。", details?: unknown) {
    super(message, 403, "authorization_error", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "conflict_error", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, "not_found", details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "validation_error", details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}