import type { DisasterFeature } from "@nerv-geo/contracts";

export const earthquakeFeature: DisasterFeature = {
  type: "Feature",
  id: "BMKG:EARTHQUAKE:test",
  geometry: { type: "Point", coordinates: [106.82, -6.18] },
  properties: {
    type: "EARTHQUAKE",
    severity: "CRITICAL",
    source: "BMKG",
    occurredAt: "2026-09-10T18:00:00.000Z",
    dateWib: "2026-09-11",
    timeWib: "01:00:00",
    location: "Jakarta",
    mitigation: "Segera berlindung",
    magnitude: 6.2,
    depthKm: 10,
    potential: "Tidak berpotensi tsunami"
  }
};
