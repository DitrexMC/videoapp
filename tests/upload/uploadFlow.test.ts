import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { FastifyInstance } from "fastify";

import { loadConfig } from "../../src/app/config.js";
import { createApp } from "../../src/app/createApp.js";

describe("upload flow", () => {
  let app: FastifyInstance;
  let workspaceDirectory: string;
  let sessionToken: string;

  beforeEach(async () => {
    workspaceDirectory = await mkdtemp(join(tmpdir(), "videoapp-upload-"));

    app = await createApp(
      loadConfig({
        BOOTSTRAP_ADMIN_LOGIN_TOKEN: "bootstrap-admin-token",
        DATA_DIR: workspaceDirectory,
        DEFAULT_CHUNK_SIZE_BYTES: 4,
        DEFAULT_MAX_FILE_SIZE_BYTES: 1024,
        LOG_LEVEL: "silent",
        MAX_CHUNK_SIZE_BYTES: 16,
        MIN_CHUNK_SIZE_BYTES: 1,
        PREVIEW_ROOT: "previews",
        STORAGE_ROOT: "storage",
        TEMP_UPLOAD_ROOT: "uploads",
        WORKER_POLL_INTERVAL_MS: 20,
      }),
    );

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        login_token: "bootstrap-admin-token",
      },
      url: "/auth/login",
    });

    sessionToken = loginResponse.json().session_token;
  });

  afterEach(async () => {
    await app.close();
    await rm(workspaceDirectory, { force: true, recursive: true });
  });

  it("uploads, finalizes, and downloads a public file", async () => {
    const initResponse = await app.inject({
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
      method: "POST",
      payload: {
        mime_type: "text/plain",
        name: "hello.txt",
        public: true,
        size: 11,
      },
      url: "/upload/init",
    });

    assert.equal(initResponse.statusCode, 200);

    const initPayload = initResponse.json();
    const chunks = [
      Buffer.from("hell"),
      Buffer.from("o wo"),
      Buffer.from("rld"),
    ];

    for (const [index, chunk] of chunks.entries()) {
      const chunkResponse = await app.inject({
        headers: {
          authorization: `Bearer ${sessionToken}`,
          "content-type": "application/octet-stream",
          "x-chunk-size": String(initPayload.chunkSize),
          "x-file-id": initPayload.fileId,
          "x-total-chunks": String(initPayload.maxChunks),
          "x-total-size": "11",
        },
        method: "PUT",
        payload: chunk,
        url: `/upload/${initPayload.uploadId}/${index}`,
      });

      assert.equal(chunkResponse.statusCode, 200);
    }

    const completeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
      method: "POST",
      payload: {
        fileId: initPayload.fileId,
        totalChunks: initPayload.maxChunks,
        totalSize: 11,
        uploadId: initPayload.uploadId,
      },
      url: "/upload/complete",
    });

    assert.equal(completeResponse.statusCode, 202);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const statusResponse = await app.inject({
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
      method: "GET",
      url: `/upload/${initPayload.uploadId}/status`,
    });

    assert.equal(statusResponse.statusCode, 200);
    assert.equal(statusResponse.json().status, "ready");

    const downloadResponse = await app.inject({
      method: "GET",
      url: `/files/${initPayload.fileId}/download`,
    });

    assert.equal(downloadResponse.statusCode, 200);
    assert.equal(downloadResponse.body, "hello world");
  });

  it("downloads a private file via session cookie", async () => {
    const initResponse = await app.inject({
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
      method: "POST",
      payload: {
        mime_type: "text/plain",
        name: "private.txt",
        public: false,
        size: 12,
      },
      url: "/upload/init",
    });

    assert.equal(initResponse.statusCode, 200);

    const initPayload = initResponse.json();
    const chunkResponse = await app.inject({
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/octet-stream",
        "x-chunk-size": String(initPayload.chunkSize),
        "x-file-id": initPayload.fileId,
        "x-total-chunks": String(initPayload.maxChunks),
        "x-total-size": "12",
      },
      method: "PUT",
      payload: Buffer.from("private file"),
      url: `/upload/${initPayload.uploadId}/0`,
    });

    assert.equal(chunkResponse.statusCode, 200);

    const completeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
      method: "POST",
      payload: {
        fileId: initPayload.fileId,
        totalChunks: initPayload.maxChunks,
        totalSize: 12,
        uploadId: initPayload.uploadId,
      },
      url: "/upload/complete",
    });

    assert.equal(completeResponse.statusCode, 202);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        login_token: "bootstrap-admin-token",
      },
      url: "/auth/login",
    });

    assert.equal(loginResponse.statusCode, 200);

    const setCookieHeader = loginResponse.headers["set-cookie"];
    const sessionCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader[0]
      : setCookieHeader;

    assert.equal(typeof sessionCookie, "string");
    const resolvedSessionCookie = sessionCookie as string;

    assert.match(resolvedSessionCookie, /^va_session=/);

    const downloadResponse = await app.inject({
      headers: {
        cookie: resolvedSessionCookie,
      },
      method: "GET",
      url: `/files/${initPayload.fileId}/download`,
    });

    assert.equal(downloadResponse.statusCode, 200);
    assert.equal(downloadResponse.body, "private file");
  });
});
