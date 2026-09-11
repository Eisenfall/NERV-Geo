import { describe, expect, it } from "vitest";
import { isUsableMapboxToken } from "./mapbox-token";

describe("isUsableMapboxToken", () => {
  it("rejects the documented placeholder token", () => {
    expect(isUsableMapboxToken("pk.token-mapbox-anda")).toBe(false);
  });

  it("rejects the local example value copied into env", () => {
    expect(isUsableMapboxToken("pk.token_mapbox_asli_anda")).toBe(false);
  });

  it("accepts a public Mapbox token", () => {
    expect(isUsableMapboxToken("pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJleGFtcGxlIn0.signature")).toBe(true);
  });
});
