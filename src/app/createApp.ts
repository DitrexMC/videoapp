import staticPlugin from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { resolve } from "node:path";
import { ZodError } from "zod";
import type { FastifyServerOptions } from "fastify";
import process from "node:process";

import { registerAdminRoutes } from "../modules/administration/presentation/registerAdminRoutes.js";
import { registerFileRoutes } from "../modules/files/presentation/registerFileRoutes.js";
import { registerAuthRoutes } from "../modules/identity/presentation/registerAuthRoutes.js";
import { registerNewsRoutes } from "../modules/news/presentation/registerNewsRoutes.js";
import { registerUploadRoutes } from "../modules/uploads/presentation/registerUploadRoutes.js";
import { isAppError } from "../shared/domain/errors.js";
import type { AppConfig } from "./config.js";
import { createRuntime } from "./runtime.js";

export async function createApp(config: AppConfig): Promise<FastifyInstance> {
  const runtime = await createRuntime(config);

  const loggerOptions: FastifyServerOptions["logger"] = process.stdout.isTTY
    ? {
        level: config.LOG_LEVEL,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,reqId,action",
            messageFormat: "{if action}[{action}] {end}{msg}",
          },
        },
      }
    : {
        level: config.LOG_LEVEL,
      };

  const app = Fastify({
    bodyLimit: Math.max(config.MAX_CHUNK_SIZE_BYTES, 1024 * 1024),
    disableRequestLogging: true,
    logger: loggerOptions,
  });

  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send({
        code: error.code,
        details: error.details,
        message: error.message,
        requestId: request.id,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "validation_error",
        details: error.flatten(),
        message: "入力値が不正です。",
        requestId: request.id,
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
    ) {
      const errorCode =
        "code" in error && typeof error.code === "string"
          ? error.code
          : "http_error";
      const errorMessage =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "HTTPエラーが発生しました。";

      return reply.status(error.statusCode).send({
        code: errorCode,
        message: errorMessage,
        requestId: request.id,
      });
    }

    request.log.error(error);

    return reply.status(500).send({
      code: "internal_server_error",
      message: "予期しないエラーが発生しました。",
      requestId: request.id,
    });
  });

  app.get("/health/live", async () => ({
    status: "ok",
  }));

  app.get("/health/ready", async () => ({
    database: runtime.database.ping(),
    status: "ok",
  }));

  app.get("/config", async () => {
    const p = runtime.policyRepository.findPolicies();
    return {
      devMode: config.DEV_MODE,
      defaultFileExpiryDays: p.defaultFileExpiryDays,
      maxFileExpiryDays: p.maxFileExpiryDays,
    };
  });

  await app.register(staticPlugin, {
    root: resolve(process.cwd(), "public"),
    prefix: "/",
    decorateReply: false,
  });

  await registerAuthRoutes(app, runtime);
  await registerUploadRoutes(app, runtime);
  await registerFileRoutes(app, runtime);
  await registerAdminRoutes(app, runtime);
  await registerNewsRoutes(app, runtime);

  app.addHook("onClose", async () => {
    await runtime.worker.stop();
    runtime.database.close();
  });

  return app;
}
