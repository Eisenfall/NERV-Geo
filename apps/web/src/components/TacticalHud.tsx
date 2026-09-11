import { useEffect, useRef } from "react";
import type { DisasterFeature } from "@nerv-geo/contracts";

interface TacticalHudProps {
  feature: DisasterFeature;
  muted: boolean;
  onClose(): void;
  onToggleMute(): void;
}

export function TacticalHud({ feature, muted, onClose, onToggleMute }: TacticalHudProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { properties } = feature;

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      ref={panelRef}
      className={`tactical-hud tactical-hud--${properties.severity.toLowerCase()}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${properties.type} alert`}
    >
      <div className="hud-corner hud-corner--tl" />
      <div className="hud-corner hud-corner--br" />
      <header className="hud-header">
        <div>
          <span className="eyebrow">INCIDENT DOSSIER</span>
          <h2>{properties.type === "EARTHQUAKE" ? "SEISMIC EVENT" : "THERMAL ANOMALY"}</h2>
        </div>
        <button ref={closeRef} className="hud-icon-button" onClick={onClose} aria-label="Close tactical HUD">
          ×
        </button>
      </header>

      <div className="severity-stamp" data-severity={properties.severity}>
        <span>THREAT LEVEL</span>
        <strong>{properties.severity}</strong>
      </div>

      <dl className="intel-grid">
        <div><dt>DATE // WIB</dt><dd>{properties.dateWib}</dd></div>
        <div><dt>TIME // WIB</dt><dd>{properties.timeWib}</dd></div>
        <div className="intel-grid__wide"><dt>LOCATION VECTOR</dt><dd>{properties.location}</dd></div>
        {properties.magnitude !== undefined ? <div><dt>MAGNITUDE</dt><dd>{properties.magnitude} MAG</dd></div> : null}
        {properties.depthKm !== undefined ? <div><dt>DEPTH</dt><dd>{properties.depthKm} KM</dd></div> : null}
        {properties.confidence ? <div><dt>CONFIDENCE</dt><dd>{properties.confidence.toUpperCase()}</dd></div> : null}
      </dl>

      <section className="mitigation-block">
        <span className="eyebrow">CIVILIAN DIRECTIVE</span>
        <p>{properties.mitigation}</p>
      </section>

      <footer className="hud-footer">
        <span>Sumber: {properties.source}</span>
        <button className="audio-toggle" onClick={onToggleMute} aria-label={muted ? "Unmute alarm" : "Mute alarm"}>
          AUDIO // {muted ? "MUTED" : "ACTIVE"}
        </button>
      </footer>
    </aside>
  );
}
