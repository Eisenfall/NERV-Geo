import { describe, expect, it } from "vitest";
import { createEmptyCollection } from "@nerv-geo/contracts";
import { DisasterRepository, REDIS_KEYS, type RedisLike } from "./repository";

class FakeRedis implements RedisLike {
  readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string, options?: { NX?: boolean; PX?: number }) {
    if (options?.NX && this.values.has(key)) return null;
    this.values.set(key, value);
    return "OK";
  }

  async del(keys: string | string[]) {
    const list = Array.isArray(keys) ? keys : [keys];
    let deleted = 0;
    for (const key of list) deleted += Number(this.values.delete(key));
    return deleted;
  }

  async eval(_script: string, options: { keys: string[]; arguments: string[] }) {
    const [key] = options.keys;
    const [token] = options.arguments;
    if (key && this.values.get(key) === token) return this.del(key);
    return 0;
  }

  async ping() {
    return "PONG";
  }

  multi() {
    const operations: Array<() => void> = [];
    const transaction = {
      set: (key: string, value: string) => {
        operations.push(() => this.values.set(key, value));
        return transaction;
      },
      exec: async () => {
        operations.forEach((operation) => operation());
        return [];
      }
    };
    return transaction;
  }
}

describe("DisasterRepository", () => {
  it("writes provider and combined snapshots in one transaction", async () => {
    const redis = new FakeRedis();
    const repository = new DisasterRepository(redis);
    const bmkg = createEmptyCollection("2026-09-11", "2026-09-11T00:00:00.000Z");
    const current = createEmptyCollection("2026-09-11", "2026-09-11T00:01:00.000Z");

    await repository.writeAggregation({ BMKG: bmkg }, current);

    expect(await repository.readProvider("BMKG")).toEqual(bmkg);
    expect(await repository.readCurrent()).toEqual(current);
  });

  it("returns an empty collection when no current snapshot exists", async () => {
    const repository = new DisasterRepository(new FakeRedis(), () => new Date("2026-09-10T17:00:00Z"));
    expect((await repository.readCurrent()).metadata.dateWib).toBe("2026-09-11");
  });

  it("uses token ownership when releasing a lock", async () => {
    const redis = new FakeRedis();
    const repository = new DisasterRepository(redis);
    expect(await repository.acquireLock("aggregate", "owner-a", 1000)).toBe(true);
    await repository.releaseLock("aggregate", "owner-b");
    expect(redis.values.get(REDIS_KEYS.aggregateLock)).toBe("owner-a");
    await repository.releaseLock("aggregate", "owner-a");
    expect(redis.values.has(REDIS_KEYS.aggregateLock)).toBe(false);
  });

  it("prevents reset and aggregation from running concurrently", async () => {
    const repository = new DisasterRepository(new FakeRedis());
    expect(await repository.acquireLock("aggregate", "aggregate-owner", 1000)).toBe(true);
    expect(await repository.acquireLock("reset", "reset-owner", 1000)).toBe(false);
    await repository.releaseLock("aggregate", "aggregate-owner");
    expect(await repository.acquireLock("reset", "reset-owner", 1000)).toBe(true);
  });

  it("clears every disaster snapshot and provider state", async () => {
    const redis = new FakeRedis();
    const repository = new DisasterRepository(redis);
    for (const key of Object.values(REDIS_KEYS)) redis.values.set(key, "data");
    await repository.reset();
    expect(redis.values.has(REDIS_KEYS.current)).toBe(false);
    expect(redis.values.has(REDIS_KEYS.bmkg)).toBe(false);
    expect(redis.values.has(REDIS_KEYS.sipongi)).toBe(false);
  });
});
