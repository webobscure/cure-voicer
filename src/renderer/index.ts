import type {
  AsrStatus,
  AppPreferences,
  CureVoicerApi,
  HoldKey,
  OverlayMotion,
  OverlayPlacement,
  OverlayPlacementMode,
  RecordingState,
  SmartCorrectionStatus
} from '../shared/contracts'
import { AudioRecorder } from './audio-recorder'
import { SilenceDetector } from '../modules/dictation/silence-detector'
import { mountReactFeatures } from './app/bootstrap'
import brandLogoUrl from '../../assets/branding/cure-voicer-liquid-glass-logo.png'
import { AppearanceController } from './app/appearance'
import { I18nStore } from './app/i18n/i18n-store'
import { onboardingController } from './features/onboarding/onboarding-controller'
import { settingsDataStore } from './app/settings-data-store'
import { modelSettingsStore } from './app/model-settings-store'

const api = window.cureVoicer as CureVoicerApi | undefined
const i18n = new I18nStore('system', navigator.language)
const appearance = new AppearanceController(
  document,
  window.matchMedia('(prefers-color-scheme: dark)'),
  navigator.language
)
appearance.start()
mountReactFeatures(api, i18n, applyAppearance)

const recordButton = getElement<HTMLButtonElement>('recordButton')
const statusLabel = getElement('statusLabel')
const statusDetail = getElement('statusDetail')
const resultText = getElement('resultText')
const resultPath = getElement('resultPath')
const engineLabel = getElement('engineLabel')
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
const activationModeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-activation-mode]')
)
const holdKeyButton = getElement<HTMLButtonElement>('holdKeyButton')
const holdKeyGlyph = getElement('holdKeyGlyph')
const holdKeyButtonLabel = getElement('holdKeyButtonLabel')
const holdKeyHint = getElement('holdKeyHint')
const hotkeySelect = getElement<HTMLSelectElement>('hotkeySelect')
const microphoneSelect = getElement<HTMLSelectElement>('microphoneSelect')
const autoStopSilenceSelect = getElement<HTMLSelectElement>('autoStopSilenceSelect')
const autoPasteToggle = getElement<HTMLInputElement>('autoPasteToggle')
const insertionModeSelect = getElement<HTMLSelectElement>('insertionModeSelect')
const launchAtLoginToggle = getElement<HTMLInputElement>('launchAtLoginToggle')
const showOverlayToggle = getElement<HTMLInputElement>('showOverlayToggle')
const keepRecordingsToggle = getElement<HTMLInputElement>('keepRecordingsToggle')
const motionSelect = getElement<HTMLSelectElement>('motionSelect')
const restartOnboardingButton = getElement<HTMLButtonElement>('restartOnboardingButton')

if (miniBrandLogo) miniBrandLogo.src = brandLogoUrl

let state: RecordingState = 'idle'
let recordingStartedAt = 0
let recordingTimer: number | null = null
let lastAudioLevelSentAt = 0
let stopRequestedWhileStarting = false
let recordingStartInProgress = false
let activeDictationSessionId: string | null = null
let appPlatform: NodeJS.Platform = 'darwin'
let globalInputAvailable = true
let isCapturingHoldKey = false
let holdKeyCaptureTimer: number | null = null
let microphonePermissionGranted = false
let microphonePermissionDenied = false
let preferences: AppPreferences = {
  launchAtLogin: false,
  activationMode: 'hold',
  accelerator: 'CommandOrControl+Shift+Space',
  holdKey: 'right-option',
  microphoneId: '',
  autoPaste: true,
  insertionMode: 'keyboard',
  blockedApplicationIds: [],
  transformationPresetId: 'none',
  shortcutBindings: {
    'selection.transform': 'CommandOrControl+Shift+R',
    'editor.open': 'CommandOrControl+Shift+E',
    'history.open': 'CommandOrControl+Shift+H',
    'dictation.cancel': 'CommandOrControl+Shift+Backspace',
    'insertion.repeat': 'CommandOrControl+Shift+I',
    'dictation.preset': 'CommandOrControl+Shift+P'
  },
  voiceCommands: {},
  integrationRules: [],
  historyEnabled: false,
  clipboardHistoryEnabled: false,
  cloudProcessingEnabled: false,
  automaticUpdatesEnabled: true,
  clipboardRetentionDays: 7,
  theme: 'system',
  locale: 'system',
  keepRecordings: false,
  showOverlayWhenIdle: true,
  overlayMotion: 'balanced',
  smartCorrectionEnabled: false,
  autoStopSilenceMs: 0,
  onboardingCompleted: false
}
let smartCorrectionStatus: SmartCorrectionStatus = {
  state: 'not-downloaded',
  progress: 0,
  modelName: 'Qwen3.5-0.8B Q8_0',
  modelSizeBytes: 834_000_000
}
let asrStatus: AsrStatus = {
  state: 'loading',
  progress: 0,
  engine: 'Подготовка…',
  modelName: 'Parakeet TDT 0.6B V3',
  modelSizeBytes: 0
}
const recorder = new AudioRecorder(updateLevel)
const silenceDetector = new SilenceDetector(() => {
  if (state === 'recording') void finishRecording()
})

