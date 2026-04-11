import './style.css'
import * as THREE from 'three'
import { SplatFileType, SplatMesh } from '@sparkjsdev/spark'
import startPositions from './start-positions.json'

const app = document.querySelector('#app')
app.innerHTML = `
  <div class="viewer-shell">
    <canvas id="viewport"></canvas>
    <aside class="hud">
      <h1>Spark Gaussian Splat Viewer</h1>
      <p class="hint">Load a .ply splat, click the scene, then roam with WASD + mouse.</p>
      <label class="upload">
        <input id="plyInput" type="file" accept=".ply" />
        <span>Load PLY</span>
      </label>
      <button id="logCoordsBtn" class="secondary-btn" type="button" disabled>Log current position</button>
      <p id="status">Waiting for file...</p>
      <div class="controls">
        <p><strong>Move:</strong> W A S D</p>
        <p><strong>Up / Down:</strong> Space / C</p>
        <p><strong>Boost:</strong> Shift</p>
        <p><strong>Mouse look:</strong> Pointer lock</p>
        <p><strong>Unlock:</strong> Esc</p>
      </div>
    </aside>
  </div>
`

const canvas = document.querySelector('#viewport')
const input = document.querySelector('#plyInput')
const status = document.querySelector('#status')
const logCoordsBtn = document.querySelector('#logCoordsBtn')

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x0a111f, 22, 140)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 3000)
camera.position.set(0, 1.25, 5)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

const hemi = new THREE.HemisphereLight(0xffffff, 0x1d2a45, 0.45)
scene.add(hemi)

const grid = new THREE.GridHelper(300, 300, 0x35527f, 0x233350)
grid.position.y = -2
scene.add(grid)

let activeSplat = null
let activeFileName = ''
const keyState = {}
const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const worldUp = new THREE.Vector3(0, 1, 0)
const moveDir = new THREE.Vector3()
const lookForward = new THREE.Vector3()
const lookRight = new THREE.Vector3()
const clock = new THREE.Clock()

const lookSensitivity = 0.0018
const baseSpeed = 8
const boostMultiplier = 2.4

function applySplatOrientation(splat) {
  if (!splat) return
  splat.rotation.x = -Math.PI
}

function setStatus(message, isError = false) {
  status.textContent = message
  status.classList.toggle('error', isError)
}

function getHardcodedStartPosition(fileName) {
  if (!fileName) return null

  const exact = startPositions[fileName]
  if (exact) return exact

  const lowerName = fileName.toLowerCase()
  for (const [key, coords] of Object.entries(startPositions)) {
    if (key.toLowerCase() === lowerName) {
      return coords
    }
  }

  return null
}

function formatCoord(value) {
  return Number(value.toFixed(4))
}

function buildPositionJsonEntry(fileName, position) {
  const coords = {
    x: formatCoord(position.x),
    y: formatCoord(position.y),
    z: formatCoord(position.z),
  }

  return `"${fileName}": ${JSON.stringify(coords)}`
}

async function loadPlyFile(file) {
  try {
    setStatus(`Loading ${file.name}...`)

    if (activeSplat) {
      scene.remove(activeSplat)
      activeSplat.dispose()
      activeSplat = null
    }
    activeFileName = ''
    logCoordsBtn.disabled = true

    const fileBytes = new Uint8Array(await file.arrayBuffer())
    const splat = new SplatMesh({
      fileBytes,
      fileType: SplatFileType.PLY,
      fileName: file.name,
      maxSplats: 4_000_000,
    })

    await splat.initialized
    applySplatOrientation(splat)
    scene.add(splat)
    activeSplat = splat

    const bounds = splat.getBoundingBox(true)
    const center = bounds.getCenter(new THREE.Vector3())
    const hardcodedStart = getHardcodedStartPosition(file.name)

    if (
      hardcodedStart &&
      Number.isFinite(hardcodedStart.x) &&
      Number.isFinite(hardcodedStart.y) &&
      Number.isFinite(hardcodedStart.z)
    ) {
      camera.position.set(hardcodedStart.x, hardcodedStart.y, hardcodedStart.z)
      camera.lookAt(center)
    } else {
      camera.position.copy(center)
    }

    activeFileName = file.name
    logCoordsBtn.disabled = false
    setStatus(`Loaded ${file.name}. Click inside the scene to lock pointer and fly.`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while loading file'
    setStatus(`Failed to load PLY: ${message}`, true)
  }
}

input.addEventListener('change', (event) => {
  const file = event.target.files?.[0]
  if (file) {
    void loadPlyFile(file)
  }
})

logCoordsBtn.addEventListener('click', async () => {
  if (!activeSplat || !activeFileName) {
    setStatus('Load a file before logging coordinates.', true)
    return
  }

  const entry = buildPositionJsonEntry(activeFileName, camera.position)
  console.log('[START_POSITION_ENTRY]', entry)

  try {
    await navigator.clipboard.writeText(entry)
    setStatus(`Logged start position for ${activeFileName}. Copied entry to clipboard.`)
  } catch {
    setStatus(`Logged start position for ${activeFileName}. Check the console output.`)
  }
})

window.addEventListener('dragover', (event) => {
  event.preventDefault()
})

window.addEventListener('drop', (event) => {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file && file.name.toLowerCase().endsWith('.ply')) {
    void loadPlyFile(file)
  }
})

document.addEventListener('keydown', (event) => {
  keyState[event.code] = true
})

document.addEventListener('keyup', (event) => {
  keyState[event.code] = false
})

canvas.addEventListener('click', () => {
  void canvas.requestPointerLock()
})

document.addEventListener('pointerlockchange', () => {
  const isLocked = document.pointerLockElement === canvas
  if (isLocked) {
    setStatus('Pointer locked. Flying mode active.')
  }
})

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) {
    return
  }

  euler.setFromQuaternion(camera.quaternion)
  euler.y -= event.movementX * lookSensitivity
  euler.x -= event.movementY * lookSensitivity
  euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x))
  camera.quaternion.setFromEuler(euler)
})

function updateCameraMovement(deltaTime) {
  moveDir.set(0, 0, 0)
  camera.getWorldDirection(lookForward)
  lookRight.crossVectors(lookForward, worldUp).normalize()

  if (keyState.KeyW) moveDir.add(lookForward)
  if (keyState.KeyS) moveDir.sub(lookForward)
  if (keyState.KeyA) moveDir.sub(lookRight)
  if (keyState.KeyD) moveDir.add(lookRight)
  if (keyState.Space) moveDir.add(worldUp)
  if (keyState.KeyC) moveDir.sub(worldUp)

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize()
    const speed = keyState.ShiftLeft || keyState.ShiftRight ? baseSpeed * boostMultiplier : baseSpeed
    camera.position.addScaledVector(moveDir, speed * deltaTime)
  }
}

function animate() {
  const deltaTime = Math.min(clock.getDelta(), 0.05)
  updateCameraMovement(deltaTime)
  renderer.render(scene, camera)
}

renderer.setAnimationLoop(animate)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
