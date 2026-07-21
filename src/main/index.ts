import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  shell,
  systemPreferences,
  Tray
} from 'electron'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { uIOhook, UiohookKey, type UiohookKeyboardEvent } from 'uiohook-napi'
import type {
  AppInfo,
  AppPreferences,
  DictationHistoryItem,
  HoldKey,
  OverlayMotion,
  OverlayPlacement,
  OverlayPlacementMode,
  PcmRecordingPayload,
  RecordingState
} from '../shared/contracts'
import { IPC } from '../shared/contracts'
import { createAsrEngine } from './asr/create-engine'
import { RecordingService } from './recording-service'
import { isTextInsertionInProgress } from './text-inserter'
import { SmartCorrectionService } from './smart-correction-service'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultAccelerator = 'CommandOrControl+Shift+Space'
const defaultHoldKey: HoldKey =
  process.platform === 'darwin' ? 'right-option' : 'right-control'
const hasSingleInstanceLock = app.requestSingleInstanceLock()
// Dictation starts from a global key while the settings window is hidden, so
// Chromium must allow the recorder's AudioContext without a renderer click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const asrEngine = createAsrEngine({
  windowsWorkerPath: path.join(currentDirectory, 'windows-asr-worker.js'),
  windowsModelsDirectory: path.join(app.getPath('userData'), 'models', 'parakeet-v3-onnx')
})
const smartCorrectionService = new SmartCorrectionService(
  path.join(currentDirectory, 'llm-worker.js'),
  path.join(app.getPath('userData'), 'models', 'smart-correction')
)
const recordingService = new RecordingService(asrEngine, smartCorrectionService)

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayMenu: Menu | null = null
let currentState: RecordingState = 'idle'
let overlayPlacement: OverlayPlacement = { mode: 'bottom-center' }
let preferences: AppPreferences = {
  launchAtLogin: false,
  activationMode: 'hold',
  accelerator: defaultAccelerator,
  holdKey: defaultHoldKey,
  microphoneId: '',
  autoPaste: true,
  keepRecordings: true,
  showOverlayWhenIdle: true,
  overlayMotion: 'balanced',
  smartCorrectionEnabled: false,
  onboardingCompleted: false
}
let vocabulary: string[] = []
let history: DictationHistoryItem[] = []
let isQuitting = false
let applicationResourcesDisposed = false
let isProgrammaticOverlayMove = false
let overlayMoveSaveTimer: ReturnType<typeof setTimeout> | null = null
let overlayDragTimer: ReturnType<typeof setInterval> | null = null
let overlayDragSafetyTimer: ReturnType<typeof setTimeout> | null = null
let activeRecordingFinish: ReturnType<RecordingService['finish']> | null = null
let overlayHiddenUntilRecording = false
let keyboardHookRunning = false
let holdKeyPressed = false
let activeHoldKeyCode: number = UiohookKey.CtrlRight
let hotkeyCaptureActive = false
let hotkeyCaptureSafetyTimer: ReturnType<typeof setTimeout> | null = null

interface PersistedAppState {
  overlayPlacement: OverlayPlacement
  preferences: AppPreferences
  vocabulary: string[]
  history: DictationHistoryItem[]
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#f3f3f5',
    ...(process.platform === 'win32'
      ? { icon: path.join(app.getAppPath(), 'assets', 'branding', 'cure-voicer.ico') }
      : {}),
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          vibrancy: 'under-window' as const,
          visualEffectState: 'active' as const
        }
      : {
          titleBarStyle: 'default' as const,
          backgroundMaterial: 'mica' as const
        }),
    webPreferences: {
      preload: path.join(currentDirectory, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  })

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(path.join(currentDirectory, '../renderer/index.html'))
  }

  return window
}

function createOverlayWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 164,
    height: 132,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(currentDirectory, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  })

  window.setAlwaysOnTop(true, process.platform === 'darwin' ? 'floating' : 'normal')
  if (process.platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  window.webContents.once('did-finish-load', () => {
    window.webContents.send(IPC.overlayState, currentState)
    window.webContents.send(IPC.overlayPreferencesChanged, preferences)
    positionOverlay(window)
    if (preferences.onboardingCompleted && preferences.showOverlayWhenIdle) {
      window.showInactive()
    }
  })

  window.on('move', () => {
    if (isProgrammaticOverlayMove) return
    if (overlayMoveSaveTimer) clearTimeout(overlayMoveSaveTimer)
    overlayMoveSaveTimer = setTimeout(() => {
      if (window.isDestroyed()) return
      const { x, y } = window.getBounds()
      overlayPlacement = { mode: 'custom', x, y }
      void saveOverlayPlacement()
      mainWindow?.webContents.send(IPC.overlayPlacementChanged, overlayPlacement)
    }, 180)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(new URL('/overlay.html', process.env.ELECTRON_RENDERER_URL).toString())
  } else {
    void window.loadFile(path.join(currentDirectory, '../renderer/overlay.html'))
  }

  return window
}

function createTray(): Tray {
  const iconFile =
    process.platform === 'win32'
      ? 'cure-voicer-tray-windows.png'
      : 'cure-voicer-trayTemplate.png'
  const icon = nativeImage
    .createFromPath(
      path.join(
        app.getAppPath(),
        'assets',
        'branding',
        iconFile
      )
    )

  if (icon.isEmpty()) throw new Error('Could not create Cure Voicer tray icon')
  if (process.platform === 'darwin') icon.setTemplateImage(true)

  const appTray = new Tray(icon)
  appTray.setToolTip('Cure Voicer')
  appTray.on('click', () => {
    if (trayMenu) appTray.popUpContextMenu(trayMenu)
  })
  appTray.on('right-click', () => {
    if (trayMenu) appTray.popUpContextMenu(trayMenu)
  })
  rebuildTrayMenu(appTray)
  return appTray
}

function rebuildTrayMenu(appTray = tray): void {
  if (!appTray) return

  const stateLabels: Record<RecordingState, string> = {
    idle: 'Начать запись',
    starting: 'Подготовка микрофона…',
    recording: 'Остановить запись',
    transcribing: 'Транскрибация…',
    error: 'Повторить запись'
  }

  trayMenu = Menu.buildFromTemplate([
    {
      label: preferences.onboardingCompleted
        ? stateLabels[currentState]
        : 'Завершить настройку…',
      enabled:
        !preferences.onboardingCompleted ||
        (currentState !== 'starting' && currentState !== 'transcribing'),
      click: preferences.onboardingCompleted ? requestRecordingToggle : showWindow
    },
    { type: 'separator' },
    { label: 'Настройки…', click: showWindow },
    {
      label: 'Выйти',
      click: quitApplication
    }
  ])
}

function registerIpc(): void {
  ipcMain.handle(IPC.getAppInfo, (event): AppInfo => {
    assertTrustedSender(event)
    return {
      version: app.getVersion(),
      platform: process.platform,
      accelerator: preferences.accelerator,
      recordingsDirectory: recordingService.recordingsDirectory,
      asrEngine: asrEngine.id,
      overlayPlacement,
      preferences,
      globalInputAvailable: isGlobalInputAvailable(),
      vocabulary,
      history,
      smartCorrection: smartCorrectionService.status,
      asrStatus: asrEngine.status
    }
  })

  ipcMain.handle(IPC.setRecordingState, (event, state: RecordingState) => {
    assertTrustedSender(event)
    if (!isRecordingState(state)) throw new Error('Invalid recording state')
    currentState = state
    rebuildTrayMenu()
    updateOverlayState(state)
  })

  ipcMain.on(IPC.setAudioLevel, (event, level: number) => {
    assertTrustedSender(event)
    if (!Number.isFinite(level)) return
    overlayWindow?.webContents.send(
      IPC.overlayAudioLevel,
      Math.max(0, Math.min(1, level))
    )
  })

  ipcMain.handle(
    IPC.finishRecording,
    async (event, payload: PcmRecordingPayload) => {
      assertTrustedSender(event)
      validateRecordingPayload(payload)
      if (activeRecordingFinish) return activeRecordingFinish

      activeRecordingFinish = recordingService.finish(payload, {
        autoPaste: preferences.autoPaste,
        keepRecording: preferences.keepRecordings,
        preferredTerms: vocabulary,
        smartCorrectionEnabled: preferences.smartCorrectionEnabled
      })
      try {
        const result = await activeRecordingFinish
        if (result.transcript) {
          history = [
            {
              id: randomUUID(),
              createdAt: new Date().toISOString(),
              text: result.transcript,
              durationMs: payload.durationMs,
              latencyMs: result.latencyMs,
              insertion: result.insertion
            },
            ...history
          ].slice(0, 100)
          await saveAppState()
        }
        return result
      } finally {
        activeRecordingFinish = null
      }
    }
  )

  ipcMain.handle(
    IPC.setOverlayPlacement,
    async (event, mode: OverlayPlacementMode) => {
      assertTrustedSender(event)
      if (!isPresetPlacement(mode)) throw new Error('Invalid overlay placement')
      overlayPlacement = { mode }
      await saveOverlayPlacement()
      positionOverlay()
      mainWindow?.webContents.send(IPC.overlayPlacementChanged, overlayPlacement)
      return overlayPlacement
    }
  )

  ipcMain.handle(
    IPC.updatePreferences,
    async (event, patch: Partial<AppPreferences>) => {
      assertTrustedSender(event)
      preferences = await applyPreferencePatch(patch)
      await saveAppState()
      overlayWindow?.webContents.send(IPC.overlayPreferencesChanged, preferences)
      updateOverlayState(currentState)
      return preferences
    }
  )

  ipcMain.handle(IPC.requestGlobalInputAccess, (event) => {
    assertTrustedSender(event)
    if (process.platform !== 'darwin') return true
    systemPreferences.isTrustedAccessibilityClient(true)
    return isGlobalInputAvailable()
  })

  ipcMain.handle(IPC.openSystemSettings, async (event, kind: unknown) => {
    assertTrustedSender(event)
    if (kind !== 'microphone' && kind !== 'accessibility') {
      throw new Error('Invalid permission settings kind')
    }
    const target =
      process.platform === 'darwin'
        ? kind === 'microphone'
          ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
          : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        : kind === 'microphone'
          ? 'ms-settings:privacy-microphone'
          : 'ms-settings:easeofaccess'
    await shell.openExternal(target)
  })

  ipcMain.handle(IPC.completeOnboarding, async (event) => {
    assertTrustedSender(event)
    preferences = { ...preferences, onboardingCompleted: true }
    await saveAppState()
    try {
      configureRecordingActivation(preferences)
    } catch (error) {
      console.warn('Could not configure recording activation after onboarding', error)
    }
    overlayWindow?.webContents.send(IPC.overlayPreferencesChanged, preferences)
    updateOverlayState('idle')
    rebuildTrayMenu()
    return preferences
  })

  ipcMain.handle(IPC.setHotkeyCapture, (event, active: boolean) => {
    assertTrustedSender(event)
    if (typeof active !== 'boolean') throw new Error('Invalid capture state')
    setHotkeyCapture(active)
    return isGlobalInputAvailable()
  })

  ipcMain.handle(IPC.addVocabularyTerm, async (event, rawTerm: string) => {
    assertTrustedSender(event)
    const term = sanitizeVocabularyTerm(rawTerm)
    if (!vocabulary.some((item) => item.localeCompare(term, undefined, { sensitivity: 'accent' }) === 0)) {
      vocabulary = [...vocabulary, term].sort((left, right) => left.localeCompare(right))
      await saveAppState()
    }
    return vocabulary
  })

  ipcMain.handle(IPC.removeVocabularyTerm, async (event, rawTerm: string) => {
    assertTrustedSender(event)
    vocabulary = vocabulary.filter((term) => term !== rawTerm)
    await saveAppState()
    return vocabulary
  })

  ipcMain.handle(IPC.removeHistoryEntry, async (event, id: string) => {
    assertTrustedSender(event)
    history = history.filter((item) => item.id !== id)
    await saveAppState()
    return history
  })

  ipcMain.handle(IPC.clearHistory, async (event) => {
    assertTrustedSender(event)
    history = []
    await saveAppState()
  })

  ipcMain.handle(IPC.copyText, (event, text: string) => {
    assertTrustedSender(event)
    if (typeof text !== 'string' || text.length > 100_000) throw new Error('Invalid text')
    clipboard.writeText(text)
  })

  ipcMain.handle(IPC.prepareAsr, async (event) => {
    assertTrustedSender(event)
    await asrEngine.prepare?.()
    return asrEngine.status
  })

  ipcMain.handle(IPC.prepareSmartCorrection, async (event) => {
    assertTrustedSender(event)
    return smartCorrectionService.prepare()
  })

  ipcMain.on(IPC.beginOverlayDrag, (event) => {
    assertTrustedSender(event)
    beginOverlayDrag()
  })

  ipcMain.on(IPC.endOverlayDrag, (event) => {
    assertTrustedSender(event)
    endOverlayDrag()
  })

  ipcMain.on(IPC.showOverlayMenu, (event) => {
    assertTrustedSender(event)
    showOverlayContextMenu()
  })
}

function assertTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): void {
  const senderUrl = event.senderFrame?.url
  if (!senderUrl || !isTrustedRendererUrl(senderUrl)) {
    throw new Error('Rejected IPC request from an untrusted renderer')
  }
}

