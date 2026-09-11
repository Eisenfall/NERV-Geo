import { useEffect, useRef } from "react";
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap, type Marker } from "mapbox-gl";
import * as maplibregl from "maplibre-gl";
import type { DisasterFeature, DisasterFeatureCollection } from "@nerv-geo/contracts";
import { resolveBasemap } from "../map/basemap";
import { markerClassName } from "../map/marker-style";

interface DisasterMapProps {
  collection: DisasterFeatureCollection;
  onSelect(feature: DisasterFeature): void;
}

const SOURCE_ID = "disasters";
const HIT_LAYER_ID = "disaster-hit-targets";

export function DisasterMap({ collection, onSelect }: DisasterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; element: HTMLButtonElement }>());
  const collectionRef = useRef(collection);
  const selectRef = useRef(onSelect);
  collectionRef.current = collection;
  selectRef.current = onSelect;

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!containerRef.current) return;
    const basemap = resolveBasemap(token);
    const engine = basemap.engine === "mapbox"
      ? mapboxgl
      : maplibregl as unknown as typeof mapboxgl;
    if (basemap.mode === "mapbox") engine.accessToken = token!;
    const map = new engine.Map({
      container: containerRef.current,
      style: basemap.style,
      center: [117.5, -2.4],
      zoom: 4.2,
      minZoom: 3.4,
      maxBounds: [[90, -15], [145, 12]],
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new engine.NavigationControl({ showCompass: true }), "bottom-right");
    map.addControl(new engine.AttributionControl({ compact: true }), "bottom-left");

    const refreshVisibleMarkers = () => {
      if (!map.getLayer(HIT_LAYER_ID)) return;
      const visibleIds = new Set<string>();
      const featureById = new Map<string, DisasterFeature>(
        collectionRef.current.features.map((feature) => [String(feature.id), feature as DisasterFeature])
      );
      for (const rendered of map.queryRenderedFeatures({ layers: [HIT_LAYER_ID] })) {
        const id = String(rendered.id ?? "");
        const feature = featureById.get(id);
        if (!feature || visibleIds.has(id)) continue;
        visibleIds.add(id);
        const existing = markersRef.current.get(id);
        if (existing) {
          existing.element.className = markerClassName(feature.properties.severity);
          continue;
        }
        const element = document.createElement("button");
        element.type = "button";
        element.className = markerClassName(feature.properties.severity);
        element.setAttribute("aria-label", `${feature.properties.severity}: ${feature.properties.location}`);
        element.addEventListener("click", () => selectRef.current(feature));
        const marker = new engine.Marker({ element, anchor: "center" })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .addTo(map);
        markersRef.current.set(id, { marker, element });
      }
      for (const [id, entry] of markersRef.current) {
        if (!visibleIds.has(id)) {
          entry.marker.remove();
          markersRef.current.delete(id);
        }
      }
    };

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: collectionRef.current,
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 54
      });
      map.addLayer({
        id: "disaster-clusters-glow",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(255, 49, 49, 0.18)",
          "circle-radius": ["step", ["get", "point_count"], 24, 25, 32, 100, 40],
          "circle-blur": 0.5,
          "circle-stroke-color": "#ff3131",
          "circle-stroke-width": 1.5
        }
      });
      if (basemap.mode === "mapbox") {
        map.addLayer({
          id: "disaster-cluster-count",
          type: "symbol",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 18 },
          paint: { "text-color": "#ffde59", "text-halo-color": "#050709", "text-halo-width": 2 }
        });
      }
      map.addLayer({
        id: HIT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 18, "circle-opacity": 0 }
      });
      refreshVisibleMarkers();
    });

    map.on("click", "disaster-clusters-glow", (event) => {
      const cluster = map.queryRenderedFeatures(event.point, { layers: ["disaster-clusters-glow"] })[0];
      const clusterId = Number(cluster?.properties?.cluster_id);
      const coordinates = cluster?.geometry.type === "Point" ? cluster.geometry.coordinates : null;
      if (!coordinates || !Number.isFinite(clusterId)) return;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error || zoom === null || zoom === undefined) return;
        map.easeTo({ center: [coordinates[0]!, coordinates[1]!], zoom });
      });
    });
    map.on("mouseenter", "disaster-clusters-glow", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "disaster-clusters-glow", () => { map.getCanvas().style.cursor = ""; });
    map.on("moveend", refreshVisibleMarkers);
    map.on("sourcedata", (event) => {
      if (event.sourceId === SOURCE_ID && event.isSourceLoaded) refreshVisibleMarkers();
    });

    return () => {
      for (const entry of markersRef.current.values()) entry.marker.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(collection);
  }, [collection]);

  const basemapMode = resolveBasemap(import.meta.env.VITE_MAPBOX_TOKEN).mode;
  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-canvas" aria-label="Peta bencana Indonesia" />
      {basemapMode === "fallback" ? (
        <div className="map-basemap-notice" role="status">
          LOCAL BASEMAP // OPENSTREETMAP
        </div>
      ) : null}
      <div className="map-scanline" aria-hidden="true" />
      <div className="map-reticle" aria-hidden="true"><span /><span /></div>
    </div>
  );
}
