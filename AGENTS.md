# AGENTS

## Repo shape
- Single-package Vite app (no monorepo/workspaces).
- Runtime entrypoint is `src/main.js`; `index.html` only mounts `#app` and loads that module.
- Core stack is `three` + `@sparkjsdev/spark` (Gaussian splat `PLY` viewer).

## Commands (source of truth: `package.json`)
- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Preview build: `npm run preview`
- There are currently no configured lint, typecheck, or test scripts.

## Behavior-critical implementation notes
- File loading path is local-only (`<input type="file">` and drag/drop); no backend/API layer in this repo.
- Camera/navigation logic is custom in `src/main.js` (pointer lock + WASD fly controls), not an OrbitControls setup.
- Loaded splats are disposed/replaced on each new file load; preserve this cleanup when editing loading flow.
- Optional orientation correction is a 180 deg X rotation toggle (`useRotationCorrection`); keep this if adjusting transforms.
- `SplatMesh` is initialized from file bytes with `SplatFileType.PLY` and `maxSplats: 4_000_000`; avoid changing these without intent.

## Agent workflow guidance
- Verify interactive changes manually in `npm run dev` (load a `.ply`, click to pointer-lock, move with controls).
- If you add quality gates (lint/test/typecheck), update this file with exact commands/order.