function isTrustedRendererUrl(url: string): boolean {
  if (process.env.ELECTRON_RENDERER_URL) {
    return new URL(url).origin === new URL(process.env.ELECTRON_RENDERER_URL).origin
  }

  const rendererUrl = pathToFileURL(
    path.join(currentDirectory, '../renderer/index.html')
  ).toString()
  const overlayUrl = pathToFileURL(
    path.join(currentDirectory, '../renderer/overlay.html')
  ).toString()
  return url === rendererUrl || url === overlayUrl
}

function isRecordingState(value: unknown): value is RecordingState {
  return ['idle', 'starting', 'recording', 'transcribing', 'error'].includes(
    String(value)
  )
}

function validateRecordingPayload(payload: PcmRecordingPayload): void {
  const maxRecordingBytes = 16_000 * Float32Array.BYTES_PER_ELEMENT * 60 * 15
  if (
    !payload ||
    !(payload.samples instanceof Uint8Array) ||
    payload.samples.byteLength === 0 ||
    payload.samples.byteLength > maxRecordingBytes ||
    payload.sampleRate !== 16_000
  ) {
    throw new Error('Invalid PCM recording payload')
  }
}

function requestRecordingToggle(): void {
  if (!preferences.onboardingCompleted) {
    showWindow()
    return
  }
  sendRecordingCommand('toggle')
}

