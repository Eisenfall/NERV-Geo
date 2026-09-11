import { expect, test } from "@playwright/test";

test("renders the tactical command shell and tokenless basemap", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "NERV-GEO" })).toBeVisible();
  await expect(page.getByText("LOCAL BASEMAP // OPENSTREETMAP")).toBeVisible();
  await expect(page.locator(".mapboxgl-canvas, .maplibregl-canvas")).toBeVisible();
  await expect(page.getByText("DATA SOURCES // BMKG · SIPONGI KLHK")).toBeVisible();
});

test("uses the compact telemetry layout on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");
  await page.goto("/");
  await expect(page.locator(".telemetry-strip > div").nth(2)).toBeHidden();
  await expect(page.getByText("ACTIVE SIGNALS")).toBeVisible();
});
