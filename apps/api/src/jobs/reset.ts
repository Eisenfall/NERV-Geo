export interface ResetRepository {
  acquireLock(name: "reset", token: string, ttlMs: number): Promise<boolean>;
  releaseLock(name: "reset", token: string): Promise<void>;
  reset(): Promise<void>;
}

export class DailyResetJob {
  constructor(
    private readonly repository: ResetRepository,
    private readonly token: () => string = () => crypto.randomUUID()
  ) {}

  async run(): Promise<"completed" | "skipped"> {
    const token = this.token();
    const locked = await this.repository.acquireLock("reset", token, 60_000);
    if (!locked) return "skipped";
    try {
      await this.repository.reset();
      return "completed";
    } finally {
      await this.repository.releaseLock("reset", token);
    }
  }
}