async function setState(nextState: RecordingState): Promise<void> {
  state = nextState
  document.body.dataset.state = nextState
  const [label, detail] = getStateCopy(nextState)
  statusLabel.textContent = label
  statusDetail.textContent = detail
  recordButton.disabled = nextState === 'starting' || nextState === 'transcribing'
  recordButton.textContent = nextState === 'recording' ? 'Остановить' : 'Проверить'
  recordButton.setAttribute(
    'aria-label',
    nextState === 'recording' ? 'Остановить запись' : 'Начать запись'
  )
  onboardingController.update({ recordingState: nextState })
  if (api) await api.setRecordingState(nextState)
}

async function toggleRecording(): Promise<void> {
  if (state === 'starting' || state === 'transcribing') return

  if (state === 'recording') {
    await finishRecording()
    return
  }

  await startRecording()
}

async function startRecording(): Promise<void> {
  if (state === 'starting' || state === 'recording' || state === 'transcribing') return

  try {
    stopRequestedWhileStarting = false
    recordingStartInProgress = true
    activeDictationSessionId = crypto.randomUUID()
    await api?.beginDictation(activeDictationSessionId)
    await setState('starting')
    silenceDetector.reset({ silenceMs: preferences.autoStopSilenceMs })
    await recorder.start({
      sessionId: activeDictationSessionId,
      deviceId: preferences.microphoneId,
      maxDurationMs: 15 * 60_000
    })
    recordingStartedAt = performance.now()
    resultText.textContent = 'Идёт запись…'
    resultPath.textContent = ''
    await setState('recording')
    recordingStartInProgress = false
    startRecordingTimer()
    if (stopRequestedWhileStarting) {
      stopRequestedWhileStarting = false
      await finishRecording()
    }
  } catch (error) {
    recordingStartInProgress = false
    showError(error)
  }
}

async function handleRecordingCommand(command: 'toggle' | 'start' | 'stop'): Promise<void> {
  if (command === 'toggle') {
    await toggleRecording()
    return
  }
  if (command === 'start') {
    await startRecording()
    return
  }
  if (recordingStartInProgress || state === 'starting') {
    stopRequestedWhileStarting = true
  } else if (state === 'recording') {
    await finishRecording()
  }
}

