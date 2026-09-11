import { describe, expect, it } from "vitest";
import { resolveBasemap } from "./basemap";

describe("resolveBasemap", () => {
  it("uses the Mapbox dark style with a valid public token", () => {
    const result = resolveBasemap("pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJleGFtcGxlIn0.signature");

    expect(result.mode).toBe("mapbox");
    expect(result.engine).toBe("mapbox");
    expect(result.style).toBe("mapbox://styles/mapbox/dark-v11");
  });

  it("provides a raster basemap when the Mapbox token is invalid", () => {
    const result = resolveBasemap("pk.token_mapbox_asli_anda");

    expect(result.mode).toBe("fallback");
    expect(result.engine).toBe("maplibre");
    expect(result.style).toMatchObject({
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]
        }
      }
    });
  });
});
