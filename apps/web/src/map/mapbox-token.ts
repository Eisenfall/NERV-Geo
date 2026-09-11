const PLACEHOLDER_PATTERN = /(token[-_ ]?mapbox|mapbox[-_ ]?token|your[-_ ]?token|replace[-_ ]?me|asli|anda)/i;

export function isUsableMapboxToken(token: string | undefined): token is string {
  const candidate = token?.trim();
  if (!candidate || PLACEHOLDER_PATTERN.test(candidate)) return false;
  const segments = candidate.split(".");
  return segments.length === 3 && segments[0] === "pk" && segments[1]!.length > 0 && segments[2]!.length > 0;
}
