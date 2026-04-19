import './landing-dev.css'
import maplibregl from 'maplibre-gl'
import roomConfig from './room-config.json'

const VARIANCE_MIN = -10
const VARIANCE_MAX = 10
const VARIANCE_STEP = 0.1
const VARIANCE_SCALE = 0.0001

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="dev-page">
    <div id="map-container"></div>
    <div class="dev-panel-frame">
      <aside class="dev-panel">
        <h1 class="panel-logo"><span class="primary">Room</span> <span class="accent">Reveal</span></h1>
        <p class="subhead">Landing dev tools for coordinate tuning</p>

        <div class="input-group">
          <label for="residence-select">Residence</label>
          <select id="residence-select" class="select-control"></select>
        </div>

        <div class="input-group">
          <label>Latitude Variance (${VARIANCE_MIN} to ${VARIANCE_MAX})</label>
          <div class="slider-wrap slider-row">
            <input id="lat-variance" type="range" min="${VARIANCE_MIN}" max="${VARIANCE_MAX}" step="${VARIANCE_STEP}" value="0" />
            <span id="lat-variance-value" class="number-readout">0.0</span>
            <span class="slider-caption">Applied as variance × ${VARIANCE_SCALE}</span>
          </div>
        </div>

        <div class="input-group">
          <label>Longitude Variance (${VARIANCE_MIN} to ${VARIANCE_MAX})</label>
          <div class="slider-wrap slider-row">
            <input id="lng-variance" type="range" min="${VARIANCE_MIN}" max="${VARIANCE_MAX}" step="${VARIANCE_STEP}" value="0" />
            <span id="lng-variance-value" class="number-readout">0.0</span>
            <span class="slider-caption">Applied as variance × ${VARIANCE_SCALE}</span>
          </div>
        </div>

        <div class="input-group">
          <label>Coordinates</label>
          <div class="slider-wrap coord-grid">
            <span class="coord-label">Base Lat</span><span id="base-lat" class="coord-value"></span>
            <span class="coord-label">Base Lng</span><span id="base-lng" class="coord-value"></span>
            <span class="coord-label">Adjusted Lat</span><span id="adjusted-lat" class="coord-value"></span>
            <span class="coord-label">Adjusted Lng</span><span id="adjusted-lng" class="coord-value"></span>
          </div>
        </div>

        <div class="button-grid">
          <button id="apply-current" class="btn-primary" type="button">Apply to Residence</button>
          <button id="reset-current" class="btn-ghost" type="button">Reset Sliders</button>
          <button id="copy-json" class="btn-accent" type="button">Copy Tuned JSON</button>
          <button id="download-json" class="btn-ghost" type="button">Download JSON</button>
        </div>

        <div id="status" class="status-box">Select a residence and tune coordinates.</div>
      </aside>
    </div>
  </div>
`

const editableConfig = JSON.parse(JSON.stringify(roomConfig))
const residenceIds = Object.keys(editableConfig).sort()

const residenceSelect = document.getElementById('residence-select')
const latVarianceInput = document.getElementById('lat-variance')
const lngVarianceInput = document.getElementById('lng-variance')
const latVarianceValue = document.getElementById('lat-variance-value')
const lngVarianceValue = document.getElementById('lng-variance-value')
const baseLatEl = document.getElementById('base-lat')
const baseLngEl = document.getElementById('base-lng')
const adjustedLatEl = document.getElementById('adjusted-lat')
const adjustedLngEl = document.getElementById('adjusted-lng')
const statusEl = document.getElementById('status')

const map = new maplibregl.Map({
  container: 'map-container',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [-86.9196215, 40.4284539],
  zoom: 17,
  pitch: 55,
  bearing: -25,
})

map.addControl(new maplibregl.NavigationControl())

map.on('load', () => {
  const buildingLayers = map.getStyle().layers.filter(
    (layer) => layer.source === 'carto' && layer['source-layer'] === 'building'
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

  renderCoordinateState()
})

for (const residenceId of residenceIds) {
  const option = document.createElement('option')
  option.value = residenceId
  option.textContent = toDisplayName(residenceId)
  residenceSelect.append(option)
}

function toDisplayName(value) {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getCurrentResidence() {
  return editableConfig[residenceSelect.value]
}

function getVarianceValues() {
  return {
    latVariance: Number(latVarianceInput.value),
    lngVariance: Number(lngVarianceInput.value),
  }
}

function getAdjustedCoords() {
  const residence = getCurrentResidence()
  const { latVariance, lngVariance } = getVarianceValues()

  return {
    baseLat: Number(residence.latitude),
    baseLng: Number(residence.longitude),
    adjustedLat: Number(residence.latitude) + latVariance * VARIANCE_SCALE,
    adjustedLng: Number(residence.longitude) + lngVariance * VARIANCE_SCALE,
    latVariance,
    lngVariance,
  }
}

function flyToAdjusted({ adjustedLat, adjustedLng }) {
  map.flyTo({
    center: [adjustedLng, adjustedLat],
    zoom: 17.4,
    pitch: 55,
    bearing: -25,
    duration: 500,
    essential: true,
  })
}

function renderCoordinateState() {
  const coords = getAdjustedCoords()

  latVarianceValue.textContent = coords.latVariance.toFixed(1)
  lngVarianceValue.textContent = coords.lngVariance.toFixed(1)

  baseLatEl.textContent = coords.baseLat.toFixed(7)
  baseLngEl.textContent = coords.baseLng.toFixed(7)
  adjustedLatEl.textContent = coords.adjustedLat.toFixed(7)
  adjustedLngEl.textContent = coords.adjustedLng.toFixed(7)

  if (map.isStyleLoaded()) {
    flyToAdjusted(coords)
  }
}

function setStatus(message) {
  statusEl.textContent = message
}

function resetSliders() {
  latVarianceInput.value = '0'
  lngVarianceInput.value = '0'
  renderCoordinateState()
}

function applyCurrentResidenceUpdate() {
  const residence = getCurrentResidence()
  const coords = getAdjustedCoords()

  residence.latitude = Number(coords.adjustedLat.toFixed(7))
  residence.longitude = Number(coords.adjustedLng.toFixed(7))

  resetSliders()
  setStatus(`Saved ${toDisplayName(residenceSelect.value)} to lat ${residence.latitude}, lng ${residence.longitude}.`)
}

async function copyConfigJson() {
  const json = JSON.stringify(editableConfig, null, 2)

  try {
    await navigator.clipboard.writeText(json)
    setStatus('Copied tuned JSON to clipboard. Paste into src/room-config.json or pipeline/room-config.example.json as needed.')
  } catch {
    setStatus('Clipboard write failed. Use Download JSON instead.')
  }
}

function downloadConfigJson() {
  const json = JSON.stringify(editableConfig, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = 'room-config.tuned.json'
  document.body.append(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(objectUrl)
  setStatus('Downloaded room-config.tuned.json.')
}

residenceSelect.addEventListener('change', () => {
  resetSliders()
  setStatus(`Tuning ${toDisplayName(residenceSelect.value)}.`)
})

latVarianceInput.addEventListener('input', renderCoordinateState)
lngVarianceInput.addEventListener('input', renderCoordinateState)

document.getElementById('apply-current').addEventListener('click', applyCurrentResidenceUpdate)
document.getElementById('reset-current').addEventListener('click', () => {
  resetSliders()
  setStatus('Variance sliders reset to 0.')
})
document.getElementById('copy-json').addEventListener('click', copyConfigJson)
document.getElementById('download-json').addEventListener('click', downloadConfigJson)

residenceSelect.value = residenceIds[0] || ''
renderCoordinateState()
