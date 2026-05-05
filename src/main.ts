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
  console.error(error);
  process.exitCode = 1;
});