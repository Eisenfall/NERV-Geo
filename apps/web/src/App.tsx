import { lazy, Suspense, useMemo, useState } from "react";
import type { DisasterFeature } from "@nerv-geo/contracts";
import { TacticalHud } from "./components/TacticalHud";
import { useDisasters } from "./data/use-disasters";
import { AlertAudio } from "./lib/alert-audio";

const API_ENDPOINT = import.meta.env.VITE_API_URL || "/api/disasters";
const DisasterMap = lazy(() =>
  import("./components/DisasterMap").then((module) => ({ default: module.DisasterMap }))
);

export default function App() {
  const { data, error, loading } = useDisasters(API_ENDPOINT);
  const [selected, setSelected] = useState<DisasterFeature | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audio = useMemo(() => new AlertAudio(new Audio("/audio/japan-eas.mp3")), []);
  const criticalCount = data.features.filter((feature) => feature.properties.severity === "CRITICAL").length;

  const selectFeature = (feature: DisasterFeature) => {
    setSelected(feature);
    setAudioError(false);
    void audio.play().catch(() => setAudioError(true));
  };

  const closeHud = () => {
    audio.stop();
    setSelected(null);
  };

  const toggleMute = () => setMuted(audio.toggleMuted());

  return (
    <main className="command-center">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-sigil" aria-hidden="true">N</div>
          <div><span>NATIONAL EMERGENCY RESPONSE VECTOR</span><h1>NERV-GEO</h1></div>
        </div>
        <div className="system-readout">
          <span className={`status-dot ${error ? "status-dot--error" : ""}`} />
          {loading ? "SYNCING TELEMETRY" : error ? "UPLINK DEGRADED" : "LIVE NETWORK"}
        </div>
      </header>

      <section className="telemetry-strip" aria-label="Disaster telemetry summary">
        <div><span>ACTIVE SIGNALS</span><strong>{String(data.features.length).padStart(2, "0")}</strong></div>
        <div><span>CRITICAL</span><strong className="critical-text">{String(criticalCount).padStart(2, "0")}</strong></div>
        <div><span>SECTOR</span><strong>IDN // WIB</strong></div>
        <div><span>LAST COMPILE</span><strong>{data.metadata.generatedAt.slice(11, 19)}Z</strong></div>
      </section>

      <Suspense fallback={<div className="map-loading">INITIALIZING GEO ENGINE</div>}>
        <DisasterMap collection={data} onSelect={selectFeature} />
      </Suspense>

      <div className="source-status" aria-label="Source status">
        {data.metadata.sources.map((source) => (
          <span key={source.name} data-status={source.status}>{source.name} // {source.status.toUpperCase()}</span>
        ))}
      </div>
      {error ? <div className="uplink-warning" role="status">CACHE LINK: {error}</div> : null}
      {audioError ? <div className="audio-warning" role="status">ALARM AUDIO UNAVAILABLE</div> : null}

      <footer className="global-footer">
        <span>DATA SOURCES // BMKG · SIPONGI KLHK</span>
        <span>REFRESH CYCLE // 60 SEC</span>
      </footer>

      {selected ? (
        <TacticalHud feature={selected} muted={muted} onClose={closeHud} onToggleMute={toggleMute} />
      ) : null}
    </main>
  );
}
