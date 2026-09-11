import { createClient } from "redis";
import pino from "pino";
import { parseApiConfig } from "./config.js";
import { createApp } from "./http/app.js";
import { DisasterRepository, type RedisLike } from "./storage/repository.js";

const config = parseApiConfig(process.env);
const logger = pino({ name: "nerv-geo-api" });
const redis = createClient({ url: config.redisUrl });
redis.on("error", (error) => logger.error({ err: error }, "Redis client error"));
await redis.connect();

const repository = new DisasterRepository(redis as unknown as RedisLike);
const app = createApp({ repository, corsOrigin: config.corsOrigin });
const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "NERV-Geo API listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down API");
  server.close();
  await redis.quit();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
