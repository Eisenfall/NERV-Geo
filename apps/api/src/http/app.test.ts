import request from "supertest";
import { describe, expect, it } from "vitest";
import { createEmptyCollection } from "@nerv-geo/contracts";
import { createApp } from "./app";

describe("disaster API", () => {
  it("returns an empty GeoJSON collection and supports ETag", async () => {
    const snapshot = createEmptyCollection("2026-09-11");
    const repository = {
      readCurrent: async () => snapshot,
      ping: async () => true
    };
    const app = createApp({ repository, corsOrigin: "http://localhost:5173" });

    const first = await request(app).get("/api/disasters").expect(200);
    expect(first.body.type).toBe("FeatureCollection");
    expect(first.headers["content-type"]).toMatch(/^application\/geo\+json/);
    expect(first.headers.etag).toBeTruthy();
    const etag = first.headers.etag;
    if (!etag) throw new Error("Expected response ETag");
    await request(app).get("/api/disasters").set("If-None-Match", etag).expect(304);
  });

  it("returns 503 when Redis is unavailable", async () => {
    const repository = {
      readCurrent: async () => {
        throw new Error("connection refused at secret-host");
      },
      ping: async () => false
    };
    const app = createApp({ repository, corsOrigin: "http://localhost:5173" });
    const response = await request(app).get("/api/disasters").expect(503);
    expect(response.body).toEqual({ error: "DISASTER_DATA_UNAVAILABLE" });
    expect(JSON.stringify(response.body)).not.toContain("secret-host");
  });
});
