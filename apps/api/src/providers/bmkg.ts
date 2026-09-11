import { z } from "zod";
import {
  deduplicateFeatures,
  makeDisasterId,
  type DisasterFeature
} from "@nerv-geo/contracts";
import { toWibParts } from "../time.js";
import { CircuitBreaker, fetchJsonWithRetry } from "./fetch-json.js";

export const BMKG_ENDPOINTS = [
  "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
  "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json"
] as const;

const bmkgEarthquakeSchema = z.object({
  DateTime: z.string(),
  Coordinates: z.string(),
  Magnitude: z.string(),
  Kedalaman: z.string(),
  Wilayah: z.string(),
  Potensi: z.string().default("Tidak diketahui")
});

const bmkgPayloadSchema = z.object({
  Infogempa: z.object({ gempa: z.union([bmkgEarthquakeSchema, z.array(bmkgEarthquakeSchema)]) })
});

const STANDARD_MITIGATION =
  "Lindungi kepala, berlindung di bawah meja kokoh, jauhi kaca; setelah guncangan berhenti evakuasi ke ruang terbuka dan ikuti arahan BMKG/BPBD.";
const TSUNAMI_MITIGATION =
  "Setelah guncangan berhenti, segera menuju tempat tinggi atau jalur evakuasi tsunami. Jauhi pantai dan ikuti arahan resmi BMKG/BPBD.";

function hasTsunamiPotential(potential: string): boolean {
  return /berpotensi tsunami/i.test(potential) && !/tidak berpotensi tsunami/i.test(potential);
}

export function normalizeBmkgPayload(payload: unknown, dateWib: string): DisasterFeature[] {
  const parsed = bmkgPayloadSchema.parse(payload);
  const earthquakes = Array.isArray(parsed.Infogempa.gempa)
    ? parsed.Infogempa.gempa
    : [parsed.Infogempa.gempa];

  const normalized = earthquakes.flatMap((earthquake): DisasterFeature[] => {
    const [latitudeText, longitudeText] = earthquake.Coordinates.split(",");
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    const magnitude = Number(earthquake.Magnitude);
    const depthKm = Number.parseFloat(earthquake.Kedalaman);
    const occurred = new Date(earthquake.DateTime);
    const wib = toWibParts(occurred);

    if (
      wib.dateWib !== dateWib ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(magnitude) ||
      !Number.isFinite(depthKm)
    ) {
      return [];
    }

    const tsunamiPotential = hasTsunamiPotential(earthquake.Potensi);
    const occurredAt = occurred.toISOString();
    return [
      {
        type: "Feature",
        id: makeDisasterId("BMKG", "EARTHQUAKE", occurredAt, longitude, latitude),
        geometry: { type: "Point", coordinates: [longitude, latitude] },
        properties: {
          type: "EARTHQUAKE",
          severity: magnitude >= 6 || tsunamiPotential ? "CRITICAL" : "WARNING",
          source: "BMKG",
          occurredAt,
          dateWib: wib.dateWib,
          timeWib: wib.timeWib,
          location: earthquake.Wilayah,
          mitigation: tsunamiPotential ? TSUNAMI_MITIGATION : STANDARD_MITIGATION,
          magnitude,
          depthKm,
          potential: earthquake.Potensi
        }
      }
    ];
  });

  return deduplicateFeatures(normalized);
}

export class BmkgProvider {
  private readonly fetcher: typeof fetch;
  private readonly retryDelayMs: number;
  private readonly breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 900_000 });

  constructor(options: { fetcher?: typeof fetch; retryDelayMs?: number } = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 250;
  }

  async fetch(dateWib: string): Promise<DisasterFeature[]> {
    if (!this.breaker.canRequest()) throw new Error("BMKG circuit breaker is open");
    const results = await Promise.allSettled(
      BMKG_ENDPOINTS.map((endpoint) =>
        fetchJsonWithRetry(endpoint, {
          fetcher: this.fetcher,
          timeoutMs: 10_000,
          retries: 2,
          retryDelayMs: this.retryDelayMs
        })
      )
    );
    const successful = results.flatMap((result) =>
      result.status === "fulfilled" ? normalizeBmkgPayload(result.value, dateWib) : []
    );
    if (results.every((result) => result.status === "rejected")) {
      this.breaker.recordFailure();
      throw new Error("Every BMKG feed failed");
    }
    this.breaker.recordSuccess();
    return deduplicateFeatures(successful);
  }
}