function sendRecordingCommand(command: 'toggle' | 'start' | 'stop'): void {
  const shouldStart =
    command === 'start' ||
    (command === 'toggle' && (currentState === 'idle' || currentState === 'error'))
  const shouldStop =
    command === 'stop' || (command === 'toggle' && currentState === 'recording')

  if (shouldStart && (currentState === 'idle' || currentState === 'error')) {
    updateOverlayState('starting')
  } else if (shouldStop && (currentState === 'starting' || currentState === 'recording')) {
    updateOverlayState('transcribing')
  }

  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(IPC.recordingCommand, command)
}

function handleGlobalKeyDown(event: UiohookKeyboardEvent): void {
  if (isTextInsertionInProgress()) return
  if (preferences.activationMode !== 'hold') return
  if (event.keycode !== activeHoldKeyCode || holdKeyPressed) return
  holdKeyPressed = true
  sendRecordingCommand('start')
}

function handleGlobalKeyUp(event: UiohookKeyboardEvent): void {
  if (isTextInsertionInProgress()) return
  if (event.keycode !== activeHoldKeyCode || !holdKeyPressed) return
  holdKeyPressed = false
  sendRecordingCommand('stop')
}

function configureRecordingActivation(nextPreferences: AppPreferences): void {
  if (holdKeyPressed) sendRecordingCommand('stop')
  globalShortcut.unregisterAll()
  stopKeyboardHook()

  if (nextPreferences.activationMode === 'hold') {
    if (
      process.platform === 'darwin' &&
      !systemPreferences.isTrustedAccessibilityClient(false)
    ) {
      return
    }
    activeHoldKeyCode = holdKeyCode(nextPreferences.holdKey)
    uIOhook.on('keydown', handleGlobalKeyDown)
    uIOhook.on('keyup', handleGlobalKeyUp)
    uIOhook.start()
    keyboardHookRunning = true
    return
  }

  if (!globalShortcut.register(nextPreferences.accelerator, requestRecordingToggle)) {
    throw new Error('Эта горячая клавиша уже занята другой программой')
  }
}

