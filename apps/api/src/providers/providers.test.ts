import { describe, expect, it, vi } from "vitest";
import bmkgFixture from "./fixtures/bmkg.json";
import sipongiFixture from "./fixtures/sipongi.json";
import { BmkgProvider, normalizeBmkgPayload } from "./bmkg";
import { normalizeSipongiPayload, SipongiProvider } from "./sipongi";

describe("BMKG provider", () => {
  it("normalizes coordinates, severity, depth and current WIB day", () => {
    const features = normalizeBmkgPayload(bmkgFixture, "2026-09-11");
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry.coordinates).toEqual([106.82, -6.18]);
    expect(features[0]!.properties).toMatchObject({
      severity: "CRITICAL",
      magnitude: 6.1,
      depthKm: 10,
      dateWib: "2026-09-11",
      timeWib: "00:00:00"
    });
  });

  it("marks a tsunami-potential earthquake critical regardless of magnitude", () => {
    const payload = structuredClone(bmkgFixture);
    payload.Infogempa.gempa[0]!.Magnitude = "5.1";
    payload.Infogempa.gempa[0]!.Potensi = "Berpotensi tsunami";
    expect(normalizeBmkgPayload(payload, "2026-09-11")[0]!.properties.severity).toBe("CRITICAL");
  });

  it("merges and deduplicates the two official feeds", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(bmkgFixture), { status: 200 }));
    const provider = new BmkgProvider({ fetcher, retryDelayMs: 0 });
    const features = await provider.fetch("2026-09-11");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(features).toHaveLength(1);
  });
});

describe("SIPONGI provider", () => {
  it("keeps high confidence hotspots and filters low confidence hotspots", () => {
    const features = normalizeSipongiPayload(sipongiFixture, "2026-09-11");
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry.coordinates).toEqual([113.91, -2.14]);
    expect(features[0]!.properties).toMatchObject({
      severity: "CRITICAL",
      confidence: "high",
      location: "Palangka Raya, Kalimantan Tengah"
    });
  });

  it("follows pagination and includes the requested WIB date", async () => {
    const firstPage = structuredClone(sipongiFixture);
    firstPage.pagination.last_page = 2;
    const secondPage = structuredClone(sipongiFixture);
    secondPage.data = [];
    secondPage.pagination.page = 2;
    secondPage.pagination.last_page = 2;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200 }));
    const provider = new SipongiProvider({
      endpoint: "https://sipongi.example/api/hotspots",
      fetcher,
      retryDelayMs: 0
    });

    const features = await provider.fetch("2026-09-11");

    expect(features).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0].toString()).toContain("date=2026-09-11");
    expect(fetcher.mock.calls[1]![0].toString()).toContain("page=2");
  });
});
