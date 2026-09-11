export interface FetchJsonOptions {
  fetcher?: typeof fetch;
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  headers?: HeadersInit;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchJsonWithRetry(
  url: string,
  options: FetchJsonOptions = {}
): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch;
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retryDelayMs = options.retryDelayMs ?? 250;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(timeoutMs),
        ...(options.headers ? { headers: options.headers } : {})
      });
      if (!response.ok) throw new Error(`Upstream responded with ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries && retryDelayMs > 0) {
        await delay(retryDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: { threshold: number; cooldownMs: number; now?: () => number }) {
    this.threshold = options.threshold;
    this.cooldownMs = options.cooldownMs;
    this.now = options.now ?? Date.now;
  }

  canRequest(): boolean {
    if (this.openedAt === null) return true;
    return this.now() - this.openedAt >= this.cooldownMs;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = this.now();
  }
}
