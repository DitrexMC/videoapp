import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../../src/app/config.js";
import { createApp } from "../../src/app/createApp.js";
describe("auth routes", () => {
    let app;
    let workspaceDirectory;
    beforeEach(async () => {
        workspaceDirectory = await mkdtemp(join(tmpdir(), "videoapp-auth-"));
        app = await createApp(loadConfig({
            BOOTSTRAP_ADMIN_LOGIN_TOKEN: "bootstrap-admin-token",
            DATA_DIR: workspaceDirectory,
            DATABASE_PATH: "app.sqlite",
            LOG_LEVEL: "silent",
            PREVIEW_ROOT: "previews",
            STORAGE_ROOT: "storage",
            TEMP_UPLOAD_ROOT: "uploads"
        }));
    });
    afterEach(async () => {
        await app.close();
        await rm(workspaceDirectory, { force: true, recursive: true });
    });
    it("logs in with the bootstrap login token and returns the current user", async () => {
        const loginResponse = await app.inject({
            method: "POST",
            payload: {
                login_token: "bootstrap-admin-token"
            },
            url: "/auth/login"
        });
        assert.equal(loginResponse.statusCode, 200);
        const loginPayload = loginResponse.json();
        assert.equal(typeof loginPayload.session_token, "string");
        assert.equal(loginPayload.user.username, "admin");
        const meResponse = await app.inject({
            headers: {
                authorization: `Bearer ${loginPayload.session_token}`
            },
            method: "GET",
            url: "/auth/me"
        });
        assert.equal(meResponse.statusCode, 200);
        assert.deepEqual(meResponse.json(), {
            user: loginPayload.user
        });
    });
    it("revokes every session after login token rotation", async () => {
        const loginResponse = await app.inject({
            method: "POST",
            payload: {
                login_token: "bootstrap-admin-token"
            },
            url: "/auth/login"
        });
        const loginPayload = loginResponse.json();
        const rotateResponse = await app.inject({
            headers: {
                authorization: `Bearer ${loginPayload.session_token}`
            },
            method: "POST",
            url: "/auth/login-token/rotate"
        });
        assert.equal(rotateResponse.statusCode, 200);
        const oldSessionResponse = await app.inject({
            headers: {
                authorization: `Bearer ${loginPayload.session_token}`
            },
            method: "GET",
            url: "/auth/me"
        });
        assert.equal(oldSessionResponse.statusCode, 401);
        const newLoginResponse = await app.inject({
            method: "POST",
            payload: {
                login_token: rotateResponse.json().login_token
            },
            url: "/auth/login"
        });
        assert.equal(newLoginResponse.statusCode, 200);
    });
});
//# sourceMappingURL=authRoutes.test.js.map