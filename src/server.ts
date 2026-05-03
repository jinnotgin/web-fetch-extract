import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = buildApp({ config });

try {
  await app.listen({
    host: "0.0.0.0",
    port: config.PORT
  });
} catch (error) {
  app.log.error({ err: error }, "server failed to start");
  process.exit(1);
}
