import './style.css'
import * as THREE from 'three'
import { SplatFileType, SplatMesh } from '@sparkjsdev/spark'
import { apiUrl, fetchJson } from './api'

const params = new URLSearchParams(window.location.search)
const building = params.get('building')
const roomType = params.get('room_type')
const splatId = params.get('splat_id')

const app = document.querySelector('#app')
app.innerHTML = `
  <div class="viewer-shell">
    <canvas id="viewport"></canvas>
    <button id="exitViewer" class="viewer-action exit-viewer-btn" type="button" aria-label="Exit viewer">Exit Viewer</button>
    <aside id="controlsPod" class="controls-pod is-hidden" aria-label="Viewer controls">
      <p><strong>Move:</strong> WASD / Arrow Keys</p>
      <p><strong>Up / Down:</strong> Space / Shift</p>
      <p><strong>Look:</strong> Mouse (click to lock)</p>
      <p><strong>Unlock:</strong> Esc</p>
      <p><strong>Switch Rooms:</strong> Arrow Left / Right</p>
    </aside>
    <button id="recenterBtn" class="viewer-action recenter-btn is-hidden" type="button" aria-label="Re-center camera">
      Re-center
    </button>
    <section id="loadingOverlay" class="loading-overlay">
      <div class="loading-card">
        <p id="loadingTitle" class="loading-title">Preparing room...</p>
        <p id="loadingSubtitle" class="loading-subtitle">Initializing viewer</p>
        <div class="loading-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div id="loadingFill" class="loading-fill"></div>
        </div>
        <p id="loadingPercent" class="loading-percent">0%</p>
      </div>
    </section>
    <button id="prevSplat" class="nav-arrow nav-arrow-left" type="button" aria-label="View previous splat"><span class="nav-arrow-glyph" aria-hidden="true">&#x2039;</span></button>
    <button id="nextSplat" class="nav-arrow nav-arrow-right" type="button" aria-label="View next splat"><span class="nav-arrow-glyph" aria-hidden="true">&#x203A;</span></button>
  </div>
`

const canvas = document.querySelector('#viewport')
const exitViewerButton = document.querySelector('#exitViewer')
const controlsPod = document.querySelector('#controlsPod')
const recenterButton = document.querySelector('#recenterBtn')
const loadingOverlay = document.querySelector('#loadingOverlay')
const loadingTitle = document.querySelector('#loadingTitle')
const loadingSubtitle = document.querySelector('#loadingSubtitle')
const loadingFill = document.querySelector('#loadingFill')
const loadingPercent = document.querySelector('#loadingPercent')
const prevSplatButton = document.querySelector('#prevSplat')
const nextSplatButton = document.querySelector('#nextSplat')

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 3000)
camera.position.set(0, 1.25, 5)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

let activeSplat = null
let availableSplats = []
let currentSplatIndex = -1
let isLoadingSplat = false
let hasLoadedSplat = false
let fakeProgress = 0
let realProgress = 0
let renderedProgress = 0
let fakeProgressTimer = null
const keyState = {}
const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const worldUp = new THREE.Vector3(0, 1, 0)
const moveDir = new THREE.Vector3()
const lookForward = new THREE.Vector3()
const lookRight = new THREE.Vector3()
const clock = new THREE.Clock()

const lookSensitivity = 0.0018
const baseSpeed = 0.75

function applySplatOrientation(splat) {
  if (!splat) return
  splat.rotation.x = -Math.PI / 2
  splat.rotation.z = Math.PI
}

function normalizeSplatId(value) {
  if (typeof value !== 'string' || !value) return ''
  return value.endsWith('.ply') ? value.slice(0, -4) : value
}

function resetLoadingProgressState() {
  fakeProgress = 0
  realProgress = 0
  renderedProgress = 0
}

function stopFakeProgressTimer() {
  if (fakeProgressTimer) {
    window.clearInterval(fakeProgressTimer)
    fakeProgressTimer = null
  }
}

function renderLoadingProgress(value) {
  renderedProgress = Math.max(renderedProgress, Math.min(Math.max(value, 0), 100))
  loadingFill.style.width = `${renderedProgress}%`
  loadingPercent.textContent = `${Math.round(renderedProgress)}%`
  loadingOverlay
    .querySelector('.loading-track')
    ?.setAttribute('aria-valuenow', String(Math.round(renderedProgress)))
}

