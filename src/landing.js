import './landing.css'
import maplibregl from 'maplibre-gl'
import roomConfig from './room-config.json'

const COORD_OVERRIDE_STORAGE_KEY = 'room-reveal.coordinate-overrides'

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
    <div id="map-container"></div>
    <div class="panel-frame">
      <aside class="left-panel" aria-label="Residence and room type selector">
        <h1 class="panel-logo"><span class="primary">Room</span> <span class="accent">Reveal</span></h1>

        <div class="selection-stage">
          <p class="stage-label">Select Residence</p>
          <div id="residence-pods" class="pod-list" role="list"></div>
        </div>

        <div id="room-type-stage" class="selection-stage is-hidden" aria-live="polite">
          <p class="stage-label">Select Room Type</p>
          <div id="room-type-pods" class="pod-list" role="list"></div>
        </div>

        <div class="panel-actions">
          <button id="explore-room" class="cta-btn is-hidden" type="button">Explore Room</button>
          <button id="open-upload" class="ghost-btn" type="button">Upload Video</button>
        </div>
      </aside>
    </div>
  </div>
`

const state = {
  selectedResidenceId: null,
  selectedRoomType: null,
}

const residences = Object.entries(activeRoomConfig)

const residencePods = document.getElementById('residence-pods')
const roomTypeStage = document.getElementById('room-type-stage')
const roomTypePods = document.getElementById('room-type-pods')
const exploreBtn = document.getElementById('explore-room')

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

function renderResidencePods() {
  const selectedId = state.selectedResidenceId
  const items = selectedId
    ? residences.filter(([id]) => id === selectedId)
    : residences

  residencePods.replaceChildren(
    ...items.map(([id]) =>
      createPodButton(toDisplayName(id), id === selectedId, () => {
        if (id === state.selectedResidenceId) {
          return
        }

        state.selectedResidenceId = id
        state.selectedRoomType = null

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
}

function renderRoomTypePods() {
  const residenceId = state.selectedResidenceId
  if (!residenceId) {
    roomTypeStage.classList.add('is-hidden')
    roomTypePods.replaceChildren()
    return
  }

  const roomTypes = activeRoomConfig[residenceId]['room-types'] || []
  const selectedRoom = state.selectedRoomType

  roomTypeStage.classList.remove('is-hidden')

  if (roomTypes.length === 0) {
    const noRooms = document.createElement('p')
    noRooms.className = 'room-type-empty'
    noRooms.textContent = 'No room types listed yet.'
    roomTypePods.replaceChildren(noRooms)
    return
  }

  const visibleRoomTypes = selectedRoom ? roomTypes.filter((room) => room === selectedRoom) : roomTypes

  roomTypePods.replaceChildren(
    ...visibleRoomTypes.map((roomType) =>
      createPodButton(roomType, roomType === selectedRoom, () => {
        state.selectedRoomType = roomType
        renderSelectionState()
      })
    )
  )
}

function renderSelectionState() {
  renderResidencePods()
  renderRoomTypePods()

  const readyToExplore = Boolean(state.selectedResidenceId && state.selectedRoomType)
  exploreBtn.classList.toggle('is-hidden', !readyToExplore)
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

document.getElementById('open-upload').addEventListener('click', () => {
  window.location.href = '/upload.html'
})

exploreBtn.addEventListener('click', () => {
  // Intentionally no-op until explore flow is wired.
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
