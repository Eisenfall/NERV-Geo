# NERV-Geo production runbook

## Services

- `web`: static React application and reverse proxy.
- `api`: read-only GeoJSON and health endpoints.
- `worker`: BMKG/SIPONGI aggregation and midnight reset.
- `redis`: ephemeral snapshots with persistence disabled.

Only one worker replica is needed. Redis ownership locks protect against accidental duplicate schedules.

## Configuration

Copy `.env.example` to `.env` and replace the placeholders. `VITE_MAPBOX_TOKEN` is embedded in the public frontend bundle and must be a URL-restricted public token. Keep `SIPONGI_ENDPOINT` and `SIPONGI_AUTHORIZATION` server-side.

Place the licensed alert asset at `apps/web/public/audio/japan-eas.mp3`. The repository does not distribute that audio.

## Start

Local development requires Redis at `redis://localhost:6379`:

```bash
npm install
npm run dev
```

Container deployment:

```bash
docker compose up --build
```

The web UI is served at `http://localhost:8080`; API health is available at `http://localhost:3000/health/ready`.

## Operations

- Aggregation runs on startup and at second 15 every five minutes.
- Reset runs at `00:00:00 Asia/Jakarta`.
- `degraded` means stale same-day provider data is being retained.
- `unavailable` means the provider has no valid data for the current WIB day.
- A circuit opens for 15 minutes after three consecutive provider failures.

Investigate upstream availability when structured logs show repeated `aggregation failed`, a source remains `unavailable`, or readiness returns HTTP 503. Never log or return SIPONGI authorization values.
