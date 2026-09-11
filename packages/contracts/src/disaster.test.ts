import { describe, expect, it } from "vitest";
import {
  disasterFeatureCollectionSchema,
  makeDisasterId,
  type DisasterFeatureCollection
} from "./index";

const collection: DisasterFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "BMKG:EARTHQUAKE:abc",
      geometry: { type: "Point", coordinates: [106.82, -6.18] },
      properties: {
        type: "EARTHQUAKE",
        severity: "WARNING",
        source: "BMKG",
        occurredAt: "2026-09-10T17:00:00.000Z",
        dateWib: "2026-09-11",
        timeWib: "00:00:00",
        location: "Jakarta",
        mitigation: "Berlindung"
      }
    }
  ],
  metadata: {
    dateWib: "2026-09-11",
    generatedAt: "2026-09-10T17:01:00.000Z",
    sources: [{ name: "BMKG", status: "ok", fetchedAt: "2026-09-10T17:01:00.000Z" }]
  }
};

describe("disaster GeoJSON contract", () => {
  it("accepts a valid Point FeatureCollection with longitude first", () => {
    expect(disasterFeatureCollectionSchema.parse(collection)).toEqual(collection);
  });

  it("rejects coordinates outside the geographic range", () => {
    const invalid = structuredClone(collection);
    invalid.features[0]!.geometry.coordinates = [-190, -6.18];
    expect(() => disasterFeatureCollectionSchema.parse(invalid)).toThrow();
  });

  it("creates deterministic IDs", () => {
    const first = makeDisasterId("BMKG", "EARTHQUAKE", "2026-09-10T17:00:00.000Z", 106.82, -6.18);
    const second = makeDisasterId("BMKG", "EARTHQUAKE", "2026-09-10T17:00:00.000Z", 106.82, -6.18);
    expect(first).toBe(second);
    expect(first).toMatch(/^BMKG:EARTHQUAKE:/);
  });
});
