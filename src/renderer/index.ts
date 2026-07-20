import type {
  CureVoicerApi,
  OverlayPlacement,
  OverlayPlacementMode,
  RecordingState
} from '../shared/contracts'
import { AudioRecorder } from './audio-recorder'
import brandLogoUrl from '../../assets/branding/cure-voicer-liquid-glass-logo.png'

const api = window.cureVoicer as CureVoicerApi | undefined

const recordButton = getElement<HTMLButtonElement>('recordButton')
const statusLabel = getElement('statusLabel')
const statusDetail = getElement('statusDetail')
const resultText = getElement('resultText')
const resultPath = getElement('resultPath')
const engineLabel = getElement('engineLabel')
const hotkeyLabel = getElement('hotkeyLabel')
const versionLabel = getElement('versionLabel')
const pageTitle = getElement('pageTitle')
const pageSubtitle = getElement('pageSubtitle')
const levelBars = Array.from(document.querySelectorAll<HTMLElement>('#levelMeter span'))
const navItems = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-nav]'))
const panes = Array.from(document.querySelectorAll<HTMLElement>('[data-pane]'))
const placementHint = getElement('placementHint')
const placementButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-placement]')
)
const miniBrandLogo = document.querySelector<HTMLImageElement>('.mini-brand-logo')

if (miniBrandLogo) miniBrandLogo.src = brandLogoUrl

let state: RecordingState = 'idle'
let recordingStartedAt = 0
let recordingTimer: number | null = null
let lastAudioLevelSentAt = 0
const recorder = new AudioRecorder(updateLevel)

const stateCopy: Record<RecordingState, [string, string]> = {
  idle: ['Готов к диктовке', 'Нажмите горячую клавишу в любом поле ввода'],
  starting: ['Подключаем микрофон…', 'При первом запуске подтвердите разрешение'],
  recording: ['Слушаю', '00:00 · Нажмите, чтобы закончить'],
  transcribing: ['Распознаю речь…', 'Обработка выполняется на устройстве'],
  error: ['Не удалось записать', 'Проверьте доступ к микрофону и повторите']
}

async function setState(nextState: RecordingState): Promise<void> {
  state = nextState
  document.body.dataset.state = nextState
  const [label, detail] = stateCopy[nextState]
  statusLabel.textContent = label
  statusDetail.textContent = detail
  recordButton.disabled = nextState === 'starting' || nextState === 'transcribing'
  recordButton.textContent = nextState === 'recording' ? 'Остановить' : 'Проверить'
  recordButton.setAttribute(
    'aria-label',
    nextState === 'recording' ? 'Остановить запись' : 'Начать запись'
  )
  if (api) await api.setRecordingState(nextState)
}

async function toggleRecording(): Promise<void> {
  if (state === 'starting' || state === 'transcribing') return

  if (state === 'recording') {
    await finishRecording()
    return
  }

  try {
    await setState('starting')
    await recorder.start()
    recordingStartedAt = performance.now()
    resultText.textContent = 'Идёт запись…'
    resultPath.textContent = ''
    await setState('recording')
    startRecordingTimer()
  } catch (error) {
    showError(error)
  }
}

async function finishRecording(): Promise<void> {
  try {
    stopRecordingTimer()
    await setState('transcribing')
    const samples = await recorder.stop()
    const durationMs = Math.round(performance.now() - recordingStartedAt)

    if (samples.length < 4_800) {
      resultText.textContent =
        'Запись слишком короткая. Произнесите фразу перед повторным нажатием.'
      resultPath.textContent = ''
      await setState('idle')
      return
    }

    const bytes = new Uint8Array(samples.buffer.slice(0))
    if (!api) throw new Error('Electron API is unavailable in preview mode')
    const result = await api.finishRecording({
      samples: bytes,
      sampleRate: 16_000,
      durationMs
    })

    if (result.transcript) {
      resultText.textContent = result.transcript
      statusDetail.textContent =
        result.insertion === 'pasted'
          ? `Вставлено · ${result.latencyMs} мс`
          : `Скопировано в буфер · ${result.latencyMs} мс`
    } else {
      resultText.textContent =
        'Речь не распознана. Попробуйте говорить немного ближе к микрофону.'
    }
    const deliveryLabel =
      result.insertion === 'pasted'
        ? 'Текст вставлен'
        : result.insertion === 'clipboard'
          ? 'Текст оставлен в буфере обмена'
          : 'Без вставки'
    resultPath.textContent = `${deliveryLabel} · ${result.recordingPath}`
    await setState('idle')
  } catch (error) {
    showError(error)
  }
}

function showError(error: unknown): void {
  stopRecordingTimer()
  console.error(error)
  resultText.textContent = formatRecordingError(error)
  void setState('error')
  window.setTimeout(() => {
    if (state === 'error') void setState('idle')
  }, 1_600)
}

function formatRecordingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (
    message.includes('Invalid audio data') ||
    message.includes('avfaudio') ||
    message.includes('2003334207')
  ) {
    return 'Аудио не успело записаться. Подождите немного после начала и повторите.'
  }
  return message || 'Неизвестная ошибка'
}

function startRecordingTimer(): void {
  stopRecordingTimer()
  const renderElapsedTime = (): void => {
    const elapsedSeconds = Math.floor((performance.now() - recordingStartedAt) / 1000)
    const minutes = Math.floor(elapsedSeconds / 60)
    const seconds = elapsedSeconds % 60
    statusDetail.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} · Нажмите, чтобы закончить`
  }

  renderElapsedTime()
  recordingTimer = window.setInterval(renderElapsedTime, 250)
}

function stopRecordingTimer(): void {
  if (recordingTimer !== null) window.clearInterval(recordingTimer)
  recordingTimer = null
}

function updateLevel(level: number): void {
  const activeBars = Math.round(level * levelBars.length)
  levelBars.forEach((bar, index) => {
    const distance = Math.abs(index - Math.floor(levelBars.length / 2))
    const visualIndex = levelBars.length - distance * 2
    bar.style.setProperty('--level', String(index < activeBars ? 1 : 0.18))
    bar.style.setProperty('--height', `${Math.max(8, visualIndex * 1.5)}px`)
  })

  const now = performance.now()
  if (level === 0 || now - lastAudioLevelSentAt >= 32) {
    lastAudioLevelSentAt = now
    api?.setAudioLevel(level)
  }
}

const paneCopy: Record<string, [string, string]> = {
  general: ['Основные', 'Поведение приложения и быстрый запуск'],
  dictation: ['Диктовка', 'Запись, завершение речи и плавающий индикатор'],
  models: ['Модели', 'Локальные движки распознавания речи'],
  vocabulary: ['Словарь', 'Имена и термины для более точной диктовки'],
  history: ['История', 'Недавние локальные диктовки']
}

function selectPane(paneId: string): void {
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.nav === paneId))
  panes.forEach((pane) => {
    const isActive = pane.dataset.pane === paneId
    pane.classList.toggle('is-active', isActive)
    pane.hidden = !isActive
  })

  const [title, subtitle] = paneCopy[paneId] ?? [
    'Основные',
    'Поведение приложения и быстрый запуск'
  ]
  pageTitle.textContent = title
  pageSubtitle.textContent = subtitle
}

function renderOverlayPlacement(placement: OverlayPlacement): void {
  placementButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.placement === placement.mode)
  })

  const labels: Record<OverlayPlacementMode, string> = {
    'bottom-left': 'Слева снизу',
    'bottom-center': 'По центру снизу',
    'bottom-right': 'Справа снизу',
    custom: 'Своя позиция · перетащено вручную'
  }
  placementHint.textContent = labels[placement.mode]
}

function formatAccelerator(accelerator: string, platform: NodeJS.Platform): string {
  return accelerator
    .replace('CommandOrControl', platform === 'darwin' ? '⌘' : 'Ctrl')
    .replace('Shift', platform === 'darwin' ? '⇧' : 'Shift')
    .replaceAll('+', ' ')
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

recordButton.addEventListener('click', () => void toggleRecording())
navItems.forEach((item) => {
  item.addEventListener('click', () => selectPane(item.dataset.nav ?? 'general'))
})
placementButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const mode = button.dataset.placement as Exclude<OverlayPlacementMode, 'custom'>
    placementButtons.forEach((item) => (item.disabled = true))
    try {
      if (api) renderOverlayPlacement(await api.setOverlayPlacement(mode))
      else renderOverlayPlacement({ mode })
    } catch (error) {
      console.error('Could not update overlay placement', error)
    } finally {
      placementButtons.forEach((item) => (item.disabled = false))
    }
  })
})
if (api) {
  api.onToggleRequested(() => void toggleRecording())
  api.onOverlayPlacementChanged(renderOverlayPlacement)
  api.getAppInfo().then((info) => {
    document.body.dataset.platform = info.platform
    versionLabel.textContent = `Cure Voicer ${info.version}`
    hotkeyLabel.textContent = formatAccelerator(info.accelerator, info.platform)
    engineLabel.textContent =
      info.asrEngine === 'not-configured' ? 'ASR не подключён' : info.asrEngine
    renderOverlayPlacement(info.overlayPlacement)
  })
    .catch(showError)
} else {
  document.body.dataset.platform = 'darwin'
  renderOverlayPlacement({ mode: 'bottom-center' })
}

updateLevel(0)
void setState('idle')
