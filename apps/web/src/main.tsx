import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/vt323";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
