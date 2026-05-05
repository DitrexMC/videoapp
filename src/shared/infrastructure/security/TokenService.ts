import { createHash, randomBytes } from "node:crypto";

export type TokenPurpose = "login" | "session";

export class TokenService {
  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  issueToken(purpose: TokenPurpose): string {
    const prefix = purpose === "login" ? "lt" : "st";

    return `${prefix}_${randomBytes(32).toString("base64url")}`;
  }
}