function setHotkeyCapture(active: boolean): void {
  if (hotkeyCaptureSafetyTimer) clearTimeout(hotkeyCaptureSafetyTimer)
  hotkeyCaptureSafetyTimer = null
  hotkeyCaptureActive = active

  if (active) {
    if (holdKeyPressed) sendRecordingCommand('stop')
    globalShortcut.unregisterAll()
    stopKeyboardHook()
    hotkeyCaptureSafetyTimer = setTimeout(() => setHotkeyCapture(false), 12_000)
    return
  }

  configureRecordingActivation(preferences)
}

function isGlobalInputAvailable(): boolean {
  return (
    process.platform !== 'darwin' ||
    systemPreferences.isTrustedAccessibilityClient(false)
  )
}

function stopKeyboardHook(): void {
  holdKeyPressed = false
  uIOhook.removeListener('keydown', handleGlobalKeyDown)
  uIOhook.removeListener('keyup', handleGlobalKeyUp)
  if (!keyboardHookRunning) return
  uIOhook.stop()
  keyboardHookRunning = false
}

function holdKeyCode(key: HoldKey): number {
  const codes: Record<HoldKey, number> = {
    'left-control': UiohookKey.Ctrl,
    'right-control': UiohookKey.CtrlRight,
    'left-option': UiohookKey.Alt,
    'right-option': UiohookKey.AltRight,
    'left-command': UiohookKey.Meta,
    'right-command': UiohookKey.MetaRight,
    'left-shift': UiohookKey.Shift,
    'right-shift': UiohookKey.ShiftRight,
    f6: UiohookKey.F6,
    f7: UiohookKey.F7,
    f8: UiohookKey.F8,
    f9: UiohookKey.F9,
    f10: UiohookKey.F10,
    f11: UiohookKey.F11,
    f12: UiohookKey.F12
  }
  return codes[key]
}

function updateOverlayState(state: RecordingState): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (!preferences.onboardingCompleted) {
    overlayWindow.hide()
    return
  }

  if (state !== 'idle') overlayHiddenUntilRecording = false
  if (
    state === 'idle' &&
    (overlayHiddenUntilRecording || !preferences.showOverlayWhenIdle)
  ) {
    overlayWindow.hide()
    return
  }

  positionOverlay()
  overlayWindow.webContents.send(IPC.overlayState, state)
  overlayWindow.showInactive()
}

function beginOverlayDrag(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  endOverlayDrag()

  const startCursor = screen.getCursorScreenPoint()
  const [startX = 0, startY = 0] = overlayWindow.getPosition()
  overlayDragTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      endOverlayDrag()
      return
    }
    const cursor = screen.getCursorScreenPoint()
    overlayWindow.setPosition(
      startX + cursor.x - startCursor.x,
      startY + cursor.y - startCursor.y,
      false
    )
  }, 16)

  overlayDragSafetyTimer = setTimeout(endOverlayDrag, 15_000)
}

function endOverlayDrag(): void {
  if (overlayDragTimer) clearInterval(overlayDragTimer)
  if (overlayDragSafetyTimer) clearTimeout(overlayDragSafetyTimer)
  overlayDragTimer = null
  overlayDragSafetyTimer = null
}

