import { describe, expect, it, vi } from "vitest";
import { AlertAudio } from "./alert-audio";

describe("AlertAudio", () => {
  it("rewinds and plays from a direct user interaction", async () => {
    const element = {
      currentTime: 14,
      muted: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn()
    };
    const audio = new AlertAudio(element);
    await audio.play();
    expect(element.currentTime).toBe(0);
    expect(element.play).toHaveBeenCalledOnce();
  });

  it("toggles mute and stops playback", () => {
    const element = {
      currentTime: 4,
      muted: false,
      play: vi.fn(),
      pause: vi.fn()
    };
    const audio = new AlertAudio(element);
    expect(audio.toggleMuted()).toBe(true);
    audio.stop();
    expect(element.pause).toHaveBeenCalledOnce();
    expect(element.currentTime).toBe(0);
  });
});
