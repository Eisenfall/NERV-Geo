import { z } from "zod";
import {
  deduplicateFeatures,
  makeDisasterId,
  type DisasterFeature
} from "@nerv-geo/contracts";
import { toWibParts } from "../time.js";
import { CircuitBreaker, fetchJsonWithRetry } from "./fetch-json.js";

const hotspotSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
    acquired_at: z.string(),
    confidence: z.string(),
    kabupaten: z.string().optional(),
    provinsi: z.string().optional()
  })
  .passthrough();

const sipongiPayloadSchema = z.object({
  data: z.array(hotspotSchema),
  pagination: z
    .object({
      page: z.coerce.number(),
      last_page: z.coerce.number()
    })
    .optional()
});

const WILDFIRE_MITIGATION =
  "Hindari area api dan asap, gunakan masker, tutup ventilasi, jangan melakukan pembakaran, dan laporkan kepada 112, BPBD, atau Manggala Agni.";

function normalizeConfidence(value: string): "high" | "nominal" | null {
  const confidence = value.trim().toLowerCase();
  if (["high", "tinggi"].includes(confidence)) return "high";
  if (["nominal", "medium", "sedang"].includes(confidence)) return "nominal";
  return null;
}

export function normalizeSipongiPayload(payload: unknown, dateWib: string): DisasterFeature[] {
  const parsed = sipongiPayloadSchema.parse(payload);

  return parsed.data.flatMap((hotspot): DisasterFeature[] => {
    const confidence = normalizeConfidence(hotspot.confidence);
    const occurred = new Date(hotspot.acquired_at);
    const wib = toWibParts(occurred);
    if (!confidence || wib.dateWib !== dateWib) return [];

    const occurredAt = occurred.toISOString();
    const location = [hotspot.kabupaten, hotspot.provinsi].filter(Boolean).join(", ");
    return [
      {
        type: "Feature",
        id: makeDisasterId(
          "SIPONGI",
          "WILDFIRE",
          occurredAt,
          hotspot.longitude,
          hotspot.latitude
        ),
        geometry: { type: "Point", coordinates: [hotspot.longitude, hotspot.latitude] },
        properties: {
          type: "WILDFIRE",
          severity: confidence === "high" ? "CRITICAL" : "WARNING",
          source: "SIPONGI",
          occurredAt,
          dateWib: wib.dateWib,
          timeWib: wib.timeWib,
          location: location || `${hotspot.latitude.toFixed(4)}, ${hotspot.longitude.toFixed(4)}`,
          mitigation: WILDFIRE_MITIGATION,
          confidence
        }
      }
    ];
  });
}

export type SipongiPage = z.infer<typeof sipongiPayloadSchema>;

export class SipongiProvider {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly retryDelayMs: number;
  private readonly dateParam: string;
  private readonly pageParam: string;
  private readonly perPageParam: string;
  private readonly perPage: number;
  private readonly authorization: string | undefined;
  private readonly breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 900_000 });

  constructor(options: {
    endpoint: string;
    fetcher?: typeof fetch;
    retryDelayMs?: number;
    dateParam?: string;
    pageParam?: string;
    perPageParam?: string;
    perPage?: number;
    authorization?: string;
  }) {
    this.endpoint = options.endpoint;
    this.fetcher = options.fetcher ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 250;
    this.dateParam = options.dateParam ?? "date";
    this.pageParam = options.pageParam ?? "page";
    this.perPageParam = options.perPageParam ?? "per_page";
    this.perPage = options.perPage ?? 1000;
    this.authorization = options.authorization;
  }

  async fetch(dateWib: string): Promise<DisasterFeature[]> {
    if (!this.breaker.canRequest()) throw new Error("SIPONGI circuit breaker is open");
    const features: DisasterFeature[] = [];
    let page = 1;
    let lastPage = 1;

    try {
      do {
        const url = new URL(this.endpoint);
        url.searchParams.set(this.dateParam, dateWib);
        url.searchParams.set(this.pageParam, String(page));
        url.searchParams.set(this.perPageParam, String(this.perPage));
        const headers = this.authorization ? { Authorization: this.authorization } : undefined;
        const payload = await fetchJsonWithRetry(url.toString(), {
          fetcher: this.fetcher,
          timeoutMs: 10_000,
          retries: 2,
          retryDelayMs: this.retryDelayMs,
          ...(headers ? { headers } : {})
        });
        const parsed = sipongiPayloadSchema.parse(payload);
        features.push(...normalizeSipongiPayload(parsed, dateWib));
        lastPage = parsed.pagination?.last_page ?? 1;
        page += 1;
      } while (page <= lastPage && page <= 100);
      this.breaker.recordSuccess();
      return deduplicateFeatures(features);
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