function showOverlayContextMenu(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  endOverlayDrag()

  const menu = Menu.buildFromTemplate([
    { label: 'Настройки…', click: showWindow },
    {
      label: 'Скрыть до следующей диктовки',
      enabled: currentState === 'idle' || currentState === 'error',
      click: () => {
        overlayHiddenUntilRecording = true
        overlayWindow?.hide()
      }
    },
    { type: 'separator' },
    {
      label: 'Выйти из Cure Voicer',
      click: quitApplication
    }
  ])
  menu.popup({ window: overlayWindow })
}

function positionOverlay(targetWindow = overlayWindow): void {
  if (!targetWindow) return
  const referencePoint =
    overlayPlacement.mode === 'custom' &&
    Number.isFinite(overlayPlacement.x) &&
    Number.isFinite(overlayPlacement.y)
      ? { x: overlayPlacement.x ?? 0, y: overlayPlacement.y ?? 0 }
      : screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(referencePoint)
  const bounds = targetWindow.getBounds()
  const margin = 24
  const defaultY = Math.round(
    display.workArea.y + display.workArea.height - bounds.height - 20
  )

  let x: number
  let y: number
  switch (overlayPlacement.mode) {
    case 'bottom-left':
      x = display.workArea.x + margin
      y = defaultY
      break
    case 'bottom-right':
      x = display.workArea.x + display.workArea.width - bounds.width - margin
      y = defaultY
      break
    case 'custom':
      x = clamp(
        Math.round(overlayPlacement.x ?? display.workArea.x + margin),
        display.workArea.x,
        display.workArea.x + display.workArea.width - bounds.width
      )
      y = clamp(
        Math.round(overlayPlacement.y ?? defaultY),
        display.workArea.y,
        display.workArea.y + display.workArea.height - bounds.height
      )
      break
    default:
      x = Math.round(display.workArea.x + (display.workArea.width - bounds.width) / 2)
      y = defaultY
  }

  if (targetWindow.getPosition()[0] === x && targetWindow.getPosition()[1] === y) return
  isProgrammaticOverlayMove = true
  targetWindow.setPosition(x, y, false)
  setTimeout(() => {
    isProgrammaticOverlayMove = false
  }, 120)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function isPresetPlacement(
  value: unknown
): value is Exclude<OverlayPlacementMode, 'custom'> {
  return ['bottom-left', 'bottom-center', 'bottom-right'].includes(String(value))
}

async function loadAppState(): Promise<void> {
  try {
    const contents = await readFile(settingsFilePath(), 'utf8')
    const state = JSON.parse(contents) as Partial<PersistedAppState>
    const value = state.overlayPlacement
    if (value && isPresetPlacement(value.mode)) overlayPlacement = { mode: value.mode }
    else if (
      value?.mode === 'custom' &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y)
    ) {
      overlayPlacement = { mode: 'custom', x: value.x, y: value.y }
    }

    const stored = state.preferences
    if (stored) {
      preferences = {
        launchAtLogin: typeof stored.launchAtLogin === 'boolean' ? stored.launchAtLogin : false,
        activationMode: isRecordingActivationMode(stored.activationMode)
          ? stored.activationMode
          : 'hold',
        accelerator: isSupportedAccelerator(stored.accelerator)
          ? stored.accelerator
          : defaultAccelerator,
        holdKey: isHoldKey(stored.holdKey) ? stored.holdKey : defaultHoldKey,
        microphoneId: typeof stored.microphoneId === 'string' ? stored.microphoneId : '',
        autoPaste: typeof stored.autoPaste === 'boolean' ? stored.autoPaste : true,
        keepRecordings:
          typeof stored.keepRecordings === 'boolean' ? stored.keepRecordings : true,
        showOverlayWhenIdle:
          typeof stored.showOverlayWhenIdle === 'boolean' ? stored.showOverlayWhenIdle : true,
        overlayMotion: isOverlayMotion(stored.overlayMotion)
          ? stored.overlayMotion
          : 'balanced',
        smartCorrectionEnabled:
          typeof stored.smartCorrectionEnabled === 'boolean'
            ? stored.smartCorrectionEnabled
            : false,
        onboardingCompleted:
          typeof stored.onboardingCompleted === 'boolean'
            ? stored.onboardingCompleted
            : false
      }
    }

    vocabulary = Array.isArray(state.vocabulary)
      ? state.vocabulary
          .filter((term): term is string => typeof term === 'string')
          .map((term) => term.trim())
          .filter(Boolean)
          .slice(0, 500)
      : []
    history = Array.isArray(state.history)
      ? state.history.filter(isHistoryItem).slice(0, 100)
      : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Could not load overlay placement', error)
    }
  }
}

