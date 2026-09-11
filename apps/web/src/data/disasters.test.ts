import { describe, expect, it, vi } from "vitest";
import { createEmptyCollection } from "@nerv-geo/contracts";
import { fetchDisasters } from "./disasters";

describe("fetchDisasters", () => {
  it("validates the API response as GeoJSON", async () => {
    const snapshot = createEmptyCollection("2026-09-11", "2026-09-10T18:00:00.000Z");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(snapshot), { status: 200 })
    );
    expect(await fetchDisasters("/api/disasters", fetcher)).toEqual(snapshot);
  });

  it("rejects malformed API responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ type: "FeatureCollection" }), { status: 200 })
    );
    await expect(fetchDisasters("/api/disasters", fetcher)).rejects.toThrow();
  });
});
