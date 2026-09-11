import {
  createEmptyCollection,
  deduplicateFeatures,
  type DisasterFeature,
  type DisasterFeatureCollection,
  type DisasterSource
} from "@nerv-geo/contracts";
import { currentWibDate } from "../time.js";

export interface DisasterProvider {
  fetch(dateWib: string): Promise<DisasterFeature[]>;
}

export interface AggregationRepository {
  acquireLock(name: "aggregate", token: string, ttlMs: number): Promise<boolean>;
  releaseLock(name: "aggregate", token: string): Promise<void>;
  readProvider(source: DisasterSource): Promise<DisasterFeatureCollection | null>;
  writeAggregation(
    updates: Partial<Record<DisasterSource, DisasterFeatureCollection>>,
    current: DisasterFeatureCollection
  ): Promise<void>;
}

const SOURCES: DisasterSource[] = ["BMKG", "SIPONGI"];

export class DisasterAggregator {
  private readonly repository: AggregationRepository;
  private readonly providers: Record<DisasterSource, DisasterProvider>;
  private readonly now: () => Date;
  private readonly token: () => string;

  constructor(options: {
    repository: AggregationRepository;
    providers: Record<DisasterSource, DisasterProvider>;
    now?: () => Date;
    token?: () => string;
  }) {
    this.repository = options.repository;
    this.providers = options.providers;
    this.now = options.now ?? (() => new Date());
    this.token = options.token ?? (() => crypto.randomUUID());
  }

  async run(): Promise<"completed" | "skipped"> {
    const token = this.token();
    const locked = await this.repository.acquireLock("aggregate", token, 240_000);
    if (!locked) return "skipped";

    try {
      const now = this.now();
      const dateWib = currentWibDate(now);
      const generatedAt = now.toISOString();
      const results = await Promise.allSettled(
        SOURCES.map((source) => this.providers[source].fetch(dateWib))
      );

      const updates: Partial<Record<DisasterSource, DisasterFeatureCollection>> = {};
      const allFeatures: DisasterFeature[] = [];
      const statuses: DisasterFeatureCollection["metadata"]["sources"] = [];

      for (let index = 0; index < SOURCES.length; index += 1) {
        const source = SOURCES[index]!;
        const result = results[index]!;
        if (result.status === "fulfilled") {
          const providerCollection: DisasterFeatureCollection = {
            ...createEmptyCollection(dateWib, generatedAt),
            features: result.value,
            metadata: {
              dateWib,
              generatedAt,
              sources: [{ name: source, status: "ok", fetchedAt: generatedAt }]
            }
          };
          updates[source] = providerCollection;
          allFeatures.push(...result.value);
          statuses.push({ name: source, status: "ok", fetchedAt: generatedAt });
          continue;
        }

        const previous = await this.repository.readProvider(source);
        if (previous?.metadata.dateWib === dateWib) {
          allFeatures.push(...previous.features);
          const previousStatus = previous.metadata.sources.find((status) => status.name === source);
          statuses.push({
            name: source,
            status: "degraded",
            fetchedAt: previousStatus?.fetchedAt ?? previous.metadata.generatedAt
          });
        } else {
          statuses.push({ name: source, status: "unavailable", fetchedAt: null });
        }
      }

      const current: DisasterFeatureCollection = {
        type: "FeatureCollection",
        features: deduplicateFeatures(allFeatures),
        metadata: { dateWib, generatedAt, sources: statuses }
      };
      await this.repository.writeAggregation(updates, current);
      return "completed";
    } finally {
      await this.repository.releaseLock("aggregate", token);
    }
  }
}
