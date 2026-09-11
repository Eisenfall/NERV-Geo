import { describe, expect, it, vi } from "vitest";
import { DailyResetJob } from "./reset";

describe("DailyResetJob", () => {
  it("clears disaster data while holding the reset lock", async () => {
    const calls: string[] = [];
    const repository = {
      acquireLock: async () => {
        calls.push("lock");
        return true;
      },
      reset: async () => {
        calls.push("reset");
      },
      releaseLock: async () => {
        calls.push("release");
      }
    };
    const job = new DailyResetJob(repository, () => "owner");
    expect(await job.run()).toBe("completed");
    expect(calls).toEqual(["lock", "reset", "release"]);
  });

  it("does not reset when another worker owns the lock", async () => {
    const reset = vi.fn();
    const job = new DailyResetJob({
      acquireLock: async () => false,
      reset,
      releaseLock: async () => undefined
    });
    expect(await job.run()).toBe("skipped");
    expect(reset).not.toHaveBeenCalled();
  });
});
