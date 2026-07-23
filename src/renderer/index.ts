import type {
  AsrStatus,
  AppPreferences,
  CureVoicerApi,
  DictationHistoryItem,
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

const api = window.cureVoicer as CureVoicerApi | undefined
mountReactFeatures(api)

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
const launchAtLoginToggle = getElement<HTMLInputElement>('launchAtLoginToggle')
const showOverlayToggle = getElement<HTMLInputElement>('showOverlayToggle')
const keepRecordingsToggle = getElement<HTMLInputElement>('keepRecordingsToggle')
const motionSelect = getElement<HTMLSelectElement>('motionSelect')
const modelEngineValue = getElement('modelEngineValue')
const modelRuntimeValue = getElement('modelRuntimeValue')
const modelStatusBadge = getElement('modelStatusBadge')
const asrModelDetail = getElement('asrModelDetail')
const asrModelProgress = getElement<HTMLProgressElement>('asrModelProgress')
const asrRetryButton = getElement<HTMLButtonElement>('asrRetryButton')
const smartCorrectionToggle = getElement<HTMLInputElement>('smartCorrectionToggle')
const smartCorrectionDetail = getElement('smartCorrectionDetail')
const smartCorrectionStatusValue = getElement('smartCorrectionStatusValue')
const smartCorrectionProgress = getElement<HTMLProgressElement>('smartCorrectionProgress')
const vocabularyForm = getElement<HTMLFormElement>('vocabularyForm')
const vocabularyInput = getElement<HTMLInputElement>('vocabularyInput')
const vocabularyList = getElement('vocabularyList')
const vocabularyCount = getElement('vocabularyCount')
const vocabularyMessage = getElement('vocabularyMessage')
const historyList = getElement('historyList')
const historyEmpty = getElement('historyEmpty')
const historyCount = getElement('historyCount')
const clearHistoryButton = getElement<HTMLButtonElement>('clearHistoryButton')
const latestResultCard = getElement('latestResultCard')
const restartOnboardingButton = getElement<HTMLButtonElement>('restartOnboardingButton')
const onboarding = getElement('onboarding')
const onboardingLogo = getElement<HTMLImageElement>('onboardingLogo')
const onboardingHeroLogo = getElement<HTMLImageElement>('onboardingHeroLogo')
const onboardingSteps = Array.from(
  document.querySelectorAll<HTMLElement>('[data-onboarding-step]')
)
const onboardingProgress = Array.from(
  document.querySelectorAll<HTMLElement>('.onboarding-progress i')
)
const onboardingBackButton = getElement<HTMLButtonElement>('onboardingBackButton')
const onboardingNextButton = getElement<HTMLButtonElement>('onboardingNextButton')
const onboardingMicrophoneButton = getElement<HTMLButtonElement>(
  'onboardingMicrophoneButton'
)
const onboardingAccessibilityButton = getElement<HTMLButtonElement>(
  'onboardingAccessibilityButton'
)
const accessibilityTitle = getElement('accessibilityTitle')
const accessibilityDetail = getElement('accessibilityDetail')
const permissionNote = getElement('permissionNote')
const onboardingHoldKeyGlyph = getElement('onboardingHoldKeyGlyph')
const onboardingHoldKeyLabel = getElement('onboardingHoldKeyLabel')
const onboardingModelDetail = getElement('onboardingModelDetail')
const onboardingModelProgress = getElement<HTMLProgressElement>(
  'onboardingModelProgress'
)
const onboardingModelBadge = getElement('onboardingModelBadge')
const onboardingTestInput = getElement<HTMLTextAreaElement>('onboardingTestInput')
const onboardingTestStatus = getElement('onboardingTestStatus')
const onboardingTestButton = getElement<HTMLButtonElement>('onboardingTestButton')

if (miniBrandLogo) miniBrandLogo.src = brandLogoUrl
onboardingLogo.src = brandLogoUrl
onboardingHeroLogo.src = brandLogoUrl

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
let onboardingStep = 0
let onboardingIsFirstRun = true
let microphonePermissionGranted = false
let microphonePermissionDenied = false
let preferences: AppPreferences = {
  launchAtLogin: false,
  activationMode: 'hold',
  accelerator: 'CommandOrControl+Shift+Space',
  holdKey: 'right-option',
  microphoneId: '',
  autoPaste: true,
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
let vocabulary: string[] = []
let history: DictationHistoryItem[] = []
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
  onboardingTestButton.disabled =
    nextState === 'starting' ||
    nextState === 'transcribing' ||
    (nextState !== 'recording' && asrStatus.state !== 'ready')
  onboardingTestButton.textContent =
    nextState === 'recording' ? 'Остановить' : 'Начать запись'
  onboardingTestStatus.textContent =
    nextState === 'recording'
      ? 'Слушаю…'
      : nextState === 'transcribing'
        ? 'Распознаю локально…'
        : asrStatus.state === 'ready'
          ? 'Готово к проверке'
          : 'Модель готовится'
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
      if (!onboarding.hidden) onboardingTestInput.value = result.transcript
      statusDetail.textContent =
        result.insertion === 'pasted'
          ? `Вставлено · ${result.latencyMs} мс`
          : `Скопировано в буфер · ${result.latencyMs} мс`
    } else {
      resultText.textContent =
        'Речь не распознана. Попробуйте говорить немного ближе к микрофону.'
      if (!onboarding.hidden) {
        onboardingTestInput.value = 'Речь не распознана. Попробуйте ещё раз.'
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
      history = info.history
      renderHistory()
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
  launchAtLoginToggle.checked = preferences.launchAtLogin
  showOverlayToggle.checked = preferences.showOverlayWhenIdle
  keepRecordingsToggle.checked = preferences.keepRecordings
  motionSelect.value = preferences.overlayMotion
  smartCorrectionToggle.checked = preferences.smartCorrectionEnabled
  renderAsrStatus()
  renderSmartCorrectionStatus()
  renderStateCopy()
}

function renderAsrStatus(): void {
  const percent = Math.round(asrStatus.progress * 100)
  const busy = asrStatus.state === 'downloading' || asrStatus.state === 'loading'
  asrModelProgress.hidden = !busy
  asrModelProgress.value = asrStatus.progress
  asrRetryButton.hidden = asrStatus.state !== 'error'
  asrRetryButton.disabled = busy
  modelEngineValue.textContent = asrStatus.engine

  switch (asrStatus.state) {
    case 'downloading':
      modelStatusBadge.textContent = `${percent}%`
      asrModelDetail.textContent = `Загрузка Windows-модели · ${percent}% из 670 МБ`
      break
    case 'loading':
      modelStatusBadge.textContent = 'Подготовка'
      asrModelDetail.textContent = 'Загрузка модели в память…'
      break
    case 'ready':
      modelStatusBadge.textContent = 'Активна'
      asrModelDetail.textContent = 'Локально · 25 языков · готова к диктовке'
      break
    case 'downloaded':
      modelStatusBadge.textContent = 'Загружена'
      asrModelDetail.textContent = 'Модель проверена и готова к запуску'
      break
    case 'error':
      modelStatusBadge.textContent = 'Ошибка'
      asrModelDetail.textContent = asrStatus.error ?? 'Не удалось подготовить модель'
      break
    default:
      modelStatusBadge.textContent = 'Не загружена'
      asrModelDetail.textContent = 'При первом запуске загрузится локальная модель · 670 МБ'
  }
  renderOnboardingModelStatus()
}

function renderOnboardingModelStatus(): void {
  const percent = Math.round(asrStatus.progress * 100)
  onboardingModelProgress.value = asrStatus.progress
  onboardingModelProgress.hidden = asrStatus.state === 'ready'
  onboardingTestButton.disabled =
    state !== 'recording' && asrStatus.state !== 'ready'

  switch (asrStatus.state) {
    case 'downloading':
      onboardingModelDetail.textContent = `Загружаем на компьютер · ${percent}%`
      onboardingModelBadge.textContent = `${percent}%`
      break
    case 'loading':
      onboardingModelDetail.textContent = 'Запускаем модель на этом компьютере…'
      onboardingModelBadge.textContent = 'Подготовка'
      break
    case 'ready':
      onboardingModelDetail.textContent = 'Работает локально и готова к диктовке'
      onboardingModelBadge.textContent = 'Готова'
      break
    case 'error':
      onboardingModelDetail.textContent = asrStatus.error ?? 'Не удалось подготовить модель'
      onboardingModelBadge.textContent = 'Ошибка'
      break
    default:
      onboardingModelDetail.textContent = 'Ожидает подготовки'
      onboardingModelBadge.textContent = 'Ожидание'
  }
}

function showOnboarding(firstRun = false): void {
  onboardingIsFirstRun = firstRun
  onboarding.hidden = false
  renderOnboardingStep(0)
  renderOnboardingPermissions()
  renderOnboardingModelStatus()
}

function renderOnboardingStep(step: number): void {
  onboardingStep = Math.max(0, Math.min(onboardingSteps.length - 1, step))
  onboardingSteps.forEach((element, index) => {
    const active = index === onboardingStep
    element.hidden = !active
    element.classList.toggle('is-active', active)
  })
  onboardingProgress.forEach((dot, index) => {
    dot.classList.toggle('is-active', index === onboardingStep)
  })
  onboardingBackButton.hidden = onboardingStep === 0
  onboardingNextButton.textContent =
    onboardingStep === onboardingSteps.length - 1 ? 'Начать работу' : 'Продолжить'
  if (onboardingStep === 1) renderOnboardingPermissions()
  if (onboardingStep === 2) renderOnboardingModelStatus()
}

function renderOnboardingPermissions(): void {
  onboardingMicrophoneButton.classList.toggle('is-granted', microphonePermissionGranted)
  onboardingMicrophoneButton.classList.toggle('is-denied', microphonePermissionDenied)
  onboardingMicrophoneButton.textContent = microphonePermissionGranted
    ? 'Разрешено'
    : microphonePermissionDenied
      ? 'Настройки'
      : 'Разрешить'

  if (appPlatform === 'darwin') {
    accessibilityTitle.textContent = 'Универсальный доступ'
    accessibilityDetail.textContent = 'Распознаёт удержание клавиши в любом приложении'
    onboardingAccessibilityButton.classList.toggle('is-granted', globalInputAvailable)
    onboardingAccessibilityButton.textContent = globalInputAvailable
      ? 'Разрешено'
      : 'Разрешить'
    permissionNote.textContent =
      'Cure Voicer видит только нажатие выбранной клавиши и не читает содержимое приложений.'
  } else {
    accessibilityTitle.textContent = 'Горячая клавиша Windows'
    accessibilityDetail.textContent = 'Работает глобально без отдельного системного разрешения'
    onboardingAccessibilityButton.classList.add('is-granted')
    onboardingAccessibilityButton.textContent = 'Готово'
    permissionNote.textContent =
      'В Windows понадобится только разрешение на микрофон. Аудио остаётся на компьютере.'
  }
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
      permissionNote.textContent =
        'Включите Cure Voicer в Системных настройках, вернитесь сюда и нажмите ещё раз.'
    }
  } catch (error) {
    permissionNote.textContent = error instanceof Error ? error.message : String(error)
  }
  renderOnboardingPermissions()
  renderPreferences()
}

