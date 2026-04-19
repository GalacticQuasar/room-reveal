import './landing.css'
import maplibregl from 'maplibre-gl'
import roomConfig from './room-config.json'
import { apiUrl, fetchJson } from './api'

const COORD_OVERRIDE_STORAGE_KEY = 'room-reveal.coordinate-overrides'
const MAX_DURATION_SECONDS = 300
const UPLOAD_FAKE_PROGRESS_DURATION_MS = 25_000

function getMergedRoomConfig() {
  try {
    const rawOverrides = localStorage.getItem(COORD_OVERRIDE_STORAGE_KEY)
    if (!rawOverrides) {
      return roomConfig
    }

    const overrides = JSON.parse(rawOverrides)
    const merged = JSON.parse(JSON.stringify(roomConfig))

    for (const [residenceId, value] of Object.entries(overrides || {})) {
      if (!merged[residenceId]) {
        continue
      }

      if (Number.isFinite(value?.latitude)) {
        merged[residenceId].latitude = value.latitude
      }

      if (Number.isFinite(value?.longitude)) {
        merged[residenceId].longitude = value.longitude
      }
    }

    return merged
  } catch {
    return roomConfig
  }
}

const activeRoomConfig = getMergedRoomConfig()

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="landing-page">
    <img id="header-icon" src="/room-reveal-icon-transparent.png" alt="Room Reveal">
    <div id="map-container"></div>
    <div class="panel-frame">
      <aside class="left-panel" aria-label="Residence and room type selector">
        <a href="/" style="text-decoration: none;"><h1 class="panel-logo"><span class="primary">Room</span> <span class="accent">Reveal</span></h1></a>

        <div class="selection-stage">
          <p class="stage-label">Select Residence</p>
          <div id="residence-pods" class="pod-list" role="list"></div>
        </div>

        <div id="room-type-stage" class="selection-stage is-hidden" aria-live="polite">
          <p class="stage-label">Select Room Type</p>
          <div id="room-type-pods" class="pod-list" role="list"></div>
        </div>

        <div class="panel-actions">
          <button id="explore-room" class="cta-btn is-hidden" type="button">
            <span class="explore-btn-spinner" aria-hidden="true"></span>
            <span id="explore-room-label">Explore Room</span>
          </button>
          <button id="open-upload" class="ghost-btn" type="button">Upload Video</button>
        </div>
      </aside>
    </div>

    <div id="upload-modal" class="upload-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
      <div id="upload-modal-backdrop" class="upload-modal-backdrop" aria-hidden="true"></div>
      <section class="upload-modal-card">
        <header class="upload-modal-head">
          <h2 id="upload-modal-title">Upload Room Video</h2>
          <button id="close-upload-modal" class="upload-modal-close" type="button" aria-label="Close upload modal"></button>
        </header>
        <form id="upload-modal-form" class="upload-modal-form" novalidate>
          <label id="upload-dropzone" class="upload-dropzone" for="upload-video-input">
            <input id="upload-video-input" type="file" accept="video/*" required>
            <span class="upload-dropzone-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-icon lucide-file"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/></svg>
            </span>
            <span class="upload-dropzone-copy">
              <span class="upload-dropzone-title">Drop video here or click to browse</span>
              <span class="upload-dropzone-subtitle">Accepted: video files up to 5 minutes.</span>
              <span id="upload-selected-file" class="upload-selected-file">No file selected.</span>
            </span>
          </label>
          <button id="upload-modal-submit" class="cta-btn" type="submit">Submit Upload</button>
        </form>
        <div id="upload-progress" class="upload-progress" aria-hidden="true">
          <div id="upload-progress-track" class="upload-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div id="upload-progress-fill" class="upload-progress-fill"></div>
          </div>
          <p id="upload-progress-percent" class="upload-progress-percent">0%</p>
        </div>
        <p id="upload-modal-status" class="explore-status" aria-live="polite"></p>
      </section>
    </div>

    <div id="no-scans-modal" class="upload-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="no-scans-modal-title">
      <div id="no-scans-modal-backdrop" class="upload-modal-backdrop" aria-hidden="true"></div>
      <section class="upload-modal-card no-scans-modal-card">
        <header class="upload-modal-head">
          <h2 id="no-scans-modal-title">No Room Scans Yet</h2>
          <button id="close-no-scans-modal" class="upload-modal-close" type="button" aria-label="Close no scans modal"></button>
        </header>
        <p class="no-scans-modal-copy">No room scans are available yet for this selection.</p>
        <button id="dismiss-no-scans-modal" class="cta-btn" type="button">Got it</button>
      </section>
    </div>

    <div id="viewer-info" class="viewer-info">
      <p>Left Click + Drag to move around</p>
      <p>Right Click + Drag to change orientation</p>
    </div>
  </div>
