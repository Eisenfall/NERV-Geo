import { useEffect, useState } from "react";
import { createEmptyCollection, type DisasterFeatureCollection } from "@nerv-geo/contracts";
import { fetchDisasters } from "./disasters";

export function useDisasters(endpoint: string, intervalMs = 60_000) {
  const [data, setData] = useState<DisasterFeatureCollection>(() =>
    createEmptyCollection(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format())
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const refresh = async () => {
      try {
        const snapshot = await fetchDisasters(endpoint, fetch, controller.signal);
        if (!active) return;
        setData(snapshot);
        setError(null);
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Telemetry tidak tersedia");
      } finally {
        if (active) setLoading(false);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), intervalMs);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [endpoint, intervalMs]);

  return { data, error, loading };
}
