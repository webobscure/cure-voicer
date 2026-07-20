import {
  app,
  BrowserWindow,
  globalShortcut,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  systemPreferences,
  Tray
} from 'electron'
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type {
  AppInfo,
  OverlayPlacement,
  OverlayPlacementMode,
  PcmRecordingPayload,
  RecordingState
} from '../shared/contracts'
import { IPC } from '../shared/contracts'
import { createAsrEngine } from './asr/create-engine'
import { RecordingService } from './recording-service'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const accelerator = 'CommandOrControl+Shift+Space'
const hasSingleInstanceLock = app.requestSingleInstanceLock()
const asrEngine = createAsrEngine()
const recordingService = new RecordingService(asrEngine)

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayMenu: Menu | null = null
let currentState: RecordingState = 'idle'
let overlayPlacement: OverlayPlacement = { mode: 'bottom-center' }
let isQuitting = false
let isProgrammaticOverlayMove = false
let overlayMoveSaveTimer: ReturnType<typeof setTimeout> | null = null
let overlayDragTimer: ReturnType<typeof setInterval> | null = null
let overlayDragSafetyTimer: ReturnType<typeof setTimeout> | null = null
let activeRecordingFinish: ReturnType<RecordingService['finish']> | null = null
let overlayHiddenUntilRecording = false

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#f3f3f5',
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
    positionOverlay(window)
    window.showInactive()
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
  const icon = nativeImage
    .createFromDataURL(
      'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><rect x="6" y="2" width="6" height="10" rx="3" fill="black"/><path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2M6 16h6" fill="none" stroke="black" stroke-width="1.6" stroke-linecap="round"/></svg>'
        )
    )
    .resize({ width: 18, height: 18 })

  if (process.platform === 'darwin') icon.setTemplateImage(true)

  const appTray = new Tray(icon)
  appTray.setToolTip('Cure Voicer')
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
      label: stateLabels[currentState],
      enabled: currentState !== 'starting' && currentState !== 'transcribing',
      click: requestRecordingToggle
    },
    { type: 'separator' },
    { label: 'Настройки…', click: showWindow },
    {
      label: 'Выйти',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
}

function registerIpc(): void {
  ipcMain.handle(IPC.getAppInfo, (event): AppInfo => {
    assertTrustedSender(event)
    return {
      version: app.getVersion(),
      platform: process.platform,
      accelerator,
      recordingsDirectory: recordingService.recordingsDirectory,
      asrEngine: asrEngine.id,
      overlayPlacement
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

      activeRecordingFinish = recordingService.finish(payload)
      try {
        return await activeRecordingFinish
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
  if (currentState === 'idle' || currentState === 'error') {
    updateOverlayState('starting')
  } else if (currentState === 'recording') {
    updateOverlayState('transcribing')
  }
  mainWindow?.webContents.send(IPC.toggleRequested)
}

function updateOverlayState(state: RecordingState): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  if (state !== 'idle') overlayHiddenUntilRecording = false
  if (state === 'idle' && overlayHiddenUntilRecording) {
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
      click: () => {
        isQuitting = true
        app.quit()
      }
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

async function loadOverlayPlacement(): Promise<void> {
  try {
    const contents = await readFile(settingsFilePath(), 'utf8')
    const value = (JSON.parse(contents) as { overlayPlacement?: OverlayPlacement })
      .overlayPlacement
    if (!value) return
    if (isPresetPlacement(value.mode)) overlayPlacement = { mode: value.mode }
    else if (
      value.mode === 'custom' &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y)
    ) {
      overlayPlacement = { mode: 'custom', x: value.x, y: value.y }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Could not load overlay placement', error)
    }
  }
}

async function saveOverlayPlacement(): Promise<void> {
  const filePath = settingsFilePath()
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify({ overlayPlacement }, null, 2))
}

function settingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function showWindow(): void {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

async function requestMicrophonePermission(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') {
    await systemPreferences.askForMediaAccess('microphone')
  }
}

if (!hasSingleInstanceLock) app.quit()

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return
  if (process.platform === 'darwin') app.dock?.hide()
  await loadOverlayPlacement()

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
  mainWindow = createWindow()
  overlayWindow = createOverlayWindow()
  tray = createTray()

  void asrEngine.prepare?.().catch((error) => {
    console.error('Could not prepare local ASR engine', error)
  })

  if (!globalShortcut.register(accelerator, requestRecordingToggle)) {
    console.warn(`Could not register global shortcut: ${accelerator}`)
  }

  await requestMicrophonePermission()
})

app.on('second-instance', () => {
  // Cure Voicer remains a background tray app. A repeated launch must not
  // create another overlay or open settings without an explicit tray action.
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  endOverlayDrag()
  asrEngine.dispose?.()
})
app.on('window-all-closed', () => {
  // Tray apps intentionally stay alive on both desktop platforms.
})
