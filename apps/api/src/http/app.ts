import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import pino from "pino";
import type { DisasterFeatureCollection } from "@nerv-geo/contracts";

export interface DisasterReader {
  readCurrent(): Promise<DisasterFeatureCollection>;
  ping(): Promise<boolean>;
}

export function createApp(options: { repository: DisasterReader; corsOrigin: string }) {
  const app = express();
  const logger = pino({
    name: "nerv-geo-http",
    level: process.env.NODE_ENV === "test" ? "silent" : "info"
  });
  app.disable("x-powered-by");
  app.set("etag", "strong");
  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on("finish", () => {
      logger.info(
        { method: request.method, path: request.path, statusCode: response.statusCode, durationMs: Date.now() - startedAt },
        "request completed"
      );
    });
    next();
  });
  app.use(cors({ origin: options.corsOrigin }));
  app.use(
    "/api",
    rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false })
  );

  app.get("/health/live", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/health/ready", async (_request, response) => {
    const ready = await options.repository.ping().catch(() => false);
    response.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
  });

  app.get("/api/disasters", async (_request, response) => {
    try {
      const snapshot = await options.repository.readCurrent();
      response.set("Cache-Control", "no-cache");
      response.type("application/geo+json").json(snapshot);
    } catch (error) {
      logger.error({ err: error }, "failed to read disaster snapshot");
      response.status(503).json({ error: "DISASTER_DATA_UNAVAILABLE" });
    }
  });

  return app;
}
