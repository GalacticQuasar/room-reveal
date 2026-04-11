import './style.css'
import * as THREE from 'three'
import { SplatFileType, SplatMesh } from '@sparkjsdev/spark'

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
      <p id="status">Waiting for file...</p>
      <div class="controls">
        <p><strong>Move:</strong> W A S D</p>
        <p><strong>Up / Down:</strong> Space / C</p>
        <p><strong>Boost:</strong> Shift</p>
        <p><strong>Mouse look:</strong> Pointer lock</p>
        <p><strong>Unlock:</strong> Esc</p>
        <label class="toggle-row">
          <input id="rotateToggle" type="checkbox" />
          <span>Apply 180deg rotation correction</span>
        </label>
      </div>
    </aside>
  </div>
`

const canvas = document.querySelector('#viewport')
const input = document.querySelector('#plyInput')
const status = document.querySelector('#status')
const rotateToggle = document.querySelector('#rotateToggle')

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
let useRotationCorrection = false

function applySplatOrientation(splat) {
  if (!splat) return
  splat.rotation.x = useRotationCorrection ? -Math.PI : 0
}

function setStatus(message, isError = false) {
  status.textContent = message
  status.classList.toggle('error', isError)
}

async function loadPlyFile(file) {
  try {
    setStatus(`Loading ${file.name}...`)

    if (activeSplat) {
      scene.remove(activeSplat)
      activeSplat.dispose()
      activeSplat = null
    }

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
    const size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 1)

    camera.position.copy(center).add(new THREE.Vector3(0, size * 0.18, size * 0.55))
    camera.lookAt(center)
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

rotateToggle.addEventListener('change', (event) => {
  useRotationCorrection = event.target.checked
  applySplatOrientation(activeSplat)
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
