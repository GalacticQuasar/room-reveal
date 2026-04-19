import './select.css'
import roomConfig from './room-config.json'
import { fetchJson } from './api'

const app = document.querySelector('#app')
app.innerHTML = `
  <main class="screen">
    <section class="card">
      <header class="card-head">
        <h1>Select a Splat</h1>
        <a class="back-link" href="/">Back to map</a>
      </header>
      <p class="sub">Temporary selector for building, room type, and available Gaussian splats.</p>

      <div class="fields">
        <label class="field">
          <span>Building</span>
          <select id="building">
            <option value="">Select a building</option>
          </select>
        </label>

        <label class="field">
          <span>Room Type</span>
          <select id="roomType" disabled>
            <option value="">Select a room type</option>
          </select>
        </label>

        <label class="field">
          <span>Available Splats</span>
          <select id="splat" disabled>
            <option value="">Select a splat</option>
          </select>
        </label>
      </div>

      <button id="viewBtn" type="button" disabled>VIEW</button>
      <p id="status" class="status">Loading configuration...</p>
    </section>
  </main>
`

const buildingSelect = document.querySelector('#building')
const roomTypeSelect = document.querySelector('#roomType')
const splatSelect = document.querySelector('#splat')
const viewBtn = document.querySelector('#viewBtn')
const statusEl = document.querySelector('#status')

let splatCache = {}

function setStatus(text, isError = false) {
  statusEl.textContent = text
  statusEl.classList.toggle('error', isError)
}

function resetSelect(select, placeholder) {
  select.innerHTML = ''
  const option = document.createElement('option')
  option.value = ''
  option.textContent = placeholder
  select.append(option)
}

function normalizeId(value) {
  return value.endsWith('.ply') ? value.slice(0, -4) : value
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

async function loadSplatsFor(building, roomType) {
  const cacheKey = `${building}|${roomType}`
  if (!splatCache[cacheKey]) {
    const data = await fetchJson(`/splats/${encodeURIComponent(building)}/${encodeURIComponent(roomType)}`)
    splatCache[cacheKey] = data
  }
  return splatCache[cacheKey]
}

async function refreshRoomTypes() {
  const building = buildingSelect.value
  resetSelect(roomTypeSelect, 'Select a room type')
  resetSelect(splatSelect, 'Select a splat')
  roomTypeSelect.disabled = true
  splatSelect.disabled = true
  viewBtn.disabled = true

  if (!building) {
    setStatus('Choose a building to continue.')
    return
  }

  const roomTypes = roomConfig[building]?.['room-types'] || []
  for (const roomType of roomTypes) {
    const option = document.createElement('option')
    option.value = roomType
    option.textContent = roomType
    roomTypeSelect.append(option)
  }

  roomTypeSelect.disabled = roomTypes.length === 0
  setStatus('Select a room type to list available splats.')
}

async function refreshSplats() {
  const building = buildingSelect.value
  const roomType = roomTypeSelect.value
  resetSelect(splatSelect, 'Select a splat')
  splatSelect.disabled = true
  viewBtn.disabled = true

  if (!building || !roomType) {
    setStatus('Select building and room type first.')
    return
  }

  setStatus('Loading splats...')

  try {
    const splats = await loadSplatsFor(building, roomType)

    for (const item of splats) {
      const id = normalizeId(item.id || '')
      if (!id) continue
      const option = document.createElement('option')
      option.value = id
      option.textContent = id
      splatSelect.append(option)
    }

    splatSelect.disabled = splats.length === 0
    setStatus(splats.length === 0 ? 'No splats found for this selection.' : 'Select a splat and click VIEW.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load splats'
    setStatus(message, true)
  }
}

buildingSelect.addEventListener('change', () => {
  void refreshRoomTypes()
})

roomTypeSelect.addEventListener('change', () => {
  void refreshSplats()
})

splatSelect.addEventListener('change', () => {
  viewBtn.disabled = !splatSelect.value
})

viewBtn.addEventListener('click', () => {
  const building = buildingSelect.value
  const roomType = roomTypeSelect.value
  const splatId = splatSelect.value
  if (!building || !roomType || !splatId) return

  const search = new URLSearchParams({
    building,
    room_type: roomType,
    splat_id: splatId,
  })
  window.location.href = `/viewer.html?${search.toString()}`
})

function init() {
  populateBuildings()
  setStatus('Select a building to get started.')
}

init()