async function saveOverlayPlacement(): Promise<void> {
  await saveAppState()
}

async function saveAppState(): Promise<void> {
  const filePath = settingsFilePath()
  await mkdir(path.dirname(filePath), { recursive: true })
  const state: PersistedAppState = { overlayPlacement, preferences, vocabulary, history }
  await writeFile(filePath, JSON.stringify(state, null, 2))
}

async function applyPreferencePatch(patch: Partial<AppPreferences>): Promise<AppPreferences> {
  if (!patch || typeof patch !== 'object') throw new Error('Invalid preferences')
  const next = { ...preferences }

  if (patch.accelerator !== undefined) {
    if (!isSupportedAccelerator(patch.accelerator)) throw new Error('Unsupported hotkey')
    next.accelerator = patch.accelerator
  }
  if (patch.activationMode !== undefined) {
    if (!isRecordingActivationMode(patch.activationMode)) {
      throw new Error('Unsupported activation mode')
    }
    next.activationMode = patch.activationMode
  }
  if (patch.holdKey !== undefined) {
    if (!isHoldKey(patch.holdKey)) throw new Error('Unsupported hold key')
    next.holdKey = patch.holdKey
  }

  for (const key of [
    'launchAtLogin',
    'autoPaste',
    'keepRecordings',
    'showOverlayWhenIdle',
    'smartCorrectionEnabled',
    'onboardingCompleted'
  ] as const) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'boolean') throw new Error(`Invalid ${key}`)
      next[key] = patch[key]
    }
  }

  if (patch.microphoneId !== undefined) {
    if (typeof patch.microphoneId !== 'string' || patch.microphoneId.length > 512) {
      throw new Error('Invalid microphone')
    }
    next.microphoneId = patch.microphoneId
  }
  if (patch.overlayMotion !== undefined) {
    if (!isOverlayMotion(patch.overlayMotion)) throw new Error('Invalid overlay motion')
    next.overlayMotion = patch.overlayMotion
  }

  if (next.launchAtLogin !== preferences.launchAtLogin) {
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
  }

  const activationChanged =
    next.activationMode !== preferences.activationMode ||
    next.accelerator !== preferences.accelerator ||
    next.holdKey !== preferences.holdKey
  if (activationChanged && next.onboardingCompleted && !hotkeyCaptureActive) {
    try {
      configureRecordingActivation(next)
    } catch (error) {
      configureRecordingActivation(preferences)
      throw error
    }
  }
  return next
}

function isSupportedAccelerator(value: unknown): value is string {
  return [
    defaultAccelerator,
    'CommandOrControl+Option+Space',
    'CommandOrControl+Shift+D'
  ].includes(String(value))
}

function isOverlayMotion(value: unknown): value is OverlayMotion {
  return ['calm', 'balanced', 'expressive'].includes(String(value))
}

function isRecordingActivationMode(
  value: unknown
): value is AppPreferences['activationMode'] {
  return ['toggle', 'hold'].includes(String(value))
}

function isHoldKey(value: unknown): value is HoldKey {
  return [
    'left-control',
    'right-control',
    'left-option',
    'right-option',
    'left-command',
    'right-command',
    'left-shift',
    'right-shift',
    'f6',
    'f7',
    'f8',
    'f9',
    'f10',
    'f11',
    'f12'
  ].includes(String(value))
}

function sanitizeVocabularyTerm(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Введите слово или термин')
  const term = value.replace(/\s+/g, ' ').trim()
  if (!term || term.length > 80) throw new Error('Термин должен содержать от 1 до 80 символов')
  if (vocabulary.length >= 500) throw new Error('В словаре может быть не более 500 терминов')
  return term
}

