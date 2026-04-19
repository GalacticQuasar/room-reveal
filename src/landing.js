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

    <div id="about-modal" class="upload-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
      <div id="about-modal-backdrop" class="upload-modal-backdrop" aria-hidden="true"></div>
      <section class="upload-modal-card about-modal-card">
        <button id="close-about-modal" class="upload-modal-close" type="button" aria-label="Close about modal"></button>
        <div class="about-modal-body">
          <div class="about-modal-logo-frame">
            <img id="about-modal-logo" src="/room-reveal-logo.png" alt="Room Reveal Logo">
          </div>
          <div class="about-modal-links">
            <a href="https://github.com/GalacticQuasar/room-reveal" target="_blank" rel="noopener noreferrer" class="about-modal-link about-modal-link-github">
              <svg class="about-modal-link-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"></path></svg>
              GitHub
            </a>
            <a href="https://devpost.com/software/room-reveal" target="_blank" rel="noopener noreferrer" class="about-modal-link about-modal-link-devpost">
              <svg class="about-modal-link-icon" fill="#ffffff" viewBox="0 0 24 24"><path d="M6.002 1.61 0 12.004 6.002 22.39h11.996L24 12.004 17.998 1.61zm1.593 4.084h3.947c3.605 0 6.276 1.695 6.276 6.31 0 4.436-3.21 6.302-6.456 6.302H7.595zm2.517 2.449v7.714h1.241c2.646 0 3.862-1.55 3.862-3.861.009-2.569-1.096-3.853-3.767-3.853z"></path></svg>
              DevPost
            </a>
          </div>
          <p class="about-modal-description">Room Reveal is a platform where students can explore 3D Gaussian Splat models of various living spaces around campus. Models are created when users upload a video of their rooms (after specifying their location and room type) that is transformed into a Gaussian Splat 3D model by our processing pipeline. From there, any user can explore the space interactively on our website to get a sense of potential future living spaces.</p>
          <div class="about-modal-developers">
            <h3>Made By</h3>
            <div class="about-modal-developer-grid">
              <div class="about-modal-developer">
                <p class="about-modal-developer-name">Akash Ravandhu</p>
                <div class="about-modal-developer-links">
                  <a href="https://www.akashravandhu.com/" aria-label="Developer One Website"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>
                  <a href="https://github.com/GalacticQuasar" aria-label="Developer One GitHub"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size}><!--!Font Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M237.9 461.4C237.9 463.4 235.6 465 232.7 465C229.4 465.3 227.1 463.7 227.1 461.4C227.1 459.4 229.4 457.8 232.3 457.8C235.3 457.5 237.9 459.1 237.9 461.4zM206.8 456.9C206.1 458.9 208.1 461.2 211.1 461.8C213.7 462.8 216.7 461.8 217.3 459.8C217.9 457.8 216 455.5 213 454.6C210.4 453.9 207.5 454.9 206.8 456.9zM251 455.2C248.1 455.9 246.1 457.8 246.4 460.1C246.7 462.1 249.3 463.4 252.3 462.7C255.2 462 257.2 460.1 256.9 458.1C256.6 456.2 253.9 454.9 251 455.2zM316.8 72C178.1 72 72 177.3 72 316C72 426.9 141.8 521.8 241.5 555.2C254.3 557.5 258.8 549.6 258.8 543.1C258.8 536.9 258.5 502.7 258.5 481.7C258.5 481.7 188.5 496.7 173.8 451.9C173.8 451.9 162.4 422.8 146 415.3C146 415.3 123.1 399.6 147.6 399.9C147.6 399.9 172.5 401.9 186.2 425.7C208.1 464.3 244.8 453.2 259.1 446.6C261.4 430.6 267.9 419.5 275.1 412.9C219.2 406.7 162.8 398.6 162.8 302.4C162.8 274.9 170.4 261.1 186.4 243.5C183.8 237 175.3 210.2 189 175.6C209.9 169.1 258 202.6 258 202.6C278 197 299.5 194.1 320.8 194.1C342.1 194.1 363.6 197 383.6 202.6C383.6 202.6 431.7 169 452.6 175.6C466.3 210.3 457.8 237 455.2 243.5C471.2 261.2 481 275 481 302.4C481 398.9 422.1 406.6 366.2 412.9C375.4 420.8 383.2 435.8 383.2 459.3C383.2 493 382.9 534.7 382.9 542.9C382.9 549.4 387.5 557.3 400.2 555C500.2 521.8 568 426.9 568 316C568 177.3 455.5 72 316.8 72zM169.2 416.9C167.9 417.9 168.2 420.2 169.9 422.1C171.5 423.7 173.8 424.4 175.1 423.1C176.4 422.1 176.1 419.8 174.4 417.9C172.8 416.3 170.5 415.6 169.2 416.9zM158.4 408.8C157.7 410.1 158.7 411.7 160.7 412.7C162.3 413.7 164.3 413.4 165 412C165.7 410.7 164.7 409.1 162.7 408.1C160.7 407.5 159.1 407.8 158.4 408.8zM190.8 444.4C189.2 445.7 189.8 448.7 192.1 450.6C194.4 452.9 197.3 453.2 198.6 451.6C199.9 450.3 199.3 447.3 197.3 445.4C195.1 443.1 192.1 442.8 190.8 444.4zM179.4 429.7C177.8 430.7 177.8 433.3 179.4 435.6C181 437.9 183.7 438.9 185 437.9C186.6 436.6 186.6 434 185 431.7C183.6 429.4 181 428.4 179.4 429.7z" fill="currentColor"/></svg></a>
                </div>
              </div>
              <div class="about-modal-developer">
                <p class="about-modal-developer-name">Devashish Das</p>
                <div class="about-modal-developer-links">
                  <a href="https://devashishdas.vercel.app/" aria-label="Developer Two Website"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>
                  <a href="https://github.com/DevashishDas3" aria-label="Developer Two GitHub"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size}><!--!Font Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M237.9 461.4C237.9 463.4 235.6 465 232.7 465C229.4 465.3 227.1 463.7 227.1 461.4C227.1 459.4 229.4 457.8 232.3 457.8C235.3 457.5 237.9 459.1 237.9 461.4zM206.8 456.9C206.1 458.9 208.1 461.2 211.1 461.8C213.7 462.8 216.7 461.8 217.3 459.8C217.9 457.8 216 455.5 213 454.6C210.4 453.9 207.5 454.9 206.8 456.9zM251 455.2C248.1 455.9 246.1 457.8 246.4 460.1C246.7 462.1 249.3 463.4 252.3 462.7C255.2 462 257.2 460.1 256.9 458.1C256.6 456.2 253.9 454.9 251 455.2zM316.8 72C178.1 72 72 177.3 72 316C72 426.9 141.8 521.8 241.5 555.2C254.3 557.5 258.8 549.6 258.8 543.1C258.8 536.9 258.5 502.7 258.5 481.7C258.5 481.7 188.5 496.7 173.8 451.9C173.8 451.9 162.4 422.8 146 415.3C146 415.3 123.1 399.6 147.6 399.9C147.6 399.9 172.5 401.9 186.2 425.7C208.1 464.3 244.8 453.2 259.1 446.6C261.4 430.6 267.9 419.5 275.1 412.9C219.2 406.7 162.8 398.6 162.8 302.4C162.8 274.9 170.4 261.1 186.4 243.5C183.8 237 175.3 210.2 189 175.6C209.9 169.1 258 202.6 258 202.6C278 197 299.5 194.1 320.8 194.1C342.1 194.1 363.6 197 383.6 202.6C383.6 202.6 431.7 169 452.6 175.6C466.3 210.3 457.8 237 455.2 243.5C471.2 261.2 481 275 481 302.4C481 398.9 422.1 406.6 366.2 412.9C375.4 420.8 383.2 435.8 383.2 459.3C383.2 493 382.9 534.7 382.9 542.9C382.9 549.4 387.5 557.3 400.2 555C500.2 521.8 568 426.9 568 316C568 177.3 455.5 72 316.8 72zM169.2 416.9C167.9 417.9 168.2 420.2 169.9 422.1C171.5 423.7 173.8 424.4 175.1 423.1C176.4 422.1 176.1 419.8 174.4 417.9C172.8 416.3 170.5 415.6 169.2 416.9zM158.4 408.8C157.7 410.1 158.7 411.7 160.7 412.7C162.3 413.7 164.3 413.4 165 412C165.7 410.7 164.7 409.1 162.7 408.1C160.7 407.5 159.1 407.8 158.4 408.8zM190.8 444.4C189.2 445.7 189.8 448.7 192.1 450.6C194.4 452.9 197.3 453.2 198.6 451.6C199.9 450.3 199.3 447.3 197.3 445.4C195.1 443.1 192.1 442.8 190.8 444.4zM179.4 429.7C177.8 430.7 177.8 433.3 179.4 435.6C181 437.9 183.7 438.9 185 437.9C186.6 436.6 186.6 434 185 431.7C183.6 429.4 181 428.4 179.4 429.7z" fill="currentColor"/></svg></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
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
const headerIcon = document.getElementById('header-icon')
const aboutModal = document.getElementById('about-modal')
const aboutModalBackdrop = document.getElementById('about-modal-backdrop')
const closeAboutModalBtn = document.getElementById('close-about-modal')

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
    !uploadModal.classList.contains('is-hidden') || !noScansModal.classList.contains('is-hidden') || !aboutModal.classList.contains('is-hidden')
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

function openAboutModal() {
  aboutModal.classList.remove('is-hidden')
  syncLandingModalState()
}

function closeAboutModal() {
  aboutModal.classList.add('is-hidden')
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

headerIcon.style.pointerEvents = 'auto'
headerIcon.style.cursor = 'pointer'
headerIcon.addEventListener('click', () => {
  openAboutModal()
})

closeAboutModalBtn.addEventListener('click', () => {
  closeAboutModal()
})

aboutModalBackdrop.addEventListener('click', () => {
  closeAboutModal()
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
    return
  }

  if (!aboutModal.classList.contains('is-hidden')) {
    closeAboutModal()
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
