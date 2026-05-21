import { createApp } from "./app/createApp.js";
import { loadConfig } from "./app/config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);

  await app.listen({
    host: config.APP_HOST,
    port: config.APP_PORT
  });
}

main().catch((error: unknown) => {
  const ts = new Date().toISOString();
  const message =
    error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`[${ts}] FATAL: ${message}\n`);
  process.exitCode = 1;
});