const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

export function toWibParts(value: string | Date): { dateWib: string; timeWib: string } {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid disaster timestamp");
  }
  return { dateWib: DATE_FORMATTER.format(date), timeWib: TIME_FORMATTER.format(date) };
}

export function currentWibDate(now = new Date()): string {
  return DATE_FORMATTER.format(now);
}