async function finishRecording(): Promise<void> {
  const finishingSessionId = activeDictationSessionId
  try {
    stopRecordingTimer()
    await setState('transcribing')
    const samples = await recorder.stop()
    const durationMs = Math.round(performance.now() - recordingStartedAt)

    if (samples.length < 4_800) {
      resultText.textContent =
        'Запись слишком короткая. Подержите клавишу чуть дольше и произнесите фразу.'
      resultPath.textContent = ''
      await setState('idle')
      activeDictationSessionId = null
      return
    }

    const bytes = new Uint8Array(samples.buffer.slice(0))
    if (!api) throw new Error('Electron API is unavailable in preview mode')
    const sessionId = finishingSessionId
    if (!sessionId) throw new Error('Dictation session is unavailable')
    const result = await api.finishRecording({
      sessionId,
      samples: bytes,
      sampleRate: 16_000,
      durationMs
    })
    if (activeDictationSessionId !== sessionId) return

    if (result.transcript) {
      resultText.textContent = result.transcript
      if (onboardingController.getSnapshot().visible) {
        onboardingController.update({ transcript: result.transcript })
      }
      statusDetail.textContent =
        result.insertion === 'pasted'
          ? `Вставлено · ${result.latencyMs} мс`
          : `Скопировано в буфер · ${result.latencyMs} мс`
    } else {
      resultText.textContent =
        'Речь не распознана. Попробуйте говорить немного ближе к микрофону.'
      if (onboardingController.getSnapshot().visible) {
        onboardingController.update({ transcript: i18n.translate('onboarding.testEmpty') })
      }
    }
    const deliveryLabel =
      result.insertion === 'pasted'
        ? 'Текст вставлен'
        : result.insertion === 'clipboard'
          ? 'Текст оставлен в буфере обмена'
          : 'Без вставки'
    resultPath.textContent = `${deliveryLabel} · ${result.recordingPath}`
    if (api) {
      const info = await api.getAppInfo()
      settingsDataStore.update({ history: info.history })
    }
    await setState('idle')
    activeDictationSessionId = null
  } catch (error) {
    if (activeDictationSessionId !== finishingSessionId) return
    showError(error)
  }
}

