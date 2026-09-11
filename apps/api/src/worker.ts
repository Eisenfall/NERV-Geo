import cron from "node-cron";
import pino from "pino";
import { createClient } from "redis";
import { parseWorkerConfig } from "./config.js";
import { DisasterAggregator } from "./jobs/aggregator.js";
import { DailyResetJob } from "./jobs/reset.js";
import { BmkgProvider } from "./providers/bmkg.js";
import { SipongiProvider } from "./providers/sipongi.js";
import { DisasterRepository, type RedisLike } from "./storage/repository.js";

export const AGGREGATE_CRON = "15 */5 * * * *";
export const RESET_CRON = "0 0 0 * * *";
export const JOB_TIMEZONE = "Asia/Jakarta";

const config = parseWorkerConfig(process.env);
const logger = pino({ name: "nerv-geo-worker" });
const redis = createClient({ url: config.redisUrl });
redis.on("error", (error) => logger.error({ err: error }, "Redis client error"));
await redis.connect();

const repository = new DisasterRepository(redis as unknown as RedisLike);
const aggregator = new DisasterAggregator({
  repository,
  providers: {
    BMKG: new BmkgProvider(),
    SIPONGI: new SipongiProvider(config.sipongi)
  }
});
const resetJob = new DailyResetJob(repository);

async function runAggregation() {
  const startedAt = Date.now();
  try {
    const outcome = await aggregator.run();
    const snapshot = await repository.readCurrent();
    logger.info(
      {
        outcome,
        durationMs: Date.now() - startedAt,
        featureCount: snapshot.features.length,
        sources: snapshot.metadata.sources
      },
      "aggregation finished"
    );
  } catch (error) {
    logger.error({ err: error, durationMs: Date.now() - startedAt }, "aggregation failed");
  }
}

async function runReset() {
  try {
    const outcome = await resetJob.run();
    logger.info({ outcome }, "daily reset finished");
  } catch (error) {
    logger.error({ err: error }, "daily reset failed");
  }
}

cron.schedule(AGGREGATE_CRON, () => void runAggregation(), { timezone: JOB_TIMEZONE });
cron.schedule(RESET_CRON, () => void runReset(), { timezone: JOB_TIMEZONE });
await runAggregation();

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down worker");
  await redis.quit();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
