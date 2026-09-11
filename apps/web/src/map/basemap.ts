import type { StyleSpecification } from "mapbox-gl";
import { isUsableMapboxToken } from "./mapbox-token";

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "osm-dark",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -1,
        "raster-contrast": 0.3,
        "raster-brightness-min": 0.02,
        "raster-brightness-max": 0.48
      }
    }
  ]
};

export type Basemap =
  | { mode: "mapbox"; engine: "mapbox"; style: "mapbox://styles/mapbox/dark-v11" }
  | { mode: "fallback"; engine: "maplibre"; style: StyleSpecification };

export function resolveBasemap(token: string | undefined): Basemap {
  return isUsableMapboxToken(token)
    ? { mode: "mapbox", engine: "mapbox", style: "mapbox://styles/mapbox/dark-v11" }
    : { mode: "fallback", engine: "maplibre", style: FALLBACK_STYLE };
}