async function cancelRecording(): Promise<void> {
  stopRequestedWhileStarting = false
  stopRecordingTimer()
  await recorder.cancel()
  await api?.cancelDictation()
  activeDictationSessionId = null
  resultText.textContent = 'Диктовка отменена'
  resultPath.textContent = ''
  await setState('idle')
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
    const finishHint =
      preferences.activationMode === 'hold'
        ? `Отпустите ${formatHoldKey(preferences.holdKey, appPlatform)}`
        : 'Нажмите, чтобы закончить'
    statusDetail.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} · ${finishHint}`
  }

  renderElapsedTime()
  recordingTimer = window.setInterval(renderElapsedTime, 250)
}

function stopRecordingTimer(): void {
  if (recordingTimer !== null) window.clearInterval(recordingTimer)
  recordingTimer = null
}

function updateLevel(level: number): void {
  silenceDetector.observe(level)
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
  history: ['История', 'Недавние локальные диктовки'],
  editor: ['Редактор', 'Сравнение, ручная правка и локальная обработка'],
  commands: ['Голосовые команды', 'Фразы активации, включение и защита команд'],
  hotkeys: ['Горячие клавиши', 'Глобальные действия и проверка конфликтов'],
  integrations: ['Интеграции', 'Правила вставки и обработки для приложений'],
  templates: ['Шаблоны', 'Закреплённые фрагменты и быстрая вставка'],
  clipboard: ['Буфер и данные', 'Локальная история, приватность и перенос настроек'],
  diagnostics: ['Диагностика', 'Разрешения, сервисы и безопасный отчёт']
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

api?.onInternalEditorText(() => selectPane('editor'))
api?.onSettingsNavigate((pane) => selectPane(pane))

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

function renderPreferences(): void {
  applyAppearance(preferences)
  activationModeButtons.forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.activationMode === preferences.activationMode)
    )
  })
  hotkeySelect.value = preferences.accelerator
  holdKeyButton.disabled = preferences.activationMode !== 'hold'
  holdKeyButton.classList.toggle(
    'needs-permission',
    preferences.activationMode === 'hold' && !globalInputAvailable
  )
  holdKeyGlyph.textContent = holdKeyGlyphFor(preferences.holdKey)
  holdKeyButtonLabel.textContent = formatHoldKey(preferences.holdKey, appPlatform)
  if (!isCapturingHoldKey) {
    holdKeyHint.textContent =
      preferences.activationMode === 'hold'
        ? globalInputAvailable
          ? 'Нажмите справа, затем нажмите нужную клавишу'
          : 'Разрешите Cure Voicer в macOS → Универсальный доступ'
        : 'Доступно в режиме удержания'
  }
  hotkeySelect.disabled = preferences.activationMode !== 'toggle'
  microphoneSelect.value = preferences.microphoneId
  autoStopSilenceSelect.value = String(preferences.autoStopSilenceMs)
  autoPasteToggle.checked = preferences.autoPaste
  insertionModeSelect.value = preferences.insertionMode
  insertionModeSelect.disabled = !preferences.autoPaste
  launchAtLoginToggle.checked = preferences.launchAtLogin
  showOverlayToggle.checked = preferences.showOverlayWhenIdle
  keepRecordingsToggle.checked = preferences.keepRecordings
  motionSelect.value = preferences.overlayMotion
  modelSettingsStore.update({ smartCorrectionEnabled: preferences.smartCorrectionEnabled })
  renderAsrStatus()
  renderSmartCorrectionStatus()
  renderStateCopy()
}

function applyAppearance(value: AppPreferences): void {
  appearance.update(value)
  i18n.setPreference(value.locale)
}

function renderAsrStatus(): void {
  modelSettingsStore.update({ asr: asrStatus })
  renderOnboardingModelStatus()
}

function renderOnboardingModelStatus(): void {
  onboardingController.update({ asrStatus })
}

function showOnboarding(firstRun = false): void {
  renderOnboardingPermissions()
  renderOnboardingModelStatus()
  onboardingController.update({
    holdKeyGlyph: holdKeyGlyphFor(preferences.holdKey),
    holdKeyLabel: formatHoldKey(preferences.holdKey, appPlatform),
    transcript: ''
  })
  onboardingController.show(firstRun)
}

function renderOnboardingStep(step: number): void {
  onboardingController.setStep(step)
}

function renderOnboardingPermissions(): void {
  onboardingController.update({
    platform: appPlatform,
    globalInputAvailable,
    microphonePermission: microphonePermissionGranted
      ? 'granted'
      : microphonePermissionDenied
        ? 'denied'
        : 'unknown'
  })
}

async function requestOnboardingMicrophone(): Promise<boolean> {
  if (microphonePermissionGranted) return true
  if (microphonePermissionDenied) {
    await api?.openSystemSettings('microphone')
    return false
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    microphonePermissionGranted = true
    microphonePermissionDenied = false
    await populateMicrophones()
  } catch (error) {
    console.warn('Microphone permission was not granted', error)
    microphonePermissionDenied = true
  }
  renderOnboardingPermissions()
  return microphonePermissionGranted
}

async function requestOnboardingAccessibility(): Promise<void> {
  if (appPlatform !== 'darwin' || globalInputAvailable) return
  try {
    globalInputAvailable = (await api?.requestGlobalInputAccess()) ?? true
    if (!globalInputAvailable) {
      onboardingController.update({
        permissionMessage: i18n.translate('onboarding.permissionOpenMac')
      })
    }
  } catch (error) {
    onboardingController.update({
      permissionMessage: error instanceof Error ? error.message : String(error)
    })
  }
  renderOnboardingPermissions()
  renderPreferences()
}

async function finishOnboarding(): Promise<void> {
  onboardingController.update({ busy: true })
  try {
    if (!microphonePermissionGranted) {
      const granted = await requestOnboardingMicrophone()
      if (!granted) {
        renderOnboardingStep(1)
        onboardingController.update({
          busy: false,
          permissionMessage: i18n.translate('onboarding.permissionRequiredMicrophone')
        })
        return
      }
    }

    if (appPlatform === 'darwin' && preferences.activationMode === 'hold') {
      globalInputAvailable = (await api?.getAppInfo())?.globalInputAvailable ?? true
      if (!globalInputAvailable) {
        renderOnboardingStep(1)
        onboardingController.update({
          busy: false,
          permissionMessage: i18n.translate('onboarding.permissionRequiredAccessibility')
        })
        return
      }
    }

    if (api) preferences = await api.completeOnboarding()
    else preferences = { ...preferences, onboardingCompleted: true }
    renderPreferences()
    const wasFirstRun = onboardingController.getSnapshot().firstRun
    onboardingController.hide()
    if (wasFirstRun) window.close()
  } catch (error) {
    onboardingController.update({
      busy: false,
      permissionMessage: error instanceof Error ? error.message : String(error)
    })
  }
}

function renderSmartCorrectionStatus(): void {
  modelSettingsStore.update({
    smartCorrection: smartCorrectionStatus,
    smartCorrectionEnabled: preferences.smartCorrectionEnabled
  })
}

async function updatePreferences(patch: Partial<AppPreferences>): Promise<boolean> {
  try {
    preferences = api
      ? await api.updatePreferences(patch)
      : { ...preferences, ...patch }
    renderPreferences()
    return true
  } catch (error) {
    renderPreferences()
    statusDetail.textContent = error instanceof Error ? error.message : String(error)
    return false
  }
}

async function populateMicrophones(): Promise<void> {
  if (!navigator.mediaDevices?.enumerateDevices) return
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'audioinput'
    )
    const options = [new Option('Системный', '')]
    devices.forEach((device, index) => {
      options.push(new Option(device.label || `Микрофон ${index + 1}`, device.deviceId))
    })
    microphoneSelect.replaceChildren(...options)
    if (
      preferences.microphoneId &&
      !devices.some((device) => device.deviceId === preferences.microphoneId)
    ) {
      microphoneSelect.append(new Option('Недоступный микрофон', preferences.microphoneId))
    }
    microphoneSelect.value = preferences.microphoneId
  } catch (error) {
    console.warn('Could not enumerate microphones', error)
  }
}

function formatAccelerator(accelerator: string, platform: NodeJS.Platform): string {
  return accelerator
    .replace('CommandOrControl', platform === 'darwin' ? '⌘' : 'Ctrl')
    .replace('Shift', platform === 'darwin' ? '⇧' : 'Shift')
    .replace('Option', platform === 'darwin' ? '⌥' : 'Alt')
    .replaceAll('+', ' ')
}

function getStateCopy(current: RecordingState): [string, string] {
  const holdKeyLabel = formatHoldKey(preferences.holdKey, appPlatform)
  const idleDetail =
    preferences.activationMode === 'hold'
      ? `Удерживайте ${holdKeyLabel} в любом поле ввода`
      : 'Нажмите горячую клавишу в любом поле ввода'
  const recordingDetail =
    preferences.activationMode === 'hold'
      ? `00:00 · Отпустите ${holdKeyLabel}, чтобы закончить`
      : '00:00 · Нажмите, чтобы закончить'
  const copy: Record<RecordingState, [string, string]> = {
    idle: ['Готов к диктовке', idleDetail],
    starting: ['Подключаем микрофон…', 'При первом запуске подтвердите разрешение'],
    recording: ['Слушаю', recordingDetail],
    transcribing: ['Распознаю речь…', 'Обработка выполняется на устройстве'],
    error: ['Не удалось записать', 'Проверьте доступ к микрофону и повторите']
  }
  return copy[current]
}

function renderStateCopy(): void {
  const [label, detail] = getStateCopy(state)
  statusLabel.textContent = label
  if (state !== 'recording' || !recordingTimer) statusDetail.textContent = detail
}

function formatHoldKey(key: HoldKey, platform: NodeJS.Platform): string {
  const labels: Record<HoldKey, string> = {
    'left-control': platform === 'darwin' ? 'Левый Control' : 'Левый Ctrl',
    'right-control': platform === 'darwin' ? 'Правый Control' : 'Правый Ctrl',
    'left-option': platform === 'darwin' ? 'Левый Option' : 'Левый Alt',
    'right-option': platform === 'darwin' ? 'Правый Option' : 'Правый Alt',
    'left-command': platform === 'darwin' ? 'Левый Command' : 'Левый Win',
    'right-command': platform === 'darwin' ? 'Правый Command' : 'Правый Win',
    'left-shift': 'Левый Shift',
    'right-shift': 'Правый Shift',
    f6: 'F6',
    f7: 'F7',
    f8: 'F8',
    f9: 'F9',
    f10: 'F10',
    f11: 'F11',
    f12: 'F12'
  }
  return labels[key]
}

function holdKeyGlyphFor(key: HoldKey): string {
  if (key.includes('control')) return appPlatform === 'darwin' ? '⌃' : 'Ctrl'
  if (key.includes('option')) return appPlatform === 'darwin' ? '⌥' : 'Alt'
  if (key.includes('command')) return appPlatform === 'darwin' ? '⌘' : 'Win'
  if (key.includes('shift')) return '⇧'
  return key.toUpperCase()
}

function holdKeyFromCode(code: string): HoldKey | null {
  const keys: Record<string, HoldKey> = {
    ControlLeft: 'left-control',
    ControlRight: 'right-control',
    AltLeft: 'left-option',
    AltRight: 'right-option',
    MetaLeft: 'left-command',
    MetaRight: 'right-command',
    ShiftLeft: 'left-shift',
    ShiftRight: 'right-shift',
    F6: 'f6',
    F7: 'f7',
    F8: 'f8',
    F9: 'f9',
    F10: 'f10',
    F11: 'f11',
    F12: 'f12'
  }
  return keys[code] ?? null
}

async function beginHoldKeyCapture(): Promise<void> {
  if (preferences.activationMode !== 'hold' || isCapturingHoldKey) return
  try {
    holdKeyButton.disabled = true
    if (!globalInputAvailable) {
      globalInputAvailable = (await api?.requestGlobalInputAccess()) ?? true
      if (!globalInputAvailable) {
        holdKeyButton.disabled = false
        holdKeyHint.textContent =
          'Разрешите Cure Voicer в macOS → Универсальный доступ, затем нажмите ещё раз'
        return
      }
      await api?.setHotkeyCapture(false)
    }
    await api?.setHotkeyCapture(true)
    isCapturingHoldKey = true
    holdKeyButton.disabled = false
    holdKeyButton.classList.add('is-capturing')
    holdKeyButtonLabel.textContent = 'Нажмите клавишу…'
    holdKeyGlyph.textContent = '…'
    holdKeyHint.textContent = 'Control, Option/Alt, Command/Win, Shift или F6–F12 · Esc — отмена'
    if (holdKeyCaptureTimer !== null) window.clearTimeout(holdKeyCaptureTimer)
    holdKeyCaptureTimer = window.setTimeout(() => void cancelHoldKeyCapture(), 10_000)
  } catch (error) {
    holdKeyButton.disabled = false
    holdKeyHint.textContent =
      error instanceof Error ? error.message : 'Не удалось начать выбор клавиши'
  }
}

async function finishHoldKeyCapture(key: HoldKey): Promise<void> {
  if (!isCapturingHoldKey) return
  stopHoldKeyCaptureUi()
  const saved = await updatePreferences({ holdKey: key })
  try {
    globalInputAvailable = (await api?.setHotkeyCapture(false)) ?? true
  } catch (error) {
    holdKeyHint.textContent = error instanceof Error ? error.message : String(error)
    return
  }
  if (saved) {
    holdKeyHint.textContent = globalInputAvailable
      ? `${formatHoldKey(key, appPlatform)} назначен`
      : 'Клавиша назначена. Разрешите Cure Voicer в macOS → Универсальный доступ'
  }
}

async function cancelHoldKeyCapture(): Promise<void> {
  if (!isCapturingHoldKey) return
  stopHoldKeyCaptureUi()
  await api?.setHotkeyCapture(false).catch(() => undefined)
  renderPreferences()
}

function stopHoldKeyCaptureUi(): void {
  isCapturingHoldKey = false
  if (holdKeyCaptureTimer !== null) window.clearTimeout(holdKeyCaptureTimer)
  holdKeyCaptureTimer = null
  holdKeyButton.classList.remove('is-capturing')
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

recordButton.addEventListener('click', () => void toggleRecording())
restartOnboardingButton.addEventListener('click', () => showOnboarding(false))
onboardingController.configure({
  requestMicrophone: async () => {
    await requestOnboardingMicrophone()
  },
  requestAccessibility: requestOnboardingAccessibility,
  toggleRecording,
  finish: finishOnboarding
})
window.addEventListener('focus', () => {
  if (onboardingController.getSnapshot().visible && microphonePermissionDenied) {
    microphonePermissionDenied = false
    renderOnboardingPermissions()
  }
})
activationModeButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (isCapturingHoldKey) await cancelHoldKeyCapture()
    const activationMode = button.dataset.activationMode as AppPreferences['activationMode']
    await updatePreferences({ activationMode })
  })
})
holdKeyButton.addEventListener('click', () => void beginHoldKeyCapture())
window.addEventListener(
  'keydown',
  (event) => {
    if (isCapturingHoldKey) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.code === 'Escape') {
        void cancelHoldKeyCapture()
        return
      }
      const key = holdKeyFromCode(event.code)
      if (key) void finishHoldKeyCapture(key)
      else holdKeyHint.textContent = 'Эта клавиша не подходит. Используйте модификатор или F6–F12.'
      return
    }

    if (
      event.code === 'Escape' &&
      (state === 'starting' || state === 'recording' || state === 'transcribing')
    ) {
      event.preventDefault()
      event.stopImmediatePropagation()
      void cancelRecording().catch(showError)
    }
  },
  true
)
window.addEventListener('blur', () => void cancelHoldKeyCapture())
hotkeySelect.addEventListener('change', () =>
  void updatePreferences({ accelerator: hotkeySelect.value })
)
microphoneSelect.addEventListener('change', () =>
  void updatePreferences({ microphoneId: microphoneSelect.value })
)
autoStopSilenceSelect.addEventListener('change', () =>
  void updatePreferences({ autoStopSilenceMs: Number(autoStopSilenceSelect.value) })
)
autoPasteToggle.addEventListener('change', () =>
  void updatePreferences({ autoPaste: autoPasteToggle.checked })
)
insertionModeSelect.addEventListener('change', () =>
  void updatePreferences({
    insertionMode: insertionModeSelect.value as AppPreferences['insertionMode']
  })
)
launchAtLoginToggle.addEventListener('change', () =>
  void updatePreferences({ launchAtLogin: launchAtLoginToggle.checked })
)
showOverlayToggle.addEventListener('change', () =>
  void updatePreferences({ showOverlayWhenIdle: showOverlayToggle.checked })
)
keepRecordingsToggle.addEventListener('change', () =>
  void updatePreferences({ keepRecordings: keepRecordingsToggle.checked })
)
motionSelect.addEventListener('change', () =>
  void updatePreferences({ overlayMotion: motionSelect.value as OverlayMotion })
)
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
  api.onRecordingCommand((command) => void handleRecordingCommand(command))
  api.onOverlayPlacementChanged(renderOverlayPlacement)
  api.onSmartCorrectionStatusChanged((status) => {
    smartCorrectionStatus = status
    renderSmartCorrectionStatus()
  })
  api.onAsrStatusChanged((status) => {
    asrStatus = status
    renderAsrStatus()
  })
  api.getAppInfo().then((info) => {
    document.body.dataset.platform = info.platform
    appPlatform = info.platform
    globalInputAvailable = info.globalInputAvailable
    versionLabel.textContent = `Cure Voicer ${info.version}`
    Array.from(hotkeySelect.options).forEach((option) => {
      option.textContent = formatAccelerator(option.value, info.platform)
    })
    engineLabel.textContent =
      info.asrEngine === 'not-configured' ? 'ASR не подключён' : info.asrEngine
    preferences = info.preferences
    smartCorrectionStatus = info.smartCorrection
    asrStatus = info.asrStatus
    settingsDataStore.update({ vocabulary: info.vocabulary, history: info.history })
    modelSettingsStore.update({
      platform: info.platform,
      asr: info.asrStatus,
      smartCorrection: info.smartCorrection,
      smartCorrectionEnabled: info.preferences.smartCorrectionEnabled
    })
    renderPreferences()
    renderOverlayPlacement(info.overlayPlacement)
    onboardingController.update({
      platform: appPlatform,
      holdKeyGlyph: holdKeyGlyphFor(preferences.holdKey),
      holdKeyLabel: formatHoldKey(preferences.holdKey, appPlatform)
    })
    renderOnboardingPermissions()
    void populateMicrophones()
    if (!preferences.onboardingCompleted) showOnboarding(true)
    else onboardingController.hide()
  })
    .catch(showError)
} else {
  document.body.dataset.platform = 'darwin'
  renderPreferences()
  settingsDataStore.update({ vocabulary: [], history: [] })
  renderOverlayPlacement({ mode: 'bottom-center' })
}

updateLevel(0)
void setState('idle')
