import type {
  AsrStatus,
  AppPreferences,
  CureVoicerApi,
  HoldKey,
  OverlayPlacement,
  RecordingState,
  SmartCorrectionStatus
} from '../shared/contracts'
import { AudioRecorder } from './audio-recorder'
import { SilenceDetector } from '../modules/dictation/silence-detector'
import { mountReactFeatures } from './app/bootstrap'
import { AppearanceController } from './app/appearance'
import { I18nStore } from './app/i18n/i18n-store'
import { onboardingController } from './features/onboarding/onboarding-controller'
import { settingsDataStore } from './app/settings-data-store'
import { modelSettingsStore } from './app/model-settings-store'
import { coreSettingsController } from './app/core-settings-controller'

const api = window.cureVoicer as CureVoicerApi | undefined
const i18n = new I18nStore('system', navigator.language)
const appearance = new AppearanceController(
  document,
  window.matchMedia('(prefers-color-scheme: dark)'),
  navigator.language
)
appearance.start()
mountReactFeatures(api, i18n, applyAppearance)

const resultText = getElement('resultText')
const resultPath = getElement('resultPath')
const versionLabel = getElement('versionLabel')
const pageTitle = getElement('pageTitle')
const pageSubtitle = getElement('pageSubtitle')
const navItems = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-nav]'))
const panes = Array.from(document.querySelectorAll<HTMLElement>('[data-pane]'))

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
  coreSettingsController.update({ recordingState: nextState, recordingDetail: '' })
  document.body.dataset.state = nextState
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
      coreSettingsController.update({
        recordingDetail: i18n.translate(
          result.insertion === 'pasted' ? 'general.insertedResult' : 'general.copiedResult',
          { latency: result.latencyMs }
        )
      })
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
        ? i18n.translate('general.releaseToFinish', {
            key: formatHoldKey(preferences.holdKey, appPlatform)
          })
        : i18n.translate('general.pressToFinish')
    coreSettingsController.update({
      recordingDetail: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} · ${finishHint}`
    })
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
  coreSettingsController.update({ audioLevel: level })

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
  coreSettingsController.update({ overlayPlacement: placement })
}

function renderPreferences(): void {
  applyAppearance(preferences)
  coreSettingsController.update({
    preferences,
    platform: appPlatform,
    globalInputAvailable,
    holdKeyCaptureActive: isCapturingHoldKey,
    asrStatus,
    error: ''
  })
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
    coreSettingsController.update({ error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

async function populateMicrophones(): Promise<void> {
  if (!navigator.mediaDevices?.enumerateDevices) return
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'audioinput'
    )
    coreSettingsController.update({
      microphones: [
        { id: '', label: 'System', available: true },
        ...devices.map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
          available: true
        })),
        ...(preferences.microphoneId && !devices.some((device) => device.deviceId === preferences.microphoneId)
          ? [{ id: preferences.microphoneId, label: 'Unavailable microphone', available: false }]
          : [])
      ]
    })
  } catch (error) {
    console.warn('Could not enumerate microphones', error)
  }
}

function renderStateCopy(): void {
  coreSettingsController.update({ recordingState: state })
}

function formatHoldKey(key: HoldKey, platform: NodeJS.Platform): string {
  const russian = i18n.getSnapshot() === 'ru'
  const labels: Record<HoldKey, string> = {
    'left-control': `${russian ? 'Левый' : 'Left'} ${platform === 'darwin' ? 'Control' : 'Ctrl'}`,
    'right-control': `${russian ? 'Правый' : 'Right'} ${platform === 'darwin' ? 'Control' : 'Ctrl'}`,
    'left-option': `${russian ? 'Левый' : 'Left'} ${platform === 'darwin' ? 'Option' : 'Alt'}`,
    'right-option': `${russian ? 'Правый' : 'Right'} ${platform === 'darwin' ? 'Option' : 'Alt'}`,
    'left-command': `${russian ? 'Левый' : 'Left'} ${platform === 'darwin' ? 'Command' : 'Win'}`,
    'right-command': `${russian ? 'Правый' : 'Right'} ${platform === 'darwin' ? 'Command' : 'Win'}`,
    'left-shift': `${russian ? 'Левый' : 'Left'} Shift`,
    'right-shift': `${russian ? 'Правый' : 'Right'} Shift`,
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
    if (!globalInputAvailable) {
      globalInputAvailable = (await api?.requestGlobalInputAccess()) ?? true
      if (!globalInputAvailable) {
        coreSettingsController.update({
          globalInputAvailable,
          holdKeyStatus: i18n.translate('general.accessibilityRetry')
        })
        return
      }
      await api?.setHotkeyCapture(false)
    }
    await api?.setHotkeyCapture(true)
    isCapturingHoldKey = true
    coreSettingsController.update({
      holdKeyCaptureActive: true,
      holdKeyStatus: i18n.translate('general.captureInstruction')
    })
    if (holdKeyCaptureTimer !== null) window.clearTimeout(holdKeyCaptureTimer)
    holdKeyCaptureTimer = window.setTimeout(() => void cancelHoldKeyCapture(), 10_000)
  } catch (error) {
    coreSettingsController.update({
      holdKeyCaptureActive: false,
      holdKeyStatus: error instanceof Error ? error.message : i18n.translate('general.captureFailed')
    })
  }
}

async function finishHoldKeyCapture(key: HoldKey): Promise<void> {
  if (!isCapturingHoldKey) return
  stopHoldKeyCaptureUi()
  const saved = await updatePreferences({ holdKey: key })
  try {
    globalInputAvailable = (await api?.setHotkeyCapture(false)) ?? true
  } catch (error) {
    coreSettingsController.update({
      holdKeyStatus: error instanceof Error ? error.message : String(error)
    })
    return
  }
  if (saved) {
    const holdKeyStatus = globalInputAvailable
      ? i18n.translate('general.keyAssigned', { key: formatHoldKey(key, appPlatform) })
      : i18n.translate('general.keyAssignedNeedsAccess')
    coreSettingsController.update({
      globalInputAvailable,
      holdKeyCaptureActive: false,
      holdKeyStatus
    })
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
  coreSettingsController.update({ holdKeyCaptureActive: false })
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

coreSettingsController.configure({
  toggleRecording,
  updatePreferences: async (patch) => {
    if (isCapturingHoldKey && patch.activationMode && patch.activationMode !== 'hold') {
      await cancelHoldKeyCapture()
    }
    return updatePreferences(patch)
  },
  beginHoldKeyCapture,
  cancelHoldKeyCapture,
  setOverlayPlacement: async (mode) => {
    coreSettingsController.update({ overlayPlacementBusy: true })
    try {
      renderOverlayPlacement(api ? await api.setOverlayPlacement(mode) : { mode })
    } catch (error) {
      coreSettingsController.update({
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      coreSettingsController.update({ overlayPlacementBusy: false })
    }
  },
  restartOnboarding: () => showOnboarding(false)
})
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
      else coreSettingsController.update({
        holdKeyStatus: i18n.translate('general.invalidKey')
      })
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
navItems.forEach((item) => {
  item.addEventListener('click', () => selectPane(item.dataset.nav ?? 'general'))
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
    coreSettingsController.update({
      platform: info.platform,
      globalInputAvailable: info.globalInputAvailable
    })
    versionLabel.textContent = `Cure Voicer ${info.version}`
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
