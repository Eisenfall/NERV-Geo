import {
  disasterFeatureCollectionSchema,
  type DisasterFeatureCollection
} from "@nerv-geo/contracts";

export async function fetchDisasters(
  endpoint: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<DisasterFeatureCollection> {
  const response = await fetcher(endpoint, {
    headers: { Accept: "application/geo+json" },
    ...(signal ? { signal } : {})
  });
  if (!response.ok) throw new Error(`Disaster API responded with ${response.status}`);
  return disasterFeatureCollectionSchema.parse(await response.json()) as DisasterFeatureCollection;
}
