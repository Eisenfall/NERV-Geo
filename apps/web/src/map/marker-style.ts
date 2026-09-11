import type { DisasterSeverity } from "@nerv-geo/contracts";

export function markerClassName(severity: DisasterSeverity): string {
  return `disaster-marker disaster-marker--${severity.toLowerCase()}`;
}
