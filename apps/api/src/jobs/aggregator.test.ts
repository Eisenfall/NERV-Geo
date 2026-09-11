import { describe, expect, it } from "vitest";
import { createEmptyCollection, type DisasterFeature } from "@nerv-geo/contracts";
import { DisasterAggregator, type AggregationRepository } from "./aggregator";

const earthquake: DisasterFeature = {
  type: "Feature",
  id: "BMKG:EARTHQUAKE:one",
  geometry: { type: "Point", coordinates: [106.82, -6.18] },
  properties: {
    type: "EARTHQUAKE",
    severity: "WARNING",
    source: "BMKG",
    occurredAt: "2026-09-10T18:00:00.000Z",
    dateWib: "2026-09-11",
    timeWib: "01:00:00",
    location: "Jakarta",
    mitigation: "Berlindung"
  }
};

describe("DisasterAggregator", () => {
  it("retains last-known-good features when one provider fails", async () => {
    const previousSipongi = {
      ...createEmptyCollection("2026-09-11", "2026-09-10T18:00:00.000Z"),
      features: [
        {
          ...earthquake,
          id: "SIPONGI:WILDFIRE:old",
          properties: { ...earthquake.properties, type: "WILDFIRE" as const, source: "SIPONGI" as const }
        }
      ]
    };
    let written: any;
    const repository: AggregationRepository = {
      acquireLock: async () => true,
      releaseLock: async () => undefined,
      readProvider: async (source) => (source === "SIPONGI" ? previousSipongi : null),
      writeAggregation: async (updates, current) => {
        written = { updates, current };
      }
    };
    const aggregator = new DisasterAggregator({
      repository,
      providers: {
        BMKG: { fetch: async () => [earthquake] },
        SIPONGI: { fetch: async () => Promise.reject(new Error("offline")) }
      },
      now: () => new Date("2026-09-10T18:05:00.000Z"),
      token: () => "test-token"
    });

    const result = await aggregator.run();

    expect(result).toBe("completed");
    expect(written.current.features).toHaveLength(2);
    expect(written.current.metadata.sources).toContainEqual({
      name: "SIPONGI",
      status: "degraded",
      fetchedAt: "2026-09-10T18:00:00.000Z"
    });
    expect(written.updates.SIPONGI).toBeUndefined();
  });

  it("skips execution when another worker owns the lock", async () => {
    const repository: AggregationRepository = {
      acquireLock: async () => false,
      releaseLock: async () => undefined,
      readProvider: async () => null,
      writeAggregation: async () => {
        throw new Error("must not write");
      }
    };
    const aggregator = new DisasterAggregator({
      repository,
      providers: {
        BMKG: { fetch: async () => [] },
        SIPONGI: { fetch: async () => [] }
      }
    });
    expect(await aggregator.run()).toBe("skipped");
  });
});
