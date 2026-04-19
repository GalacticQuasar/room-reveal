# AGENTS

High-signal notes for OpenCode sessions in this repo.

## Project shape

- Single-package Vite app (no monorepo/workspaces).
- Multi-page build entries are defined in `vite.config.js`: `index.html`, `viewer.html`, `upload.html`, `select.html`, `landing-dev.html`.
- Frontend entrypoints:
  - `src/landing.js` for `/`
  - `src/main.js` for `/viewer.html`
  - `src/upload.js` for `/upload.html`
  - `src/select.js` for `/select.html`
  - `src/landing-dev.js` for `/landing-dev.html`
- Backend API lives in `modal_app.py` (FastAPI on Modal) and is consumed by `src/api.js`.

## Commands and checks

- Install: `npm install`
- Dev server: `npm run dev`
- Build check: `npm run build`
- Preview build: `npm run preview`
- There are no repo scripts for lint/test/typecheck; `npm run build` is the minimum automated validation.

## Runtime and env gotchas

- Frontend API base URL is `VITE_MODAL_ENDPOINT` (see `.env.example`).
- If `VITE_MODAL_ENDPOINT` is unset, `src/api.js` falls back to relative paths and warns in console; API calls will fail unless a compatible backend is served at the same origin.
- `.env` is gitignored; avoid committing local endpoint values.

## Behavior-critical code paths

- `src/main.js` only loads splats from query params `building`, `room_type`, `splat_id`; there is no local file picker flow now.
- Viewer fetch path is `/splats/{building}/{room_type}/{splatId}.ply` via `apiUrl(...)`.
- Preserve splat replacement/disposal on reload (`scene.remove(activeSplat)` + `activeSplat.dispose()`) to avoid leaks.
- Orientation is controlled by `Flip 90deg (Nerfstudio)` toggle (`applySplatOrientation`); default is no rotation.
- Start positions are looked up in `src/start-positions.json` by exact then case-insensitive filename.
- `Log current position` writes `[START_POSITION_ENTRY]` to console and tries clipboard copy.

## Data/config boundaries that are easy to confuse

- `src/room-config.json` is the single frontend config source for landing, upload, and select pages; shape:
  - building -> `{ "room-types": [...], latitude, longitude }`
- Backend does not expose a `/config` endpoint; it accepts `building` and `room_type` values from the client and uses them directly in splat/upload paths.

## Current UX wiring caveats

- In `src/landing.js`, `Explore Room` is intentionally a no-op right now.
- Primary navigable path to viewer is via `/select.html` -> `/viewer.html?...`.
- `Upload Video` button on landing navigates to `/upload.html`.

## Pipeline/backend notes

- `pipeline/pipeline.sh` is the script used by `modal_app.py` GPU job to produce `splat.ply` from uploaded video.
- Modal API enforces:
  - max upload duration 300s
  - max concurrent pipeline jobs `MAX_CONCURRENT_JOBS = 2` with file locks under `/splats/_locks`

## Do not edit

- Do not hand-edit build artifacts in `dist/`.
- Treat `node_modules/`, `.venv/`, and `__pycache__/` as local runtime artifacts.