function startLoadingOverlay(fileName) {
  stopFakeProgressTimer()
  resetLoadingProgressState()

  loadingTitle.textContent = 'Loading 3D Gaussian Splat'
  loadingSubtitle.textContent = `File: ${fileName}`
  loadingOverlay.classList.remove('is-error')
  loadingOverlay.classList.add('is-visible')
  renderLoadingProgress(0)

  const startAt = Date.now()
  const fakeDurationMs = 30_000
  const postDurationIncrementMs = 5_000

  fakeProgressTimer = window.setInterval(() => {
    const elapsed = Date.now() - startAt
    if (elapsed <= fakeDurationMs) {
      const t = Math.min(elapsed / fakeDurationMs, 1)
      // Ease toward 92% over 30s while waiting for actual completion.
      const eased = 1 - Math.pow(1 - t, 2)
      fakeProgress = Math.max(fakeProgress, 92 * eased)
    } else {
      const postDurationElapsed = elapsed - fakeDurationMs
      const postDurationSteps = Math.floor(postDurationElapsed / postDurationIncrementMs)
      const postDurationProgress = Math.min(92 + postDurationSteps, 99)
      fakeProgress = Math.max(fakeProgress, postDurationProgress)
    }

    renderLoadingProgress(Math.max(fakeProgress, realProgress))
  }, 100)
}

function setRealProgress(fraction) {
  if (!Number.isFinite(fraction) || fraction <= 0) {
    return
  }

  realProgress = Math.max(realProgress, Math.min(fraction, 1) * 100)
  renderLoadingProgress(Math.max(fakeProgress, realProgress))
}

async function finishLoadingOverlaySuccess() {
  stopFakeProgressTimer()
  renderLoadingProgress(100)
  await new Promise((resolve) => window.setTimeout(resolve, 260))
  loadingOverlay.classList.remove('is-visible')
}

async function finishLoadingOverlayError(message) {
  stopFakeProgressTimer()
  loadingOverlay.classList.add('is-error')
  loadingSubtitle.textContent = message
  await new Promise((resolve) => window.setTimeout(resolve, 1200))
  loadingOverlay.classList.remove('is-visible')
}

