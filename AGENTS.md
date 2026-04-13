# AGENTS

This document is a technical handoff for engineers and coding agents working on the Room Reveal repository.

## 1) Project snapshot

- Project type: single-package Vite app (no monorepo, no workspaces).
- Primary goal: render Gaussian splat `.ply` files in a browser-based viewer and provide a map-based landing page.
- App is currently client-only for viewing: no backend/API integration in this repo for file upload, auth, or persistence.
- Build output is multi-page:
  - Landing page: `index.html` -> `src/landing.js`
  - Viewer page: `viewer.html` -> `src/main.js`

## 2) Source of truth files

- `package.json`: scripts and dependency versions.
- `vite.config.js`: multi-page build inputs (`index.html`, `viewer.html`).
- `index.html`: landing entry HTML.
- `viewer.html`: viewer entry HTML.
- `src/landing.js`: map page logic and CTA navigation.
- `src/landing.css`: map page UI styling.
- `src/main.js`: Three.js + Spark viewer logic, controls, file loading, and status UI.
- `src/style.css`: viewer styles and shared visual tokens used by viewer UI.
- `src/start-positions.json`: filename -> start camera coordinate mapping.
- `STYLE.md`: typography and color tokens for UI styling.
- `pipeline/README.md`: Nerfstudio/COLMAP offline processing workflow for generating `.ply` files.

## 3) Runtime architecture

### Landing page (`/`)

- Mounted via `index.html` and `src/landing.js`.
- Uses `maplibre-gl` with dark basemap style (`dark-matter-gl-style`).
- Adds custom 3D building extrusion layer after removing default building layers from source `carto` / `building`.
- Foreground overlay contains:
  - Title (`Room Reveal`)
  - `Launch Viewer` button
  - Helper hint text
- CTA behavior: `#launch-viewer` click navigates to `/viewer.html`.

### Viewer page (`/viewer.html`)

- Mounted via `viewer.html` and `src/main.js`.
- Uses `three` for scene/camera/renderer/input loop.
- Uses `@sparkjsdev/spark` `SplatMesh` to load/render `.ply` Gaussian splats.
- Local file load only:
  - `<input type="file" accept=".ply">`
  - Drag-and-drop `.ply` onto window
- No network fetch for models by default.

## 4) Dependencies and versions

From `package.json`:

- Runtime deps:
  - `three@^0.183.2`
  - `@sparkjsdev/spark@^0.1.10`
  - `maplibre-gl@^5.22.0`
- Dev deps:
  - `vite@^8.0.4`

Important note: repository `README.md` still references "React Three Fiber" in the technologies section, but current implementation is plain Three.js + Spark and no React runtime.

## 5) Commands

Use these exact commands (from `package.json`):

- Install: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Preview production build: `npm run preview`

Current quality gates:

- No lint script
- No test script
- No typecheck script

When making functional changes, at minimum run `npm run build` to catch integration errors.

## 6) Viewer internals (behavior-critical)

File: `src/main.js`

### Scene setup

- Creates `THREE.Scene` with fog.
- Perspective camera: FOV 70, near 0.05, far 3000.
- WebGLRenderer on canvas `#viewport`.
- Adds hemisphere light and grid helper.

### Splat loading pipeline

- Reads selected/dropped file bytes (`Uint8Array(await file.arrayBuffer())`).
- Instantiates Spark mesh with:
  - `fileType: SplatFileType.PLY`
  - `fileName: file.name`
  - `maxSplats: 4_000_000`
- Waits on `await splat.initialized` before adding to scene.
- Orientation correction currently applies `splat.rotation.x = -Math.PI`.

### Replace/dispose semantics

- Existing active splat is always cleaned up before loading a new file:
  - `scene.remove(activeSplat)`
  - `activeSplat.dispose()`
- Preserve this behavior when modifying loading flow to avoid memory leaks.

### Start position logic

- Viewer attempts hardcoded camera spawn from `src/start-positions.json` by exact and case-insensitive filename match.
- If found and finite, camera position set to mapped values and camera looks at splat center.
- If not found, fallback behavior currently sets camera position to splat bounds center.

### Coordinate logging utility

- `Log current position` button is enabled after model load.
- Clicking builds JSON fragment in form:
  - `"<file>.ply": {"x":...,"y":...,"z":...}`
- Logs to console with `[START_POSITION_ENTRY]` prefix.
- Attempts clipboard copy via `navigator.clipboard.writeText` with status fallback on failure.

### Input / controls

- Pointer lock requested by clicking canvas.
- Mouse look active only while pointer locked.
- Move keys:
  - `W/A/S/D` horizontal movement
  - `Space` up
  - `C` down
  - `Shift` boost multiplier
- Movement is time-based via `clock.getDelta()` and clamped per frame.

## 7) Landing page internals (behavior-critical)

File: `src/landing.js`

- Creates MapLibre map centered around Purdue area.
- Pitch/bearing configured for 3D perspective.
- Removes existing building layers from style and injects custom fill-extrusion layer (`id: 3d-buildings`).
- UI overlay is pointer-events disabled globally; CTA button explicitly re-enables pointer events.
- CTA routing is direct hard navigation to `/viewer.html`.

File: `src/landing.css`

- Contains its own reset and token definitions for landing page styling.
- Current look is a modern minimal dark style (flat translucent top bar, white CTA).
- If modifying layout, keep mobile behavior in sync with media query at max-width 600px.

## 8) Known pitfalls and gotchas

- `dist/` may exist locally from prior builds; do not edit built artifacts manually.
- Landing and viewer are separate entry bundles; shared assumptions between `landing.css` and `style.css` can drift.
- Viewer currently relies on browser pointer lock; UX changes should retain an obvious path to unlock (`Esc`).
- Large bundle warnings from Vite are expected right now due to 3D dependencies.

## 9) Manual verification checklist

After relevant changes, validate in `npm run dev`:

### Landing page

- Open `/`.
- Confirm map renders and 3D buildings appear when zoomed sufficiently.
- Confirm `Launch Viewer` button navigates to `/viewer.html`.
- Confirm overlay layout looks correct on desktop and narrow/mobile viewport.

### Viewer page

- Open `/viewer.html`.
- Load a `.ply` via file picker.
- Confirm status updates from loading -> loaded.
- Click canvas to pointer-lock; verify mouse look + WASD/Space/C + Shift behavior.
- Press `Esc` to unlock pointer.
- Load a second `.ply` and confirm previous splat is replaced (no crash/leak symptoms).
- Test drag/drop `.ply` path.
- If file name exists in `start-positions.json`, confirm camera starts at mapped coordinates.

Also run `npm run build` before handoff/merge.

## 10) Change guidance for future contributors

- Keep viewer controls custom unless intentionally replacing with another control system.
- Preserve splat disposal logic when changing file load flow.
- Treat `maxSplats`, orientation correction, and camera-start behavior as intentional defaults; document any changes explicitly in PR notes.
- If adding scripts (lint/test/typecheck), update this file with exact commands and expected order.
- If adding new entry pages, update `vite.config.js` and this document’s architecture section.

## 11) Suggested backlog (not yet implemented)

- Add automated checks (lint + formatting + basic smoke test).
- Align README technology claims with actual implementation.
- Consider extracting shared CSS tokens into a single imported file for both pages.
- Consider route-style navigation (`/viewer`) if deployment environment expects extensionless paths.