async function finishOnboarding(): Promise<void> {
  onboardingNextButton.disabled = true
  try {
    if (!microphonePermissionGranted) {
      const granted = await requestOnboardingMicrophone()
      if (!granted) {
        renderOnboardingStep(1)
        permissionNote.textContent =
          'Разрешите доступ к микрофону — без него диктовка не сможет начать запись.'
        onboardingNextButton.disabled = false
        return
      }
    }

    if (appPlatform === 'darwin' && preferences.activationMode === 'hold') {
      globalInputAvailable = (await api?.getAppInfo())?.globalInputAvailable ?? true
      if (!globalInputAvailable) {
        renderOnboardingStep(1)
        permissionNote.textContent =
          'Для запуска удержанием включите Cure Voicer в разделе «Универсальный доступ».'
        onboardingNextButton.disabled = false
        return
      }
    }

    if (api) preferences = await api.completeOnboarding()
    else preferences = { ...preferences, onboardingCompleted: true }
    renderPreferences()
    onboarding.hidden = true
    if (onboardingIsFirstRun) window.close()
  } catch (error) {
    onboardingNextButton.disabled = false
    permissionNote.textContent = error instanceof Error ? error.message : String(error)
  }
}

function renderSmartCorrectionStatus(): void {
  const percent = Math.round(smartCorrectionStatus.progress * 100)
  const busy =
    smartCorrectionStatus.state === 'downloading' ||
    smartCorrectionStatus.state === 'loading'
  smartCorrectionToggle.disabled = busy
  smartCorrectionProgress.hidden = !busy
  smartCorrectionProgress.value = smartCorrectionStatus.progress

  switch (smartCorrectionStatus.state) {
    case 'downloading':
      smartCorrectionDetail.textContent = `Загрузка локальной модели · ${percent}%`
      smartCorrectionStatusValue.textContent = `${percent}%`
      break
    case 'loading':
      smartCorrectionDetail.textContent = 'Запускаем модель на этом компьютере…'
      smartCorrectionStatusValue.textContent = 'Подготовка'
      break
    case 'ready':
      smartCorrectionDetail.textContent = preferences.smartCorrectionEnabled
        ? 'Исправляет технические термины и смешанную речь локально'
        : 'Модель загружена и готова к включению'
      smartCorrectionStatusValue.textContent = preferences.smartCorrectionEnabled
        ? 'Активна'
        : 'Готова'
      break
    case 'downloaded':
      smartCorrectionDetail.textContent = 'Модель загружена и готова к запуску'
      smartCorrectionStatusValue.textContent = 'Загружена'
      break
    case 'error':
      smartCorrectionDetail.textContent =
        smartCorrectionStatus.error ?? 'Не удалось запустить локальную модель'
      smartCorrectionStatusValue.textContent = 'Ошибка'
      break
    default:
      smartCorrectionDetail.textContent = 'При включении загрузится локальная модель · около 834 МБ'
      smartCorrectionStatusValue.textContent = 'Не загружена'
  }
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

function renderVocabulary(): void {
  vocabularyCount.textContent = String(vocabulary.length)
  vocabularyList.replaceChildren()

  if (vocabulary.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'list-empty-row'
    empty.textContent = 'Добавьте первый термин — он будет применяться к результату распознавания.'
    vocabularyList.append(empty)
    return
  }

  for (const term of vocabulary) {
    const row = document.createElement('div')
    row.className = 'vocabulary-row'
    const copy = document.createElement('div')
    copy.className = 'setting-copy'
    const strong = document.createElement('strong')
    strong.textContent = term
    const detail = document.createElement('span')
    detail.textContent = 'Предпочтительное написание'
    copy.append(strong, detail)
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'icon-button'
    remove.dataset.removeTerm = term
    remove.setAttribute('aria-label', `Удалить ${term}`)
    remove.textContent = '×'
    row.append(copy, remove)
    vocabularyList.append(row)
  }
}

function renderHistory(): void {
  historyList.replaceChildren()
  latestResultCard.hidden = true
  historyEmpty.hidden = history.length > 0
  clearHistoryButton.disabled = history.length === 0
  historyCount.textContent = history.length
    ? `${history.length} ${pluralize(history.length, ['диктовка', 'диктовки', 'диктовок'])}`
    : 'Нет записей'

  for (const item of history) {
    const card = document.createElement('article')
    card.className = 'history-entry'
    const meta = document.createElement('div')
    meta.className = 'history-entry-meta'
    const date = document.createElement('span')
    date.textContent = new Intl.DateTimeFormat('ru', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(item.createdAt))
    const metrics = document.createElement('span')
    metrics.textContent = `${formatDuration(item.durationMs)} · ${item.latencyMs} мс`
    meta.append(date, metrics)
    const text = document.createElement('p')
    text.textContent = item.text
    const actions = document.createElement('div')
    actions.className = 'history-entry-actions'
    const copy = document.createElement('button')
    copy.type = 'button'
    copy.dataset.copyHistory = item.id
    copy.textContent = 'Копировать'
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.dataset.removeHistory = item.id
    remove.textContent = 'Удалить'
    actions.append(copy, remove)
    card.append(meta, text, actions)
    historyList.append(card)
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

function formatDuration(durationMs: number): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  return seconds < 60 ? `${seconds} сек` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function pluralize(value: number, forms: [string, string, string]): string {
  const mod100 = value % 100
  const mod10 = value % 10
  if (mod100 >= 11 && mod100 <= 19) return forms[2]
  if (mod10 === 1) return forms[0]
  if (mod10 >= 2 && mod10 <= 4) return forms[1]
  return forms[2]
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
onboardingBackButton.addEventListener('click', () =>
  renderOnboardingStep(onboardingStep - 1)
)
onboardingNextButton.addEventListener('click', () => {
  if (onboardingStep === onboardingSteps.length - 1) void finishOnboarding()
  else renderOnboardingStep(onboardingStep + 1)
})
onboardingMicrophoneButton.addEventListener('click', () =>
  void requestOnboardingMicrophone()
)
onboardingAccessibilityButton.addEventListener('click', () =>
  void requestOnboardingAccessibility()
)
onboardingTestButton.addEventListener('click', () => void toggleRecording())
window.addEventListener('focus', () => {
  if (!onboarding.hidden && microphonePermissionDenied) {
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
smartCorrectionToggle.addEventListener('change', async () => {
  const shouldEnable = smartCorrectionToggle.checked
  if (!shouldEnable) {
    await updatePreferences({ smartCorrectionEnabled: false })
    return
  }

  if (!api) {
    await updatePreferences({ smartCorrectionEnabled: true })
    return
  }

  smartCorrectionToggle.disabled = true
  try {
    smartCorrectionStatus = await api.prepareSmartCorrection()
    if (smartCorrectionStatus.state !== 'ready') {
      throw new Error('Локальная модель не готова')
    }
    await updatePreferences({ smartCorrectionEnabled: true })
  } catch (error) {
    preferences.smartCorrectionEnabled = false
    smartCorrectionStatus = {
      ...smartCorrectionStatus,
      state: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
    renderPreferences()
  } finally {
    renderSmartCorrectionStatus()
  }
})
asrRetryButton.addEventListener('click', async () => {
  if (!api) return
  asrRetryButton.disabled = true
  try {
    asrStatus = await api.prepareAsr()
  } catch (error) {
    asrStatus = {
      ...asrStatus,
      state: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  } finally {
    renderAsrStatus()
  }
})
vocabularyForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const term = vocabularyInput.value
  if (!term.trim()) return
  try {
    vocabulary = api ? await api.addVocabularyTerm(term) : [...vocabulary, term.trim()]
    vocabularyInput.value = ''
    vocabularyMessage.textContent = 'Термин сохранён локально'
    renderVocabulary()
  } catch (error) {
    vocabularyMessage.textContent = error instanceof Error ? error.message : String(error)
  }
})
vocabularyList.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) return
  const button = event.target.closest<HTMLButtonElement>('[data-remove-term]')
  const term = button?.dataset.removeTerm
  if (!term) return
  vocabulary = api
    ? await api.removeVocabularyTerm(term)
    : vocabulary.filter((item) => item !== term)
  renderVocabulary()
})
historyList.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) return
  const target = event.target
  const copyButton = target.closest<HTMLButtonElement>('[data-copy-history]')
  const removeButton = target.closest<HTMLButtonElement>('[data-remove-history]')
  if (copyButton) {
    const item = history.find((entry) => entry.id === copyButton.dataset.copyHistory)
    if (item) {
      await api?.copyText(item.text)
      copyButton.textContent = 'Скопировано'
      window.setTimeout(() => (copyButton.textContent = 'Копировать'), 1_200)
    }
  } else if (removeButton?.dataset.removeHistory) {
    history = api
      ? await api.removeHistoryEntry(removeButton.dataset.removeHistory)
      : history.filter((item) => item.id !== removeButton.dataset.removeHistory)
    renderHistory()
  }
})
clearHistoryButton.addEventListener('click', async () => {
  if (!history.length || !window.confirm('Очистить всю локальную историю диктовок?')) return
  await api?.clearHistory()
  history = []
  renderHistory()
})
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
    modelRuntimeValue.textContent =
      info.platform === 'darwin' ? 'Apple Neural Engine · Core ML' : 'CPU · ONNX Runtime'
    preferences = info.preferences
    smartCorrectionStatus = info.smartCorrection
    asrStatus = info.asrStatus
    vocabulary = info.vocabulary
    history = info.history
    renderPreferences()
    renderVocabulary()
    renderHistory()
    renderOverlayPlacement(info.overlayPlacement)
    onboardingHoldKeyGlyph.textContent = holdKeyGlyphFor(preferences.holdKey)
    onboardingHoldKeyLabel.textContent = formatHoldKey(preferences.holdKey, appPlatform)
    renderOnboardingPermissions()
    void populateMicrophones()
    if (!preferences.onboardingCompleted) showOnboarding(true)
    else onboarding.hidden = true
  })
    .catch(showError)
} else {
  document.body.dataset.platform = 'darwin'
  renderPreferences()
  renderVocabulary()
  renderHistory()
  renderOverlayPlacement({ mode: 'bottom-center' })
}

updateLevel(0)
void setState('idle')