async function fetchPlyBytesWithProgress(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to fetch splat (${response.status})`)
  }

  const totalBytes = Number(response.headers.get('content-length') || 0)
  if (!response.body || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
  }

  const reader = response.body.getReader()
  const chunks = []
  let receivedBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (!value) {
      continue
    }

    chunks.push(value)
    receivedBytes += value.byteLength
    setRealProgress(receivedBytes / totalBytes)
  }

  const fileBytes = new Uint8Array(receivedBytes)
  let writeOffset = 0
  for (const chunk of chunks) {
    fileBytes.set(chunk, writeOffset)
    writeOffset += chunk.byteLength
  }

  return fileBytes
}

function updateArrowState() {
  const hasLeft = !isLoadingSplat && availableSplats.length > 1 && currentSplatIndex > 0
  const hasRight =
    !isLoadingSplat && availableSplats.length > 1 && currentSplatIndex >= 0 && currentSplatIndex < availableSplats.length - 1

  prevSplatButton.classList.toggle('is-hidden', !hasLeft)
  nextSplatButton.classList.toggle('is-hidden', !hasRight)
  prevSplatButton.disabled = !hasLeft
  nextSplatButton.disabled = !hasRight

  controlsPod.classList.toggle('is-hidden', !hasLoadedSplat)
  recenterButton.classList.toggle('is-hidden', !hasLoadedSplat)
}

function recenterCamera() {
  camera.position.set(0, 0, 0)
  camera.quaternion.set(0, 0, 0, 1)
  euler.set(0, 0, 0)
}

async function loadSplatByIndex(nextIndex) {
  if (isLoadingSplat || nextIndex < 0 || nextIndex >= availableSplats.length) {
    return
  }

  const nextId = availableSplats[nextIndex]
  if (!nextId) {
    return
  }

  isLoadingSplat = true
  updateArrowState()

  const fileName = `${nextId}.ply`
  startLoadingOverlay(fileName)
  try {
    const url = apiUrl(`/splats/${encodeURIComponent(building)}/${encodeURIComponent(roomType)}/${encodeURIComponent(fileName)}`)
    const fileBytes = await fetchPlyBytesWithProgress(url)

    const splat = new SplatMesh({
      fileBytes,
      fileType: SplatFileType.PLY,
      fileName,
      maxSplats: 4_000_000,
    })

    await splat.initialized
    applySplatOrientation(splat)

    const previousSplat = activeSplat
    scene.add(splat)
    activeSplat = splat
    if (previousSplat) {
      scene.remove(previousSplat)
      previousSplat.dispose()
    }

    recenterCamera()

    currentSplatIndex = nextIndex
    hasLoadedSplat = true
    await finishLoadingOverlaySuccess()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while loading file'
    console.error(`Failed to load PLY ${fileName}:`, message)
    await finishLoadingOverlayError(message)
  } finally {
    isLoadingSplat = false
    updateArrowState()
  }
}

function goToPreviousSplat() {
  if (currentSplatIndex <= 0) {
    return
  }
  void loadSplatByIndex(currentSplatIndex - 1)
}

function goToNextSplat() {
  if (currentSplatIndex < 0 || currentSplatIndex >= availableSplats.length - 1) {
    return
  }
  void loadSplatByIndex(currentSplatIndex + 1)
}

prevSplatButton.addEventListener('click', goToPreviousSplat)
nextSplatButton.addEventListener('click', goToNextSplat)
recenterButton.addEventListener('click', recenterCamera)
exitViewerButton.addEventListener('click', () => {
  window.location.href = '/'
})

document.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowLeft' && document.pointerLockElement !== canvas) {
    event.preventDefault()
    goToPreviousSplat()
    return
  }

  if (event.code === 'ArrowRight' && document.pointerLockElement !== canvas) {
    event.preventDefault()
    goToNextSplat()
    return
  }

  const isVerticalMoveKey = event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight'
  if (isVerticalMoveKey && document.pointerLockElement !== canvas) {
    return
  }

  keyState[event.code] = true
})

document.addEventListener('keyup', (event) => {
  keyState[event.code] = false
})

canvas.addEventListener('click', () => {
  void canvas.requestPointerLock()
})

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) {
    keyState.Space = false
    keyState.ShiftLeft = false
    keyState.ShiftRight = false
  }
  updateArrowState()
})

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) {
    return
  }

  // If Chrome reports a physically impossible mouse movement in a single event,
  // it's the Pointer Lock bug. Ignore this event entirely.
  const movementThreshold = 150; 
  if (Math.abs(event.movementX) > movementThreshold || Math.abs(event.movementY) > movementThreshold) {
    return;
  }

  euler.y -= event.movementX * lookSensitivity
  euler.x -= event.movementY * lookSensitivity
  euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x))
  camera.quaternion.setFromEuler(euler)
})

function updateCameraMovement(deltaTime) {
  moveDir.set(0, 0, 0)
  const isLookModeActive = document.pointerLockElement === canvas
  camera.getWorldDirection(lookForward)
  lookRight.crossVectors(lookForward, worldUp).normalize()

  if (keyState.KeyW || keyState.ArrowUp) moveDir.add(lookForward)
  if (keyState.KeyS || keyState.ArrowDown) moveDir.sub(lookForward)
  if (keyState.KeyA || keyState.ArrowLeft) moveDir.sub(lookRight)
  if (keyState.KeyD || keyState.ArrowRight) moveDir.add(lookRight)
  if (isLookModeActive && keyState.Space) moveDir.add(worldUp)
  if (isLookModeActive && (keyState.ShiftLeft || keyState.ShiftRight)) moveDir.sub(worldUp)

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize()
    camera.position.addScaledVector(moveDir, baseSpeed * deltaTime)
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

async function initializeViewer() {
  if (!building || !roomType) {
    loadingOverlay.classList.remove('is-visible')
    updateArrowState()
    return
  }

  try {
    const splats = await fetchJson(`/splats/${encodeURIComponent(building)}/${encodeURIComponent(roomType)}`)
    availableSplats = Array.isArray(splats)
      ? splats
          .map((item) => normalizeSplatId(item?.id))
          .filter((id) => id)
      : []
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch splat list'
    console.error(message)
    availableSplats = []
  }

  if (availableSplats.length === 0 && splatId) {
    const fallbackId = normalizeSplatId(splatId)
    if (fallbackId) {
      availableSplats = [fallbackId]
    }
  }

  if (availableSplats.length === 0) {
    loadingTitle.textContent = 'No room scans found'
    loadingSubtitle.textContent = 'Return to landing and choose another room type.'
    loadingOverlay.classList.add('is-visible')
    renderLoadingProgress(100)
    updateArrowState()
    return
  }

  const requestedId = normalizeSplatId(splatId)
  const requestedIndex = requestedId ? availableSplats.findIndex((id) => id === requestedId) : -1
  const startIndex = requestedIndex >= 0 ? requestedIndex : 0
  await loadSplatByIndex(startIndex)
}

updateArrowState()
void initializeViewer()