`

const state = {
  selectedResidenceId: null,
  selectedRoomType: null,
  isResidenceExpanded: false,
  isRoomTypeExpanded: false,
}

const residences = Object.entries(activeRoomConfig)

const residencePods = document.getElementById('residence-pods')
const roomTypeStage = document.getElementById('room-type-stage')
const roomTypePods = document.getElementById('room-type-pods')
const exploreBtn = document.getElementById('explore-room')
const exploreBtnLabel = document.getElementById('explore-room-label')
const uploadBtn = document.getElementById('open-upload')
const landingPage = document.getElementById('landing-page')

const uploadModal = document.getElementById('upload-modal')
const uploadModalBackdrop = document.getElementById('upload-modal-backdrop')
const closeUploadModalBtn = document.getElementById('close-upload-modal')
const uploadForm = document.getElementById('upload-modal-form')
const uploadDropzone = document.getElementById('upload-dropzone')
const uploadVideoInput = document.getElementById('upload-video-input')
const uploadSelectedFile = document.getElementById('upload-selected-file')
const uploadModalSubmit = document.getElementById('upload-modal-submit')
const uploadModalStatus = document.getElementById('upload-modal-status')
const uploadProgress = document.getElementById('upload-progress')
const uploadProgressTrack = document.getElementById('upload-progress-track')
const uploadProgressFill = document.getElementById('upload-progress-fill')
const uploadProgressPercent = document.getElementById('upload-progress-percent')
const noScansModal = document.getElementById('no-scans-modal')
const noScansModalBackdrop = document.getElementById('no-scans-modal-backdrop')
const closeNoScansModalBtn = document.getElementById('close-no-scans-modal')
const dismissNoScansModalBtn = document.getElementById('dismiss-no-scans-modal')

let isExploring = false
let isUploading = false
let uploadFakeProgress = 0
let uploadRenderedProgress = 0
let uploadProgressTimer = null

function setUploadStatus(message, isError = false) {
  uploadModalStatus.textContent = message
  uploadModalStatus.classList.toggle('error', isError)
}

function syncLandingModalState() {
  const hasOpenModal =
    !uploadModal.classList.contains('is-hidden') || !noScansModal.classList.contains('is-hidden')
  landingPage.classList.toggle('upload-modal-open', hasOpenModal)
}

function updateSelectedFile(file) {
  if (!file) {
    uploadSelectedFile.textContent = 'No file selected.'
    return
  }
  uploadSelectedFile.textContent = `Selected: ${file.name}`
}

function resetUploadProgressState() {
  uploadFakeProgress = 0
  uploadRenderedProgress = 0
}

function stopUploadProgressTimer() {
  if (uploadProgressTimer) {
    window.clearInterval(uploadProgressTimer)
    uploadProgressTimer = null
  }
}

function renderUploadProgress(value) {
  uploadRenderedProgress = Math.max(uploadRenderedProgress, Math.min(Math.max(value, 0), 100))
  uploadProgressFill.style.width = `${uploadRenderedProgress}%`
  uploadProgressPercent.textContent = `${Math.round(uploadRenderedProgress)}%`
  uploadProgressTrack.setAttribute('aria-valuenow', String(Math.round(uploadRenderedProgress)))
}

function hideUploadProgress() {
  stopUploadProgressTimer()
  uploadProgress.classList.remove('is-visible')
  uploadProgress.setAttribute('aria-hidden', 'true')
  resetUploadProgressState()
  renderUploadProgress(0)
}

function startUploadProgress() {
  stopUploadProgressTimer()
  resetUploadProgressState()
  uploadProgress.classList.add('is-visible')
  uploadProgress.setAttribute('aria-hidden', 'false')
  renderUploadProgress(0)

  const startAt = Date.now()
  uploadProgressTimer = window.setInterval(() => {
    const elapsed = Date.now() - startAt
    const t = Math.min(elapsed / UPLOAD_FAKE_PROGRESS_DURATION_MS, 1)
    const eased = 1 - Math.pow(1 - t, 2)
    uploadFakeProgress = Math.max(uploadFakeProgress, 92 * eased)
    renderUploadProgress(uploadFakeProgress)
  }, 100)
}

async function finishUploadProgressSuccess() {
  stopUploadProgressTimer()
  renderUploadProgress(100)
  await new Promise((resolve) => window.setTimeout(resolve, 260))
  hideUploadProgress()
}

function finishUploadProgressError() {
  hideUploadProgress()
}

function setInputFile(file) {
  if (!file) {
    uploadVideoInput.value = ''
    updateSelectedFile(null)
    return
  }

  const transfer = new DataTransfer()
  transfer.items.add(file)
  uploadVideoInput.files = transfer.files
  updateSelectedFile(file)
}

function openUploadModal() {
  if (isUploading) {
    return
  }

  const building = state.selectedResidenceId
  const roomType = state.selectedRoomType
  if (!building || !roomType) {
    return
  }

  setUploadStatus('')
  hideUploadProgress()
  uploadModal.classList.remove('is-hidden')
  syncLandingModalState()
}

function closeUploadModal() {
  if (isUploading) {
    return
  }

  uploadModal.classList.add('is-hidden')
  uploadForm.reset()
  setInputFile(null)
  hideUploadProgress()
  syncLandingModalState()
}

function openNoScansModal() {
  noScansModal.classList.remove('is-hidden')
  syncLandingModalState()
}

function closeNoScansModal() {
  noScansModal.classList.add('is-hidden')
  syncLandingModalState()
}

async function getVideoDuration(file) {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'

  const duration = await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => {
      const value = Number.isFinite(video.duration) ? video.duration : NaN
      resolve(value)
    }
    video.onerror = () => reject(new Error('Unable to read video duration'))
    video.src = objectUrl
  })

  URL.revokeObjectURL(objectUrl)
  return duration
}

function toDisplayName(value) {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function createPodButton(text, isSelected, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `pod${isSelected ? ' is-selected' : ''}`
  button.textContent = text
  button.addEventListener('click', onClick)
  return button
}

function capturePodSnapshot(container) {
  const snapshot = new Map()
  container.querySelectorAll('.pod').forEach((pod) => {
    const podId = pod.dataset.podId
    if (!podId) {
      return
    }

    const rect = pod.getBoundingClientRect()
    snapshot.set(podId, {
      top: rect.top,
      left: rect.left,
    })
  })
  return snapshot
}

function animatePodTransition(container, previousSnapshot) {
  container.querySelectorAll('.pod').forEach((pod) => {
    const podId = pod.dataset.podId
    const previous = podId ? previousSnapshot.get(podId) : null

    if (!previous) {
      pod.animate(
        [
          { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: 420,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both',
        }
      )
      return
    }

    const nextRect = pod.getBoundingClientRect()
    const dx = previous.left - nextRect.left
    const dy = previous.top - nextRect.top

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      return
    }

    const isSelected = pod.classList.contains('is-selected')
    pod.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      {
        duration: isSelected ? 740 : 560,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both',
      }
    )
  })
}

function renderResidencePods() {
  const selectedId = state.selectedResidenceId
  const shouldShowAll = !selectedId || state.isResidenceExpanded
  const items = shouldShowAll
    ? residences
    : residences.filter(([id]) => id === selectedId)

  residencePods.replaceChildren(
    ...items.map(([id]) =>
      createPodButton(toDisplayName(id), id === selectedId, () => {
        if (id === state.selectedResidenceId) {
          state.isResidenceExpanded = !state.isResidenceExpanded
          renderSelectionState()
          return
        }

        state.selectedResidenceId = id
        state.selectedRoomType = null
        state.isResidenceExpanded = false
        state.isRoomTypeExpanded = false

        const residence = activeRoomConfig[id]
        const hasCoords = Number.isFinite(residence?.latitude) && Number.isFinite(residence?.longitude)

        if (hasCoords) {
          map.flyTo({
            center: [residence.longitude, residence.latitude],
            zoom: 17.4,
            pitch: 55,
            bearing: -25,
            duration: 1700,
            essential: true,
          })
        }

        renderSelectionState()
      })
    )
  )

  residencePods.querySelectorAll('.pod').forEach((pod, index) => {
    pod.dataset.podId = items[index]?.[0] || ''
  })
}

function renderRoomTypePods() {
  const residenceId = state.selectedResidenceId
  if (!residenceId) {
    roomTypeStage.classList.add('is-hidden')
    roomTypePods.replaceChildren()
    return
  }

  const roomTypes = [...(activeRoomConfig[residenceId]['room-types'] || [])]
  const selectedRoom = state.selectedRoomType

  roomTypeStage.classList.remove('is-hidden')

  if (roomTypes.length === 0) {
    const noRooms = document.createElement('p')
    noRooms.className = 'room-type-empty'
    noRooms.textContent = 'No room types listed yet.'
    roomTypePods.replaceChildren(noRooms)
    return
  }

  const shouldShowAll = !selectedRoom || state.isRoomTypeExpanded
  const visibleRoomTypes = shouldShowAll ? roomTypes : roomTypes.filter((room) => room === selectedRoom)

  roomTypePods.replaceChildren(
    ...visibleRoomTypes.map((roomType) =>
      createPodButton(roomType, roomType === selectedRoom, () => {
        if (roomType === state.selectedRoomType) {
          state.isRoomTypeExpanded = !state.isRoomTypeExpanded
          renderSelectionState()
          return
        }

        state.selectedRoomType = roomType
        state.isRoomTypeExpanded = false
        renderSelectionState()
      })
    )
  )

  roomTypePods.querySelectorAll('.pod').forEach((pod, index) => {
    pod.dataset.podId = visibleRoomTypes[index] || ''
  })
}

function renderSelectionState() {
  const residenceSnapshot = capturePodSnapshot(residencePods)
  const roomTypeSnapshot = capturePodSnapshot(roomTypePods)

  renderResidencePods()
  renderRoomTypePods()

  const readyToExplore = Boolean(state.selectedResidenceId && state.selectedRoomType)
  exploreBtn.classList.toggle('is-hidden', !readyToExplore)
  uploadBtn.classList.toggle('is-hidden', !readyToExplore)
  exploreBtn.disabled = !readyToExplore || isExploring
  exploreBtn.classList.toggle('is-loading', isExploring)
  exploreBtnLabel.textContent = isExploring ? 'Fetching 3D Models...' : 'Explore Room'

  requestAnimationFrame(() => {
    animatePodTransition(residencePods, residenceSnapshot)
    animatePodTransition(roomTypePods, roomTypeSnapshot)
  })
}

const map = new maplibregl.Map({
  container: 'map-container',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [-86.9196215, 40.4284539],
  zoom: 17,
  pitch: 55,
  bearing: -25,
})

// Frieda Parker Residence Hall Coordinates: 40.4284539,-86.9196215

map.addControl(new maplibregl.NavigationControl())

uploadBtn.addEventListener('click', () => {
  openUploadModal()
})

closeUploadModalBtn.addEventListener('click', () => {
  closeUploadModal()
})

uploadModalBackdrop.addEventListener('click', () => {
  closeUploadModal()
})

closeNoScansModalBtn.addEventListener('click', () => {
  closeNoScansModal()
})

dismissNoScansModalBtn.addEventListener('click', () => {
  closeNoScansModal()
})

noScansModalBackdrop.addEventListener('click', () => {
  closeNoScansModal()
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return
  }

  if (!noScansModal.classList.contains('is-hidden')) {
    closeNoScansModal()
    return
  }

  if (!uploadModal.classList.contains('is-hidden')) {
    closeUploadModal()
  }
})

uploadVideoInput.addEventListener('change', () => {
  const file = uploadVideoInput.files?.[0] || null
  updateSelectedFile(file)
})

uploadDropzone.addEventListener('dragover', (event) => {
  event.preventDefault()
  uploadDropzone.classList.add('is-dragging')
})

uploadDropzone.addEventListener('dragleave', (event) => {
  if (event.currentTarget === event.target) {
    uploadDropzone.classList.remove('is-dragging')
  }
})

uploadDropzone.addEventListener('drop', (event) => {
  event.preventDefault()
  uploadDropzone.classList.remove('is-dragging')

  const file = event.dataTransfer?.files?.[0]
  if (!file) {
    return
  }
  if (!file.type.startsWith('video/')) {
    setUploadStatus('Please drop a valid video file.', true)
    return
  }

  setInputFile(file)
  setUploadStatus('Video selected. Ready to upload.')
})

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (isUploading) {
    return
  }

  const building = state.selectedResidenceId
  const roomType = state.selectedRoomType
  const file = uploadVideoInput.files?.[0]

  if (!building || !roomType || !file) {
    setUploadStatus('Please drag/drop or select a video file before submission.', true)
    return
  }

  isUploading = true
  uploadModalSubmit.disabled = true
  setUploadStatus('Validating video...')

  try {
    const duration = await getVideoDuration(file)
    if (!Number.isFinite(duration)) {
      throw new Error('Unable to validate video duration')
    }
    if (duration > MAX_DURATION_SECONDS) {
      throw new Error('Video must be 5 minutes or less')
    }

    setUploadStatus('')
    startUploadProgress()
    const payload = new FormData()
    payload.append('video', file)
    payload.append('building', building)
    payload.append('room_type', roomType)

    const response = await fetch(apiUrl('/upload'), {
      method: 'POST',
      body: payload,
    })

    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = typeof json.detail === 'string' ? json.detail : 'Upload failed'
      throw new Error(message)
    }

    setUploadStatus(
      typeof json.message === 'string'
        ? json.message
        : 'Thank you for your contribution! Processing takes about 15-30 minutes before the splat appears.'
    )
    await finishUploadProgressSuccess()
    uploadForm.reset()
    setInputFile(null)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    setUploadStatus(message, true)
    finishUploadProgressError()
  } finally {
    isUploading = false
    uploadModalSubmit.disabled = false
  }
})

exploreBtn.addEventListener('click', async () => {
  const building = state.selectedResidenceId
  const roomType = state.selectedRoomType

  if (!building || !roomType || isExploring) {
    return
  }

  isExploring = true
  renderSelectionState()

  try {
    const splats = await fetchJson(`/splats/${encodeURIComponent(building)}/${encodeURIComponent(roomType)}`)
    if (!Array.isArray(splats) || splats.length === 0) {
      openNoScansModal()
      return
    }

    const firstId = splats
      .map((item) => (typeof item?.id === 'string' ? item.id : ''))
      .map((id) => (id.endsWith('.ply') ? id.slice(0, -4) : id))
      .find((id) => id)

    if (!firstId) {
      openNoScansModal()
      return
    }

    const search = new URLSearchParams({
      building,
      room_type: roomType,
      splat_id: firstId,
    })

    window.location.href = `/viewer.html?${search.toString()}`
  } catch (error) {
    console.error(error)
    openNoScansModal()
  } finally {
    isExploring = false
    renderSelectionState()
  }
})

map.on('load', () => {
  const buildingLayers = map.getStyle().layers.filter(
    (l) => l.source === 'carto' && l['source-layer'] === 'building'
  )
  for (const layer of buildingLayers) {
    map.removeLayer(layer.id)
  }

  map.addLayer({
    id: '3d-buildings',
    source: 'carto',
    'source-layer': 'building',
    filter: ['!=', 'hide_3d', true],
    type: 'fill-extrusion',
    minzoom: 15,
    paint: {
      'fill-extrusion-color': '#555',
      'fill-extrusion-height': ['get', 'render_height'],
      'fill-extrusion-base': ['get', 'render_min_height'],
      'fill-extrusion-opacity': 0.8,
    },
  })

  renderSelectionState()
})
