import { describe, expect, it } from "vitest";
import { parseApiConfig, parseWorkerConfig } from "./config";

describe("environment configuration", () => {
  it("requires a valid SIPONGI endpoint for the worker", () => {
    expect(() =>
      parseWorkerConfig({ REDIS_URL: "redis://localhost:6379", SIPONGI_ENDPOINT: "not-a-url" })
    ).toThrow();
  });

  it("uses safe local API defaults", () => {
    expect(parseApiConfig({})).toMatchObject({
      port: 3000,
      redisUrl: "redis://localhost:6379",
      corsOrigin: "http://localhost:5173"
    });
  });

  it("treats an empty optional SIPONGI authorization as unset", () => {
    const config = parseWorkerConfig({
      REDIS_URL: "redis://localhost:6379",
      SIPONGI_ENDPOINT: "https://sipongi.example/hotspots",
      SIPONGI_AUTHORIZATION: ""
    });
    expect(config.sipongi).not.toHaveProperty("authorization");
  });
});