function isHistoryItem(value: unknown): value is DictationHistoryItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<DictationHistoryItem>
  return (
    typeof item.id === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.text === 'string' &&
    typeof item.durationMs === 'number' &&
    typeof item.latencyMs === 'number' &&
    ['pasted', 'clipboard', 'skipped'].includes(String(item.insertion))
  )
}

function settingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const replacement = createWindow()
    mainWindow = replacement
    replacement.once('ready-to-show', () => {
      if (replacement.isDestroyed()) return
      replacement.show()
      replacement.focus()
    })
    return
  }

  const window = mainWindow
  if (window.webContents.isLoadingMainFrame()) {
    window.once('ready-to-show', () => {
      if (window.isDestroyed()) return
      window.show()
      window.focus()
    })
    return
  }

  window.show()
  window.focus()
}

function quitApplication(): void {
  if (isQuitting) return
  isQuitting = true
  disposeApplicationResources()

  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy()
  mainWindow = null
  overlayWindow = null
  tray?.destroy()
  tray = null
  trayMenu = null

  // This menu action is explicitly a full exit. `app.exit` guarantees that a
  // background tray or native hook cannot keep the Electron process alive.
  app.exit(0)
}

function disposeApplicationResources(): void {
  if (applicationResourcesDisposed) return
  applicationResourcesDisposed = true
  if (hotkeyCaptureSafetyTimer) clearTimeout(hotkeyCaptureSafetyTimer)
  if (overlayMoveSaveTimer) clearTimeout(overlayMoveSaveTimer)
  hotkeyCaptureSafetyTimer = null
  overlayMoveSaveTimer = null
  globalShortcut.unregisterAll()
  stopKeyboardHook()
  endOverlayDrag()
  asrEngine.dispose?.()
  smartCorrectionService.dispose()
}

if (!hasSingleInstanceLock) app.quit()

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return
  if (process.platform === 'win32') app.setAppUserModelId('com.curevoicer.desktop')
  if (process.platform === 'darwin') app.dock?.hide()
  await loadAppState()

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      if (permission !== 'media' || !('mediaTypes' in details)) {
        callback(false)
        return
      }

      const mediaTypes = details.mediaTypes ?? []
      const isAudioOnly = mediaTypes.length === 0 || mediaTypes.every((type) => type === 'audio')
      callback(
        isAudioOnly && isTrustedRendererUrl(webContents.getURL())
      )
    }
  )

  registerIpc()
  smartCorrectionService.onStatusChanged((status) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(IPC.smartCorrectionStatusChanged, status)
  })
  asrEngine.onStatusChanged?.((status) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(IPC.asrStatusChanged, status)
  })
  await smartCorrectionService.refreshStatus()
  await asrEngine.refreshStatus?.()
  mainWindow = createWindow()
  if (!preferences.onboardingCompleted) {
    const onboardingWindow = mainWindow
    onboardingWindow.once('ready-to-show', () => {
      if (onboardingWindow.isDestroyed()) return
      onboardingWindow.show()
      onboardingWindow.focus()
    })
  }
  overlayWindow = createOverlayWindow()
  tray = createTray()

  void asrEngine.prepare?.().catch((error) => {
    console.error('Could not prepare local ASR engine', error)
  })
  if (preferences.smartCorrectionEnabled) {
    void smartCorrectionService.prepare().catch((error) => {
      console.warn('Could not prepare smart correction', error)
    })
  }

  if (preferences.onboardingCompleted) {
    try {
      configureRecordingActivation(preferences)
    } catch (error) {
      console.warn('Could not configure recording activation', error)
    }
  }
})

app.on('second-instance', () => {
  // Cure Voicer remains a background tray app. A repeated launch must
  // not create another overlay or open settings without an explicit tray action.
})

app.on('before-quit', () => {
  // Allow the settings window to close during an actual quit or a dev hot-reload.
  // Without this guard the close handler hides the window and leaves an orphaned
  // Electron process holding the single-instance lock.
  isQuitting = true
})

app.on('will-quit', () => {
  disposeApplicationResources()
})
app.on('window-all-closed', () => {
  // Tray apps intentionally stay alive on both desktop platforms.
})
