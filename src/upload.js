import './upload.css'
import roomConfig from './room-config.json'
import { apiUrl } from './api'

const MAX_DURATION_SECONDS = 300

const app = document.querySelector('#app')
app.innerHTML = `
  <main class="screen">
    <section class="card">
      <header class="card-head">
        <h1>Upload Room Video</h1>
        <a class="back-link" href="/">Back to map</a>
      </header>
      <p class="sub">Submit a room walkthrough video (max 5 minutes) for Gaussian splat processing.</p>

      <form id="upload-form" class="form" novalidate>
        <label class="field">
          <span>Building</span>
          <select id="building" required>
            <option value="">Select a building</option>
          </select>
        </label>

        <label class="field">
          <span>Room Type</span>
          <select id="roomType" required disabled>
            <option value="">Select a room type</option>
          </select>
        </label>

        <label class="field">
          <span>Video File</span>
          <input id="video" type="file" accept="video/*" required />
          <small>Accepted: video files up to 5 minutes.</small>
        </label>

        <button id="submitBtn" type="submit">Submit Upload</button>
      </form>

      <p id="status" class="status">Loading configuration...</p>
    </section>
  </main>
`

const form = document.querySelector('#upload-form')
const buildingSelect = document.querySelector('#building')
const roomTypeSelect = document.querySelector('#roomType')
const videoInput = document.querySelector('#video')
const statusEl = document.querySelector('#status')
const submitBtn = document.querySelector('#submitBtn')

function setStatus(text, isError = false) {
  statusEl.textContent = text
  statusEl.classList.toggle('error', isError)
}

function populateBuildings() {
  const buildings = Object.keys(roomConfig).sort()
  for (const building of buildings) {
    const option = document.createElement('option')
    option.value = building
    option.textContent = building
    buildingSelect.append(option)
  }
}

function populateRoomTypes(building) {
  roomTypeSelect.innerHTML = '<option value="">Select a room type</option>'

  const roomTypes = roomConfig[building]?.['room-types'] || []
  for (const roomType of roomTypes) {
    const option = document.createElement('option')
    option.value = roomType
    option.textContent = roomType
    roomTypeSelect.append(option)
  }

  roomTypeSelect.disabled = roomTypes.length === 0
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

buildingSelect.addEventListener('change', () => {
  populateRoomTypes(buildingSelect.value)
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const building = buildingSelect.value
  const roomType = roomTypeSelect.value
  const file = videoInput.files?.[0]

  if (!building || !roomType || !file) {
    setStatus('Please choose building, room type, and a video file.', true)
    return
  }

  submitBtn.disabled = true
  setStatus('Validating video...')

  try {
    const duration = await getVideoDuration(file)
    if (!Number.isFinite(duration)) {
      throw new Error('Unable to validate video duration')
    }
    if (duration > MAX_DURATION_SECONDS) {
      throw new Error('Video must be 5 minutes or less')
    }

    setStatus('Submitting upload...')
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

    setStatus(
      typeof json.message === 'string'
        ? json.message
        : 'Thank you for your contribution to our platform! Your video is being processed, and will take some time (~15-30min depending on video duration) before being visible as a gaussian splat on the website. Check back later!'
    )
    form.reset()
    roomTypeSelect.disabled = true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    setStatus(message, true)
  } finally {
    submitBtn.disabled = false
  }
})

function init() {
  populateBuildings()
  setStatus('Choose a building, room type, and video to upload.')
}

init()
