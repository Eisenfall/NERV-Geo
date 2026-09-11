import {
  createEmptyCollection,
  disasterFeatureCollectionSchema,
  type DisasterFeatureCollection,
  type DisasterSource
} from "@nerv-geo/contracts";
import { currentWibDate } from "../time.js";

export const REDIS_KEYS = {
  current: "nerv:disasters:current",
  bmkg: "nerv:disasters:provider:bmkg",
  sipongi: "nerv:disasters:provider:sipongi",
  aggregateLock: "nerv:jobs:disaster-write:lock",
  resetLock: "nerv:jobs:disaster-write:lock"
} as const;

interface RedisTransactionLike {
  set(key: string, value: string): RedisTransactionLike;
  exec(): Promise<unknown>;
}

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { NX?: boolean; PX?: number }
  ): Promise<string | null>;
  del(keys: string | string[]): Promise<number>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
  ping(): Promise<string>;
  multi(): RedisTransactionLike;
}

function providerKey(source: DisasterSource): string {
  return source === "BMKG" ? REDIS_KEYS.bmkg : REDIS_KEYS.sipongi;
}

function lockKey(name: "aggregate" | "reset"): string {
  return name === "aggregate" ? REDIS_KEYS.aggregateLock : REDIS_KEYS.resetLock;
}

export class DisasterRepository {
  constructor(
    private readonly redis: RedisLike,
    private readonly now: () => Date = () => new Date()
  ) {}

  async ping(): Promise<boolean> {
    return (await this.redis.ping()) === "PONG";
  }

  async readCurrent(): Promise<DisasterFeatureCollection> {
    const raw = await this.redis.get(REDIS_KEYS.current);
    if (!raw) return createEmptyCollection(currentWibDate(this.now()), this.now().toISOString());
    return disasterFeatureCollectionSchema.parse(JSON.parse(raw)) as DisasterFeatureCollection;
  }

  async readProvider(source: DisasterSource): Promise<DisasterFeatureCollection | null> {
    const raw = await this.redis.get(providerKey(source));
    if (!raw) return null;
    return disasterFeatureCollectionSchema.parse(JSON.parse(raw)) as DisasterFeatureCollection;
  }

  async writeAggregation(
    updates: Partial<Record<DisasterSource, DisasterFeatureCollection>>,
    current: DisasterFeatureCollection
  ): Promise<void> {
    const transaction = this.redis.multi();
    if (updates.BMKG) transaction.set(REDIS_KEYS.bmkg, JSON.stringify(updates.BMKG));
    if (updates.SIPONGI) transaction.set(REDIS_KEYS.sipongi, JSON.stringify(updates.SIPONGI));
    transaction.set(REDIS_KEYS.current, JSON.stringify(current));
    await transaction.exec();
  }

  async acquireLock(name: "aggregate" | "reset", token: string, ttlMs: number): Promise<boolean> {
    return (await this.redis.set(lockKey(name), token, { NX: true, PX: ttlMs })) === "OK";
  }

  async releaseLock(name: "aggregate" | "reset", token: string): Promise<void> {
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: [lockKey(name)], arguments: [token] }
    );
  }

  async reset(): Promise<void> {
    await this.redis.del([REDIS_KEYS.current, REDIS_KEYS.bmkg, REDIS_KEYS.sipongi]);
  }
}
