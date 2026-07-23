import type {
  AppPreferences,
  CureVoicerOverlayApi,
  OverlayMotion,
  RecordingState
} from '../shared/contracts'
import brandLogoUrl from '../../assets/branding/cure-voicer-liquid-glass-logo.png'

const caption = document.getElementById('overlayCaption')
const api = window.cureVoicerOverlay as CureVoicerOverlayApi | undefined
const rootStyle = document.documentElement.style
const stage = document.querySelector<HTMLElement>('.orb-stage')
const brandLogo = document.querySelector<HTMLImageElement>('.brand-logo')
const logoEnergy = document.querySelector<HTMLElement>('.logo-energy')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let targetLevel = 0
let fastLevel = 0
let slowLevel = 0
let phase = 0
let currentState: RecordingState = 'idle'
let previousFrame = performance.now()
let isDragging = false
let overlayMotion: OverlayMotion = 'balanced'

if (brandLogo) brandLogo.src = brandLogoUrl

const stateLabels: Record<RecordingState, string> = {
  idle: 'Готово',
  starting: 'Подключаюсь…',
  recording: 'Слушаю',
  transcribing: 'Распознаю…',
  error: 'Ошибка'
}

function setState(state: RecordingState): void {
  currentState = state
  document.body.dataset.state = state
  if (caption) caption.textContent = stateLabels[state]
  if (state !== 'recording') targetLevel = state === 'transcribing' ? 0.24 : 0
}

function render(timestamp: number): void {
  const deltaSeconds = Math.min(0.05, Math.max(0.001, (timestamp - previousFrame) / 1000))
  previousFrame = timestamp

  const stateLevel =
    currentState === 'recording'
      ? Math.min(1, Math.pow(targetLevel, 0.82) * 1.12)
      : currentState === 'transcribing'
        ? 0.25
        : 0

  const responseSpeed = stateLevel > fastLevel ? 10 : 5
  fastLevel += (stateLevel - fastLevel) * (1 - Math.exp(-deltaSeconds * responseSpeed))
  slowLevel += (fastLevel - slowLevel) * (1 - Math.exp(-deltaSeconds * 2.1))

  const transient = clamp((fastLevel - slowLevel) * 3.4)
  const baseMotion = reducedMotion
    ? 0
    : currentState === 'recording'
      ? 0.12 + fastLevel * 0.56
      : 0.1
  const motionFactor = overlayMotion === 'calm' ? 0.5 : overlayMotion === 'expressive' ? 1.28 : 1
  const activeMotion = baseMotion * motionFactor
  phase += deltaSeconds * (1.35 + activeMotion * 5.2 + transient * 3.4)

  const breath = Math.sin(timestamp * 0.0017) * 0.5 + 0.5
  const horizontal = Math.sin(phase * 0.73) * (0.35 + activeMotion * 1.35)
  const vertical = Math.cos(phase * 0.91) * (0.25 + activeMotion * 0.8)
  const squash =
    Math.sin(phase * 1.8) * (0.004 + activeMotion * 0.009) + transient * 0.012

  rootStyle.setProperty('--voice-level', fastLevel.toFixed(3))
  rootStyle.setProperty('--voice-transient', transient.toFixed(3))
  rootStyle.setProperty('--orb-x', `${horizontal.toFixed(2)}px`)
  rootStyle.setProperty('--orb-y', `${vertical.toFixed(2)}px`)
  rootStyle.setProperty('--orb-rotate', `${(Math.sin(phase * 0.47) * (1.2 + activeMotion * 3)).toFixed(2)}deg`)
  rootStyle.setProperty('--orb-scale-x', (1 + fastLevel * 0.025 + squash).toFixed(3))
  rootStyle.setProperty('--orb-scale-y', (1 + fastLevel * 0.025 - squash * 0.72).toFixed(3))
  rootStyle.setProperty('--breath', breath.toFixed(3))
  rootStyle.setProperty('--aura-duration', `${(5.4 - fastLevel * 2.6).toFixed(2)}s`)
  rootStyle.setProperty(
    '--aura-secondary-duration',
    `${(3.8 - fastLevel * 1.5).toFixed(2)}s`
  )

  if (brandLogo) {
    const logoX = Math.sin(phase * 0.84) * activeMotion * 0.9
    const logoY = Math.cos(phase * 0.72) * activeMotion * 0.65
    const logoScale = 1 + fastLevel * 0.035 + transient * 0.012 + breath * 0.003
    brandLogo.style.transform = `translate(${logoX.toFixed(2)}px, ${logoY.toFixed(2)}px) scale(${logoScale.toFixed(3)})`
    brandLogo.style.filter = `brightness(${(0.94 + fastLevel * 0.14).toFixed(3)}) saturate(${(1 + fastLevel * 0.16).toFixed(3)})`
  }

  if (logoEnergy) {
    logoEnergy.style.transform = `rotate(${(phase * 7).toFixed(2)}deg) scale(${(0.94 + fastLevel * 0.16 + transient * 0.05).toFixed(3)})`
  }

  requestAnimationFrame(render)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

if (api) {
  api.onOverlayState(setState)
  const applyPreferences = (preferences: AppPreferences): void => {
    overlayMotion = preferences.overlayMotion
    document.body.dataset.motion = overlayMotion
  }
  api.onOverlayPreferencesChanged(applyPreferences)
  api.getOverlayInfo().then((info) => applyPreferences(info.preferences)).catch(console.error)
  api.onOverlayAudioLevel((level) => {
    targetLevel = Math.max(0, Math.min(1, level))
  })
} else {
  // Visual preview outside Electron.
  const previewState = new URLSearchParams(window.location.search).get('state')
  if (previewState === 'idle') {
    setState('idle')
  } else {
    setState('recording')
    window.setInterval(() => {
      targetLevel = 0.18 + Math.random() * 0.68
    }, 140)
  }
}

stage?.addEventListener('pointerdown', (event) => {
  if (!api || event.button !== 0) return
  event.preventDefault()
  isDragging = true
  stage.setPointerCapture(event.pointerId)
  api.beginOverlayDrag()
})

const finishDrag = (event?: PointerEvent): void => {
  if (!isDragging || !api) return
  isDragging = false
  if (event && stage?.hasPointerCapture(event.pointerId)) {
    stage.releasePointerCapture(event.pointerId)
  }
  api.endOverlayDrag()
}

stage?.addEventListener('pointerup', finishDrag)
stage?.addEventListener('pointercancel', finishDrag)
stage?.addEventListener('lostpointercapture', () => finishDrag())
stage?.addEventListener('contextmenu', (event) => {
  if (!api) return
  event.preventDefault()
  finishDrag()
  api.showOverlayMenu()
})
window.addEventListener('blur', () => finishDrag())

requestAnimationFrame(render)
