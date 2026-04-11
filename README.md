# Spark Gaussian Splat Viewer

A web Gaussian splat viewer built with `@sparkjsdev/spark` and `three`.

## Features

- Loads `.ply` Gaussian splat files from file picker or drag-and-drop
- Detached free-fly camera (not orbit-locked to the splat)
- Pointer-lock mouse look for FPS-style exploration
- WASD movement with vertical motion and speed boost

## Run

```bash
npm install
npm run dev
```

Open the local URL from Vite, then:

1. Load a `.ply` file
2. Click inside the viewport to lock pointer
3. Explore with controls below

## Controls

- `W A S D`: move
- `Space`: move up
- `C`: move down
- `Shift`: speed boost
- `Mouse`: look around (pointer lock)
- `Esc`: release pointer lock
