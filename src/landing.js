import './landing.css'
import maplibregl from 'maplibre-gl'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="landing-page">
    <div id="map-container"></div>
    <div class="landing-overlay">
      <header class="landing-header">
        <h1 class="landing-title"><span class="primary">Room</span> <span class="accent">Reveal</span></h1>
        <div class="landing-actions">
          <button id="open-select" class="launch-btn" type="button">Browse Splats</button>
          <button id="open-upload" class="launch-btn ghost" type="button">Upload Video</button>
        </div>
      </header>
      <p class="landing-hint">Explore Purdue campus in 3D. Select a building to view its rooms.</p>
    </div>
  </div>
`

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

document.getElementById('open-select').addEventListener('click', () => {
  window.location.href = '/select.html'
})

document.getElementById('open-upload').addEventListener('click', () => {
  window.location.href = '/upload.html'
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
})
