import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { FastifyInstance } from "fastify";

import { loadConfig } from "../../src/app/config.js";
import { createApp } from "../../src/app/createApp.js";

describe("admin routes", () => {
  let adminSessionToken: string;
  let app: FastifyInstance;
  let workspaceDirectory: string;

  beforeEach(async () => {
    workspaceDirectory = await mkdtemp(join(tmpdir(), "videoapp-admin-"));

    app = await createApp(loadConfig({
      BOOTSTRAP_ADMIN_LOGIN_TOKEN: "bootstrap-admin-token",
      DATA_DIR: workspaceDirectory,
      DEFAULT_MAX_FILE_SIZE_BYTES: 1024,
      LOG_LEVEL: "silent",
      PREVIEW_ROOT: "previews",
      STORAGE_ROOT: "storage",
      TEMP_UPLOAD_ROOT: "uploads"
    }));

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        login_token: "bootstrap-admin-token"
      },
      url: "/auth/login"
    });

    adminSessionToken = loginResponse.json().session_token;
  });

  afterEach(async () => {
    await app.close();
    await rm(workspaceDirectory, { force: true, recursive: true });
  });

  it("creates a user, disables the account, and revokes its active session", async () => {
    const createUserResponse = await app.inject({
      headers: {
        authorization: `Bearer ${adminSessionToken}`
      },
      method: "POST",
      payload: {
        username: "member"
      },
      url: "/admin/users"
    });

    assert.equal(createUserResponse.statusCode, 200);

    const createUserPayload = createUserResponse.json();

    const memberLoginResponse = await app.inject({
      method: "POST",
      payload: {
        login_token: createUserPayload.login_token
      },
      url: "/auth/login"
    });

    assert.equal(memberLoginResponse.statusCode, 200);

    const memberSessionToken = memberLoginResponse.json().session_token;

    const disableResponse = await app.inject({
      headers: {
        authorization: `Bearer ${adminSessionToken}`
      },
      method: "PATCH",
      url: `/admin/users/${createUserPayload.user.id}/disable`
    });

    assert.equal(disableResponse.statusCode, 204);

    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${memberSessionToken}`
      },
      method: "GET",
      url: "/auth/me"
    });

    assert.equal(meResponse.statusCode, 403);

    const secondLoginResponse = await app.inject({
      method: "POST",
      payload: {
        login_token: createUserPayload.login_token
      },
      url: "/auth/login"
    });

    assert.equal(secondLoginResponse.statusCode, 403);
  });
});