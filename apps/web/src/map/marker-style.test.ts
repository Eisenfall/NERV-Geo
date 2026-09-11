import { describe, expect, it } from "vitest";
import { markerClassName } from "./marker-style";

describe("markerClassName", () => {
  it("maps critical alerts to red and warnings to yellow", () => {
    expect(markerClassName("CRITICAL")).toContain("critical");
    expect(markerClassName("WARNING")).toContain("warning");
  });
});
