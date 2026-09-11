import { z } from "zod";

const apiEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173")
});

const workerEnvironmentSchema = z.object({
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  SIPONGI_ENDPOINT: z.string().url(),
  SIPONGI_DATE_PARAM: z.string().min(1).default("date"),
  SIPONGI_PAGE_PARAM: z.string().min(1).default("page"),
  SIPONGI_PER_PAGE_PARAM: z.string().min(1).default("per_page"),
  SIPONGI_PER_PAGE: z.coerce.number().int().positive().max(10_000).default(1000),
  SIPONGI_AUTHORIZATION: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional()
  )
});

export function parseApiConfig(environment: Record<string, string | undefined>) {
  const parsed = apiEnvironmentSchema.parse(environment);
  return {
    port: parsed.PORT,
    redisUrl: parsed.REDIS_URL,
    corsOrigin: parsed.CORS_ORIGIN
  };
}

export function parseWorkerConfig(environment: Record<string, string | undefined>) {
  const parsed = workerEnvironmentSchema.parse(environment);
  return {
    redisUrl: parsed.REDIS_URL,
    sipongi: {
      endpoint: parsed.SIPONGI_ENDPOINT,
      dateParam: parsed.SIPONGI_DATE_PARAM,
      pageParam: parsed.SIPONGI_PAGE_PARAM,
      perPageParam: parsed.SIPONGI_PER_PAGE_PARAM,
      perPage: parsed.SIPONGI_PER_PAGE,
      ...(parsed.SIPONGI_AUTHORIZATION ? { authorization: parsed.SIPONGI_AUTHORIZATION } : {})
    }
  };
}
