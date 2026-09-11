import type { Feature, FeatureCollection, Point } from "geojson";
import { z } from "zod";

export const disasterTypeSchema = z.enum(["EARTHQUAKE", "WILDFIRE"]);
export const disasterSeveritySchema = z.enum(["CRITICAL", "WARNING"]);
export const disasterSourceSchema = z.enum(["BMKG", "SIPONGI"]);
export const providerStatusSchema = z.enum(["ok", "degraded", "unavailable"]);

export type DisasterType = z.infer<typeof disasterTypeSchema>;
export type DisasterSeverity = z.infer<typeof disasterSeveritySchema>;
export type DisasterSource = z.infer<typeof disasterSourceSchema>;
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export interface DisasterProperties {
  type: DisasterType;
  severity: DisasterSeverity;
  source: DisasterSource;
  occurredAt: string;
  dateWib: string;
  timeWib: string;
  location: string;
  mitigation: string;
  magnitude?: number;
  depthKm?: number;
  confidence?: "high" | "nominal";
  potential?: string;
}

export interface DisasterMetadata {
  dateWib: string;
  generatedAt: string;
  sources: Array<{
    name: DisasterSource;
    status: ProviderStatus;
    fetchedAt: string | null;
  }>;
}

export type DisasterFeature = Feature<Point, DisasterProperties> & { id: string };
export type DisasterFeatureCollection = FeatureCollection<Point, DisasterProperties> & {
  features: DisasterFeature[];
  metadata: DisasterMetadata;
};

const longitudeSchema = z.number().min(-180).max(180);
const latitudeSchema = z.number().min(-90).max(90);

export const disasterPropertiesSchema = z.object({
  type: disasterTypeSchema,
  severity: disasterSeveritySchema,
  source: disasterSourceSchema,
  occurredAt: z.string().datetime({ offset: true }),
  dateWib: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeWib: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  location: z.string().min(1),
  mitigation: z.string().min(1),
  magnitude: z.number().optional(),
  depthKm: z.number().nonnegative().optional(),
  confidence: z.enum(["high", "nominal"]).optional(),
  potential: z.string().optional()
});

export const disasterFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([longitudeSchema, latitudeSchema])
  }),
  properties: disasterPropertiesSchema
});

export const disasterFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(disasterFeatureSchema),
  metadata: z.object({
    dateWib: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    generatedAt: z.string().datetime({ offset: true }),
    sources: z.array(
      z.object({
        name: disasterSourceSchema,
        status: providerStatusSchema,
        fetchedAt: z.string().datetime({ offset: true }).nullable()
      })
    )
  })
});

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function makeDisasterId(
  source: DisasterSource,
  type: DisasterType,
  occurredAt: string,
  longitude: number,
  latitude: number
): string {
  const fingerprint = [source, type, occurredAt, longitude.toFixed(5), latitude.toFixed(5)].join("|");
  return `${source}:${type}:${fnv1a(fingerprint)}`;
}

export function createEmptyCollection(
  dateWib: string,
  generatedAt = new Date().toISOString()
): DisasterFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
    metadata: { dateWib, generatedAt, sources: [] }
  };
}

export function deduplicateFeatures(features: DisasterFeature[]): DisasterFeature[] {
  return [...new Map(features.map((feature) => [feature.id, feature])).values()];
}
