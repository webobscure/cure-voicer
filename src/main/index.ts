import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  type MessageBoxOptions,
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
import { fileURLToPath } from 'node:url'
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
import { isTextInsertionInProgress } from '../modules/insertion/insertion-activity'
import { createApplicationServices } from './app/create-application-services'
import type { RecordingService } from './recording-service'
import { registerApplicationLifecycle } from './app/application-lifecycle'
import { hardenWindow, RendererPolicy } from './security/renderer-policy'
import type { DictationSnapshot, DictationState } from '../shared/types/dictation'
import type { InsertionResult } from '../shared/types/insertion'
import { templateRequestSchema, textRequestSchema, transformTextRequestSchema } from '../shared/validation/ipc'
import type { InternalEditorDocumentInput } from '../modules/insertion/ports'
import {
  audioLevelSchema,
  booleanValueSchema,
  copyTextSchema,
  dictationSessionIdSchema,
  historyIdSchema,
  legacyPreferencesPatchSchema,
  overlayPlacementModeSchema,
  pcmRecordingPayloadSchema,
  permissionSettingsKindSchema,
  recordingStateSchema,
  vocabularyTermSchema
} from '../shared/validation/legacy-ipc'
import { LocalDatabase } from './storage/local-database'
import { isPotentiallySensitiveText } from '../modules/clipboard/sensitive-text'
import type { ClipboardHistoryItem, TextTemplate } from '../shared/contracts'
import type { ActiveApplicationContext } from '../shared/types/insertion'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const smokeTestMode = process.env.CURE_VOICER_SMOKE_TEST === '1'
const smokeTestUserData = process.env.CURE_VOICER_SMOKE_USER_DATA
if (smokeTestMode && smokeTestUserData && path.isAbsolute(smokeTestUserData)) {
  app.setPath('userData', smokeTestUserData)
}
const rendererPolicy = new RendererPolicy({
  rendererDirectory: path.join(currentDirectory, '../renderer'),
  allowedFiles: ['index.html', 'overlay.html'],
  developmentUrl: process.env.ELECTRON_RENDERER_URL
})
const defaultAccelerator = 'CommandOrControl+Shift+Space'
const defaultHoldKey: HoldKey =
  process.platform === 'darwin' ? 'right-option' : 'right-control'
const defaultShortcutBindings: Record<string, string> = {
  'selection.transform': 'CommandOrControl+Shift+R',
  'editor.open': 'CommandOrControl+Shift+E',
  'history.open': 'CommandOrControl+Shift+H',
  'dictation.cancel': 'CommandOrControl+Shift+Backspace',
  'insertion.repeat': 'CommandOrControl+Shift+I',
  'dictation.preset': 'CommandOrControl+Shift+P'
}
const hasSingleInstanceLock = app.requestSingleInstanceLock()
// Dictation starts from a global key while the settings window is hidden, so
// Chromium must allow the recorder's AudioContext without a renderer click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const applicationServices = createApplicationServices(currentDirectory)
const {
  asrEngine,
  dictation: dictationMachine,
  activeApplications,
  internalEditor,
  transformations,
  insertion,
  applicationActivator,
  selectedText,
  commandUi,
  integrations,
  voiceCommands,
  recording: recordingService,
  smartCorrection: smartCorrectionService
} = applicationServices

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
  insertionMode: 'keyboard',
  blockedApplicationIds: [],
  transformationPresetId: 'none',
  shortcutBindings: { ...defaultShortcutBindings },
  voiceCommands: {},
  integrationRules: [],
  historyEnabled: false,
  clipboardHistoryEnabled: false,
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
let vocabulary: string[] = []
let history: DictationHistoryItem[] = []
let templates: TextTemplate[] = []
let clipboardHistory: ClipboardHistoryItem[] = []
let localDatabase: LocalDatabase | null = null
let isQuitting = false
let applicationResourcesDisposed = false
let isProgrammaticOverlayMove = false
let overlayMoveSaveTimer: ReturnType<typeof setTimeout> | null = null
let overlayDragTimer: ReturnType<typeof setInterval> | null = null
let overlayDragSafetyTimer: ReturnType<typeof setTimeout> | null = null
let activeRecordingFinish: ReturnType<RecordingService['finish']> | null = null
let activeRecordingAbortController: AbortController | null = null
const activeApplicationByOperation = new Map<string, Awaited<ReturnType<typeof activeApplications.getActiveApplication>>>()
let latestEditorInput: InternalEditorDocumentInput | null = null
let overlayHiddenUntilRecording = false
let keyboardHookRunning = false
let holdKeyPressed = false
let activeHoldKeyCode: number = UiohookKey.CtrlRight
let hotkeyCaptureActive = false
let hotkeyCaptureSafetyTimer: ReturnType<typeof setTimeout> | null = null
let shortcutConflicts: string[] = []

dictationMachine.subscribe((snapshot) => synchronizeLegacyPresentation(snapshot))
internalEditor.setHandler((input) => {
  latestEditorInput = input
  showWindow()
  mainWindow?.webContents.send(IPC.internalEditorText, {
    originalText: input.originalText,
    text: input.text,
    applicationName: input.activeApplication.applicationName,
    insertionMode: input.insertionMode
  })
})
commandUi.setListener(async (event, text) => {
  if (event === 'open-settings') {
    showWindow()
    return
  }
  if (event === 'clear-editor') {
    latestEditorInput = null
    mainWindow?.webContents.send(IPC.internalEditorText, {
      originalText: '',
      text: '',
      insertionMode: 'internal-editor'
    })
    return
  }
  if (event === 'undo-editor') {
    showWindow('editor')
    mainWindow?.webContents.send(IPC.editorCommand, 'undo')
    return
  }
  if (!text) return
  const note: DictationHistoryItem = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    text,
    durationMs: 0,
    latencyMs: 0,
    insertion: 'skipped'
  }
  history = [
    note,
    ...history
  ].slice(0, 100)
  await saveAppState()
})
commandUi.setConfirmationListener(async (commandId) => {
  const options: MessageBoxOptions = {
    type: 'warning',
    buttons: ['Отмена', 'Выполнить'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: 'Подтверждение голосовой команды',
    message:
      commandId === 'clear-editor'
        ? 'Очистить текст во встроенном редакторе?'
        : 'Выполнить потенциально опасную команду?'
  }
  const result = mainWindow
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options)
  return result.response === 1
})

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

  hardenWindow(window, rendererPolicy)

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
      preload: path.join(currentDirectory, '../preload/overlay.js'),
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

  hardenWindow(window, rendererPolicy)

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
      click: preferences.onboardingCompleted ? requestRecordingToggle : () => showWindow()
    },
    { type: 'separator' },
    { label: 'Настройки…', click: () => showWindow() },
    {
      label: 'Выйти',
      click: quitApplication
    }
  ])
}

function registerIpc(): void {
  ipcMain.handle(IPC.getAppInfo, (event): AppInfo => {
    assertSettingsSender(event)
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
      asrStatus: asrEngine.status,
      shortcutConflicts,
      templates,
      clipboardHistory
    }
  })

  ipcMain.handle(IPC.getOverlayInfo, (event) => {
    assertOverlaySender(event)
    return { preferences }
  })

  ipcMain.handle(IPC.setRecordingState, (event, state: RecordingState) => {
    assertSettingsSender(event)
    synchronizeLegacyRecordingEvent(recordingStateSchema.parse(state))
  })

  ipcMain.handle(IPC.beginDictation, async (event, sessionId: string) => {
    assertSettingsSender(event)
    const operationId = dictationSessionIdSchema.parse(sessionId)
    const snapshot = dictationMachine.snapshot
    if (!isTerminalDictationState(snapshot.state)) {
      throw new Error('Another dictation operation is already active')
    }
    dictationMachine.dispatch({ type: 'START', operationId })
    const activeApplication = await activeApplications.getActiveApplication().catch(() => ({
      platform:
        process.platform === 'darwin' || process.platform === 'win32'
          ? process.platform
          : 'unknown',
      capturedAt: new Date().toISOString()
    } as const))
    activeApplicationByOperation.set(operationId, activeApplication)
  })

  ipcMain.handle(IPC.cancelDictation, (event) => {
    assertSettingsSender(event)
    cancelActiveDictation('user-request')
  })

  ipcMain.handle(IPC.transformText, async (event, request: unknown) => {
    assertSettingsSender(event)
    const validated = transformTextRequestSchema.parse(request)
    const result = await transformations.transform(validated.text, {
      operationId: randomUUID(),
      presetId: validated.presetId,
      targetLanguage: validated.targetLanguage,
      customInstruction: validated.customInstruction,
      preferredTerms: vocabulary,
      allowExternalService: false
    })
    return {
      transformedText: result.transformedText,
      changed: result.changed,
      durationMs: result.durationMs
    }
  })

  ipcMain.handle(IPC.insertEditorText, async (event, request: unknown) => {
    assertSettingsSender(event)
    const { text } = textRequestSchema.parse(request)
    const editorInput = latestEditorInput
    if (!editorInput) throw new Error('There is no editor target to restore')
    await applicationActivator.activate(editorInput.activeApplication)
    return insertion.insertText(text, {
      operationId: randomUUID(),
      requestedMode:
        preferences.insertionMode === 'internal-editor'
          ? 'keyboard'
          : preferences.insertionMode,
      activeApplication: editorInput.activeApplication,
      originalText: editorInput.originalText,
      blockedApplicationIds: preferences.blockedApplicationIds,
      allowFallback: true
    })
  })

  ipcMain.on(IPC.setAudioLevel, (event, level: number) => {
    assertSettingsSender(event)
    const validatedLevel = audioLevelSchema.parse(level)
    overlayWindow?.webContents.send(
      IPC.overlayAudioLevel,
      validatedLevel
    )
  })

  ipcMain.handle(
    IPC.finishRecording,
    async (event, payload: PcmRecordingPayload) => {
      assertSettingsSender(event)
      const validatedPayload = pcmRecordingPayloadSchema.parse(payload)
      if (activeRecordingFinish) return activeRecordingFinish

      const operationId = prepareMachineForAudio(validatedPayload.sessionId)
      activeRecordingAbortController = new AbortController()
      const activeApplication = activeApplicationByOperation.get(operationId) ?? {
        platform:
          process.platform === 'darwin' || process.platform === 'win32'
            ? process.platform
            : 'unknown',
        capturedAt: new Date().toISOString()
      }
      const integration = await integrations.resolve(
        activeApplication,
        preferences.integrationRules
      )
      const insertionMode =
        preferences.insertionMode === 'keyboard'
          ? integration.strategy.preferredMode
          : preferences.insertionMode
      const isIde = integration.integrationId === 'vscode' || integration.integrationId === 'jetbrains'
      const transformationPresetId = integration.matchedRuleId
        ? integration.transformationPresetId ?? 'none'
        : isIde
          ? 'none'
          : preferences.transformationPresetId !== 'none'
            ? preferences.transformationPresetId
            : preferences.smartCorrectionEnabled
              ? integration.transformationPresetId ?? 'none'
              : 'none'

      activeRecordingFinish = recordingService.finish(validatedPayload, {
        autoPaste: preferences.autoPaste,
        keepRecording: preferences.keepRecordings,
        preferredTerms: vocabulary,
        smartCorrectionEnabled: preferences.smartCorrectionEnabled,
        signal: activeRecordingAbortController.signal,
        operationId,
        activeApplication,
        insertionMode,
        blockedApplicationIds: preferences.blockedApplicationIds,
        transformationPresetId
      })
      try {
        const result = await activeRecordingFinish
        completeMachineFromLegacyResult(operationId, result.transcript, result.insertion)
        if (result.transcript && preferences.historyEnabled) {
          history = [
            {
              id: randomUUID(),
              createdAt: new Date().toISOString(),
              text: result.transcript,
              durationMs: validatedPayload.durationMs,
              latencyMs: result.latencyMs,
              insertion: result.insertion
            },
            ...history
          ].slice(0, 100)
          await saveAppState()
        }
        if (
          result.transcript &&
          result.insertion === 'clipboard' &&
          preferences.clipboardHistoryEnabled
        ) {
          await addClipboardHistoryItem(result.transcript, activeApplication)
        }
        return result
      } catch (error) {
        failMachineOperation(operationId, error)
        throw error
      } finally {
        activeRecordingFinish = null
        activeRecordingAbortController = null
        activeApplicationByOperation.delete(operationId)
      }
    }
  )

  ipcMain.handle(
    IPC.setOverlayPlacement,
    async (event, mode: OverlayPlacementMode) => {
      assertSettingsSender(event)
      const validatedMode = overlayPlacementModeSchema.parse(mode)
      overlayPlacement = { mode: validatedMode }
      await saveOverlayPlacement()
      positionOverlay()
      mainWindow?.webContents.send(IPC.overlayPlacementChanged, overlayPlacement)
      return overlayPlacement
    }
  )

  ipcMain.handle(
    IPC.updatePreferences,
    async (event, patch: Partial<AppPreferences>) => {
      assertSettingsSender(event)
      preferences = await applyPreferencePatch(legacyPreferencesPatchSchema.parse(patch))
      applyVoiceCommandPreferences()
      clipboardHistory = preferences.clipboardHistoryEnabled
        ? localDatabase?.listClipboardHistory(preferences.clipboardRetentionDays) ?? []
        : []
      await saveAppState()
      overlayWindow?.webContents.send(IPC.overlayPreferencesChanged, preferences)
      updateOverlayState(currentState)
      return preferences
    }
  )

  ipcMain.handle(IPC.requestGlobalInputAccess, (event) => {
    assertSettingsSender(event)
    if (process.platform !== 'darwin') return true
    systemPreferences.isTrustedAccessibilityClient(true)
    return isGlobalInputAvailable()
  })

  ipcMain.handle(IPC.openSystemSettings, async (event, kind: unknown) => {
    assertSettingsSender(event)
    const validatedKind = permissionSettingsKindSchema.parse(kind)
    const target =
      process.platform === 'darwin'
        ? validatedKind === 'microphone'
          ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
          : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        : validatedKind === 'microphone'
          ? 'ms-settings:privacy-microphone'
          : 'ms-settings:easeofaccess'
    await shell.openExternal(target)
  })

  ipcMain.handle(IPC.completeOnboarding, async (event) => {
    assertSettingsSender(event)
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
    assertSettingsSender(event)
    setHotkeyCapture(booleanValueSchema.parse(active))
    return isGlobalInputAvailable()
  })

  ipcMain.handle(IPC.addVocabularyTerm, async (event, rawTerm: string) => {
    assertSettingsSender(event)
    const term = sanitizeVocabularyTerm(vocabularyTermSchema.parse(rawTerm))
    if (!vocabulary.some((item) => item.localeCompare(term, undefined, { sensitivity: 'accent' }) === 0)) {
      vocabulary = [...vocabulary, term].sort((left, right) => left.localeCompare(right))
      await saveAppState()
    }
    return vocabulary
  })

  ipcMain.handle(IPC.removeVocabularyTerm, async (event, rawTerm: string) => {
    assertSettingsSender(event)
    const term = vocabularyTermSchema.parse(rawTerm)
    vocabulary = vocabulary.filter((item) => item !== term)
    await saveAppState()
    return vocabulary
  })

  ipcMain.handle(IPC.removeHistoryEntry, async (event, id: string) => {
    assertSettingsSender(event)
    const validatedId = historyIdSchema.parse(id)
    history = history.filter((item) => item.id !== validatedId)
    await saveAppState()
    return history
  })

  ipcMain.handle(IPC.clearHistory, async (event) => {
    assertSettingsSender(event)
    history = []
    await saveAppState()
  })

  ipcMain.handle(IPC.upsertTemplate, async (event, request: unknown) => {
    assertSettingsSender(event)
    const value = templateRequestSchema.parse(request)
    const existing = templates.find((item) => item.id === value.id)
    const now = new Date().toISOString()
    const template: TextTemplate = {
      ...value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    localDatabase?.upsertTemplate(template)
    templates = localDatabase?.listTemplates() ?? [template, ...templates]
    if (preferences.onboardingCompleted && !hotkeyCaptureActive) configureRecordingActivation(preferences)
    return templates
  })

  ipcMain.handle(IPC.removeTemplate, (event, id: unknown) => {
    assertSettingsSender(event)
    const validatedId = historyIdSchema.parse(id)
    localDatabase?.removeTemplate(validatedId)
    templates = templates.filter((item) => item.id !== validatedId)
    if (preferences.onboardingCompleted && !hotkeyCaptureActive) configureRecordingActivation(preferences)
    return templates
  })

  ipcMain.handle(IPC.clearClipboardHistory, (event) => {
    assertSettingsSender(event)
    localDatabase?.clearClipboardHistory()
    clipboardHistory = []
  })

  ipcMain.handle(IPC.exportSettings, async (event) => {
    assertSettingsSender(event)
    const options: Electron.SaveDialogOptions = {
      title: 'Экспорт настроек Cure Voicer',
      defaultPath: 'cure-voicer-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      preferences,
      overlayPlacement,
      vocabulary,
      templates
    }, null, 2), { mode: 0o600 })
    return true
  })

  ipcMain.handle(IPC.importSettings, async (event) => {
    assertSettingsSender(event)
    const options: Electron.OpenDialogOptions = {
      title: 'Импорт настроек Cure Voicer',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return null
    const imported = JSON.parse(await readFile(filePath, 'utf8')) as unknown
    if (!imported || typeof imported !== 'object' || !('preferences' in imported)) {
      throw new Error('Invalid Cure Voicer settings file')
    }
    preferences = await applyPreferencePatch(
      legacyPreferencesPatchSchema.parse(imported.preferences)
    )
    if ('vocabulary' in imported && Array.isArray(imported.vocabulary)) {
      vocabulary = imported.vocabulary
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 500)
    }
    if ('templates' in imported && Array.isArray(imported.templates)) {
      for (const candidate of imported.templates.slice(0, 500)) {
        const parsed = templateRequestSchema.safeParse(candidate)
        if (!parsed.success) continue
        const existing = templates.find((item) => item.id === parsed.data.id)
        const now = new Date().toISOString()
        localDatabase?.upsertTemplate({
          ...parsed.data,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        })
      }
      templates = localDatabase?.listTemplates() ?? templates
    }
    applyVoiceCommandPreferences()
    await saveAppState()
    overlayWindow?.webContents.send(IPC.overlayPreferencesChanged, preferences)
    return preferences
  })

  ipcMain.handle(IPC.copyText, async (event, text: string) => {
    assertSettingsSender(event)
    const validatedText = copyTextSchema.parse(text)
    clipboard.writeText(validatedText)
    if (preferences.clipboardHistoryEnabled) {
      const activeApplication = await activeApplications.getActiveApplication().catch(() => undefined)
      await addClipboardHistoryItem(validatedText, activeApplication)
    }
  })

  ipcMain.handle(IPC.prepareAsr, async (event) => {
    assertSettingsSender(event)
    await asrEngine.prepare?.()
    return asrEngine.status
  })

  ipcMain.handle(IPC.prepareSmartCorrection, async (event) => {
    assertSettingsSender(event)
    return smartCorrectionService.prepare()
  })

  ipcMain.on(IPC.beginOverlayDrag, (event) => {
    assertOverlaySender(event)
    beginOverlayDrag()
  })

  ipcMain.on(IPC.endOverlayDrag, (event) => {
    assertOverlaySender(event)
    endOverlayDrag()
  })

  ipcMain.on(IPC.showOverlayMenu, (event) => {
    assertOverlaySender(event)
    showOverlayContextMenu()
  })
}

function assertTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): void {
  const senderUrl = event.senderFrame?.url
  if (!senderUrl || !isTrustedRendererUrl(senderUrl)) {
    throw new Error('Rejected IPC request from an untrusted renderer')
  }
}

function assertSettingsSender(event: IpcMainInvokeEvent | IpcMainEvent): void {
  assertRendererRole(event, 'settings')
}

function assertOverlaySender(event: IpcMainInvokeEvent | IpcMainEvent): void {
  assertRendererRole(event, 'overlay')
}

function assertRendererRole(
  event: IpcMainInvokeEvent | IpcMainEvent,
  role: 'settings' | 'overlay'
): void {
  assertTrustedSender(event)
  const senderUrl = new URL(event.senderFrame?.url ?? '')
  const expectedPath = role === 'settings' ? '/index.html' : '/overlay.html'
  const matchesDevelopmentSettings =
    role === 'settings' && Boolean(process.env.ELECTRON_RENDERER_URL) && senderUrl.pathname === '/'
  if (!senderUrl.pathname.endsWith(expectedPath) && !matchesDevelopmentSettings) {
    throw new Error(`Rejected ${role} capability from another renderer`)
  }
}

function isTrustedRendererUrl(url: string): boolean {
  return rendererPolicy.isTrustedUrl(url)
}

function synchronizeLegacyRecordingEvent(state: RecordingState): void {
  const snapshot = dictationMachine.snapshot

  if (state === 'starting') {
    if (snapshot.state === 'starting') return
    if (isTerminalDictationState(snapshot.state)) {
      dictationMachine.dispatch({ type: 'START', operationId: randomUUID() })
    }
    return
  }

  const operationId = snapshot.operationId
  if (!operationId) return

  if (state === 'recording' && snapshot.state === 'starting') {
    dictationMachine.dispatch({ type: 'CAPTURE_READY', operationId })
    return
  }

  if (
    state === 'transcribing' &&
    (snapshot.state === 'recording' || snapshot.state === 'paused')
  ) {
    dictationMachine.dispatch({ type: 'STOP', operationId })
    return
  }

  if (state === 'error' && isActiveDictationState(snapshot.state)) {
    activeRecordingAbortController?.abort()
    dictationMachine.dispatch({
      type: 'FAIL',
      operationId,
      code: 'LEGACY_RENDERER_ERROR',
      recoverable: true
    })
    return
  }

  if (state === 'idle') {
    if (isActiveDictationState(snapshot.state)) {
      activeRecordingAbortController?.abort()
      dictationMachine.dispatch({
        type: 'CANCEL',
        operationId,
        reason: 'renderer-reset'
      })
    }
    const terminal = dictationMachine.snapshot
    if (terminal.operationId && terminal.state !== 'idle') {
      dictationMachine.dispatch({
        type: 'RESET',
        operationId: terminal.operationId
      })
    }
  }
}

function prepareMachineForAudio(sessionId: string): string {
  let snapshot = dictationMachine.snapshot
  if (isTerminalDictationState(snapshot.state)) {
    const operationId = sessionId
    dictationMachine.dispatch({ type: 'START', operationId })
    dictationMachine.dispatch({ type: 'CAPTURE_READY', operationId })
    dictationMachine.dispatch({ type: 'STOP', operationId })
    snapshot = dictationMachine.snapshot
  }

  const operationId = snapshot.operationId
  if (!operationId) throw new Error('Dictation operation is missing')
  if (operationId !== sessionId) throw new Error('Audio belongs to a stale dictation session')
  if (snapshot.state === 'processing') {
    dictationMachine.dispatch({ type: 'AUDIO_READY', operationId })
  }
  if (dictationMachine.snapshot.state !== 'recognizing') {
    throw new Error(`Audio cannot be processed in state ${dictationMachine.snapshot.state}`)
  }
  return operationId
}

function completeMachineFromLegacyResult(
  operationId: string,
  transcript: string,
  insertionStatus: 'pasted' | 'clipboard' | 'skipped'
): void {
  if (!isCurrentMachineOperation(operationId, 'recognizing')) return
  dictationMachine.dispatch({
    type: 'TRANSCRIPTION_READY',
    operationId,
    text: transcript
  })

  if (!transcript || insertionStatus === 'skipped') {
    dictationMachine.dispatch({ type: 'COMPLETE', operationId })
    return
  }

  dictationMachine.dispatch({ type: 'INSERT', operationId })
  const outcome = insertionStatus === 'pasted' ? 'inserted' : 'copied'
  const result: InsertionResult = {
    operationId,
    providerId: 'legacy-clipboard',
    outcome,
    usedFallback: true,
    attempts: [
      {
        providerId: 'legacy-clipboard',
        outcome,
        durationMs: 0
      }
    ]
  }
  dictationMachine.dispatch({ type: 'INSERTION_COMPLETE', operationId, result })
}

function failMachineOperation(operationId: string, error: unknown): void {
  const snapshot = dictationMachine.snapshot
  if (snapshot.operationId !== operationId || !isActiveDictationState(snapshot.state)) return
  dictationMachine.dispatch({
    type: 'FAIL',
    operationId,
    code: errorCodeFor(error),
    recoverable: true
  })
}

function cancelActiveDictation(reason: string): void {
  activeRecordingAbortController?.abort()
  const snapshot = dictationMachine.snapshot
  if (!snapshot.operationId || !isActiveDictationState(snapshot.state)) return
  dictationMachine.dispatch({
    type: 'CANCEL',
    operationId: snapshot.operationId,
    reason
  })
}

function isCurrentMachineOperation(operationId: string, state: DictationState): boolean {
  const snapshot = dictationMachine.snapshot
  return snapshot.operationId === operationId && snapshot.state === state
}

function isTerminalDictationState(state: DictationState): boolean {
  return state === 'idle' || state === 'completed' || state === 'error' || state === 'cancelled'
}

function isActiveDictationState(state: DictationState): boolean {
  return !isTerminalDictationState(state)
}

function synchronizeLegacyPresentation(snapshot: Readonly<DictationSnapshot>): void {
  const nextState: RecordingState =
    snapshot.state === 'idle' ||
    snapshot.state === 'completed' ||
    snapshot.state === 'cancelled'
      ? 'idle'
      : snapshot.state === 'starting'
        ? 'starting'
        : snapshot.state === 'recording' || snapshot.state === 'paused'
          ? 'recording'
          : snapshot.state === 'error'
            ? 'error'
            : 'transcribing'

  currentState = nextState
  rebuildTrayMenu()
  updateOverlayState(nextState)
}

function errorCodeFor(error: unknown): string {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return 'DICTATION_PROCESSING_FAILED'
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
  shortcutConflicts = []
  stopKeyboardHook()

  if (nextPreferences.activationMode === 'hold') {
    if (
      process.platform === 'darwin' &&
      !systemPreferences.isTrustedAccessibilityClient(false)
    ) {
      registerSecondaryShortcuts(nextPreferences)
      return
    }
    activeHoldKeyCode = holdKeyCode(nextPreferences.holdKey)
    uIOhook.on('keydown', handleGlobalKeyDown)
    uIOhook.on('keyup', handleGlobalKeyUp)
    uIOhook.start()
    keyboardHookRunning = true
    registerSecondaryShortcuts(nextPreferences)
    return
  }

  if (!globalShortcut.register(nextPreferences.accelerator, requestRecordingToggle)) {
    throw new Error('Эта горячая клавиша уже занята другой программой')
  }
  registerSecondaryShortcuts(nextPreferences)
}

function registerSecondaryShortcuts(nextPreferences: AppPreferences): void {
  const actions: Record<string, () => void> = {
    'selection.transform': () => {
      void processSelectedText().catch((error) => {
        console.warn('Selected text processing failed', error)
      })
    },
    'editor.open': () => showWindow('editor'),
    'history.open': () => showWindow('history'),
    'dictation.cancel': () => cancelActiveDictation('shortcut'),
    'insertion.repeat': () => {
      void repeatLastInsertion().catch((error) => {
        console.warn('Could not repeat the last insertion', error)
      })
    },
    'dictation.preset': () => sendRecordingCommand('start')
  }
  for (const [actionId, accelerator] of Object.entries(nextPreferences.shortcutBindings)) {
    const callback = actions[actionId]
    if (callback && accelerator) registerOptionalShortcut(accelerator, callback)
  }
  for (const rule of nextPreferences.integrationRules) {
    if (!rule.enabled || !rule.shortcut) continue
    registerOptionalShortcut(rule.shortcut, () => {
      void processSelectedText(rule.id).catch((error) => {
        console.warn(`Integration shortcut failed: ${rule.id}`, error)
      })
    })
  }
  for (const template of templates) {
    if (!template.pinned || !template.shortcut) continue
    registerOptionalShortcut(template.shortcut, () => {
      void insertTemplate(template).catch((error) => {
        console.warn(`Template shortcut failed: ${template.id}`, error)
      })
    })
  }
}

async function repeatLastInsertion(): Promise<void> {
  const text = history.find((item) => item.text.trim())?.text
  if (!text) throw new Error('There is no previous text to insert')
  const activeApplication = await activeApplications.getActiveApplication()
  await insertion.insertText(text, {
    operationId: randomUUID(),
    requestedMode:
      preferences.insertionMode === 'internal-editor'
        ? 'keyboard'
        : preferences.insertionMode,
    activeApplication,
    originalText: text,
    blockedApplicationIds: preferences.blockedApplicationIds,
    allowFallback: true
  })
}

async function insertTemplate(template: TextTemplate): Promise<void> {
  const activeApplication = await activeApplications.getActiveApplication()
  const resolution = await integrations.resolve(activeApplication, preferences.integrationRules)
  await insertion.insertText(template.text, {
    operationId: randomUUID(),
    requestedMode: resolution.strategy.preferredMode,
    activeApplication,
    originalText: template.text,
    blockedApplicationIds: preferences.blockedApplicationIds,
    allowFallback: true
  })
}

function applyVoiceCommandPreferences(): void {
  for (const [commandId, configuration] of Object.entries(preferences.voiceCommands)) {
    try {
      voiceCommands.configure(commandId, configuration)
    } catch (error) {
      console.warn(`Ignored unknown voice command preference: ${commandId}`, error)
    }
  }
}

function registerOptionalShortcut(accelerator: string, callback: () => void): void {
  if (!globalShortcut.register(accelerator, callback)) {
    shortcutConflicts.push(accelerator)
    console.warn(`Optional shortcut is unavailable: ${accelerator}`)
  }
}

async function processSelectedText(requiredRuleId?: string): Promise<void> {
  const activeApplication = await activeApplications.getActiveApplication()
  const integration = await integrations.resolve(
    activeApplication,
    preferences.integrationRules
  )
  if (requiredRuleId && integration.matchedRuleId !== requiredRuleId) return
  if (integration.strategy.blockReason) {
    throw new Error(integration.strategy.blockReason)
  }
  const presetId =
    integration.matchedRuleId && integration.transformationPresetId
      ? integration.transformationPresetId
      : preferences.transformationPresetId !== 'none'
      ? preferences.transformationPresetId
      : smartCorrectionService.status.state === 'ready'
        ? 'written-style'
        : 'remove-fillers'
  await selectedText.process(
    {
      operationId: randomUUID(),
      activeApplication
    },
    async (text) =>
      transformations
        .transform(text, {
          operationId: randomUUID(),
          presetId,
          activeApplication,
          preferredTerms: vocabulary,
          allowExternalService: false
        })
        .then((result) => result.transformedText)
  )
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
    { label: 'Настройки…', click: () => showWindow() },
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

function isInsertionMode(value: unknown): value is AppPreferences['insertionMode'] {
  return [
    'keyboard',
    'accessibility',
    'clipboard-safe',
    'clipboard-only',
    'internal-editor'
  ].includes(String(value))
}

function isTheme(value: unknown): value is AppPreferences['theme'] {
  return ['system', 'light', 'dark'].includes(String(value))
}

function isLocale(value: unknown): value is AppPreferences['locale'] {
  return ['system', 'ru', 'en'].includes(String(value))
}

async function loadAppState(): Promise<void> {
  try {
    await mkdir(app.getPath('userData'), { recursive: true })
    localDatabase = new LocalDatabase(databaseFilePath())
    const databaseState = localDatabase.loadApplicationState()
    let state: Partial<PersistedAppState> = databaseState ?? {}
    if (!databaseState) {
      const contents = await readFile(settingsFilePath(), 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return ''
        throw error
      })
      if (contents) state = JSON.parse(contents) as Partial<PersistedAppState>
    }
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
        insertionMode: isInsertionMode(stored.insertionMode)
          ? stored.insertionMode
          : 'keyboard',
        blockedApplicationIds: Array.isArray(stored.blockedApplicationIds)
          ? stored.blockedApplicationIds
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter(Boolean)
              .slice(0, 500)
          : [],
        transformationPresetId:
          typeof stored.transformationPresetId === 'string' &&
          stored.transformationPresetId.trim().length > 0 &&
          stored.transformationPresetId.length <= 100
            ? stored.transformationPresetId
            : 'none',
        shortcutBindings: isStringRecord(stored.shortcutBindings)
          ? { ...defaultShortcutBindings, ...stored.shortcutBindings }
          : { ...defaultShortcutBindings },
        voiceCommands: isVoiceCommandPreferences(stored.voiceCommands)
          ? stored.voiceCommands
          : {},
        integrationRules: isIntegrationRules(stored.integrationRules)
          ? stored.integrationRules
          : [],
        historyEnabled:
          typeof stored.historyEnabled === 'boolean' ? stored.historyEnabled : false,
        clipboardHistoryEnabled:
          typeof stored.clipboardHistoryEnabled === 'boolean'
            ? stored.clipboardHistoryEnabled
            : false,
        clipboardRetentionDays:
          typeof stored.clipboardRetentionDays === 'number' &&
          Number.isInteger(stored.clipboardRetentionDays) &&
          stored.clipboardRetentionDays >= 1 &&
          stored.clipboardRetentionDays <= 365
            ? stored.clipboardRetentionDays
            : 7,
        theme: isTheme(stored.theme) ? stored.theme : 'system',
        locale: isLocale(stored.locale) ? stored.locale : 'system',
        keepRecordings:
          typeof stored.keepRecordings === 'boolean' ? stored.keepRecordings : false,
        showOverlayWhenIdle:
          typeof stored.showOverlayWhenIdle === 'boolean' ? stored.showOverlayWhenIdle : true,
        overlayMotion: isOverlayMotion(stored.overlayMotion)
          ? stored.overlayMotion
          : 'balanced',
        smartCorrectionEnabled:
          typeof stored.smartCorrectionEnabled === 'boolean'
            ? stored.smartCorrectionEnabled
            : false,
        autoStopSilenceMs:
          typeof stored.autoStopSilenceMs === 'number' &&
          Number.isInteger(stored.autoStopSilenceMs) &&
          stored.autoStopSilenceMs >= 0 &&
          stored.autoStopSilenceMs <= 30_000
            ? stored.autoStopSilenceMs
            : 0,
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
    localDatabase.importLegacyOnce({ overlayPlacement, preferences, vocabulary, history })
    templates = localDatabase.listTemplates()
    clipboardHistory = preferences.clipboardHistoryEnabled
      ? localDatabase.listClipboardHistory(preferences.clipboardRetentionDays)
      : []
  } catch (error) {
    console.warn('Could not load local application state', error)
  }
}

async function saveOverlayPlacement(): Promise<void> {
  await saveAppState()
}

async function saveAppState(): Promise<void> {
  const state: PersistedAppState = { overlayPlacement, preferences, vocabulary, history }
  if (!localDatabase) {
    await mkdir(app.getPath('userData'), { recursive: true })
    localDatabase = new LocalDatabase(databaseFilePath())
  }
  localDatabase.saveApplicationState(state)
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
    'historyEnabled',
    'clipboardHistoryEnabled',
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
  if (patch.insertionMode !== undefined) {
    if (!isInsertionMode(patch.insertionMode)) throw new Error('Invalid insertion mode')
    next.insertionMode = patch.insertionMode
  }
  if (patch.blockedApplicationIds !== undefined) {
    next.blockedApplicationIds = patch.blockedApplicationIds
  }
  if (patch.transformationPresetId !== undefined) {
    next.transformationPresetId = patch.transformationPresetId
  }
  if (patch.shortcutBindings !== undefined) {
    next.shortcutBindings = patch.shortcutBindings
  }
  if (patch.voiceCommands !== undefined) {
    next.voiceCommands = patch.voiceCommands
  }
  if (patch.integrationRules !== undefined) {
    next.integrationRules = patch.integrationRules
  }
  if (patch.clipboardRetentionDays !== undefined) {
    if (!Number.isInteger(patch.clipboardRetentionDays) || patch.clipboardRetentionDays < 1 || patch.clipboardRetentionDays > 365) {
      throw new Error('Invalid clipboard retention period')
    }
    next.clipboardRetentionDays = patch.clipboardRetentionDays
  }
  if (patch.theme !== undefined) {
    if (!isTheme(patch.theme)) throw new Error('Invalid theme')
    next.theme = patch.theme
  }
  if (patch.locale !== undefined) {
    if (!isLocale(patch.locale)) throw new Error('Invalid locale')
    next.locale = patch.locale
  }
  if (patch.autoStopSilenceMs !== undefined) {
    if (
      !Number.isInteger(patch.autoStopSilenceMs) ||
      patch.autoStopSilenceMs < 0 ||
      patch.autoStopSilenceMs > 30_000
    ) {
      throw new Error('Invalid auto-stop silence duration')
    }
    next.autoStopSilenceMs = patch.autoStopSilenceMs
  }

  if (next.launchAtLogin !== preferences.launchAtLogin) {
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin })
  }

  const activationChanged =
    next.activationMode !== preferences.activationMode ||
    next.accelerator !== preferences.accelerator ||
    next.holdKey !== preferences.holdKey ||
    next.shortcutBindings !== preferences.shortcutBindings ||
    next.integrationRules !== preferences.integrationRules
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

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Object.entries(value).every(
      ([key, entry]) => key.length <= 100 && typeof entry === 'string' && entry.length <= 100
    )
  )
}

function isVoiceCommandPreferences(
  value: unknown
): value is AppPreferences['voiceCommands'] {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Object.values(value).every(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        'enabled' in entry &&
        typeof entry.enabled === 'boolean' &&
        'phrases' in entry &&
        Array.isArray(entry.phrases) &&
        entry.phrases.every((phrase: unknown) => typeof phrase === 'string')
    )
  )
}

function isIntegrationRules(value: unknown): value is AppPreferences['integrationRules'] {
  return Boolean(
    Array.isArray(value) &&
    value.every(
      (rule) =>
        rule &&
        typeof rule === 'object' &&
        'id' in rule &&
        typeof rule.id === 'string' &&
        'match' in rule &&
        typeof rule.match === 'string' &&
        'enabled' in rule &&
        typeof rule.enabled === 'boolean' &&
        'blocked' in rule &&
        typeof rule.blocked === 'boolean'
    )
  )
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

function databaseFilePath(): string {
  return path.join(app.getPath('userData'), 'cure-voicer.sqlite3')
}

async function addClipboardHistoryItem(
  text: string,
  activeApplication?: ActiveApplicationContext
): Promise<void> {
  if (!preferences.clipboardHistoryEnabled || isPotentiallySensitiveText(text)) return
  if (activeApplication?.isSecureField) return
  const identities = [
    activeApplication?.applicationId,
    activeApplication?.applicationName,
    activeApplication?.executablePath
  ].filter((value): value is string => Boolean(value))
  if (
    identities.some((identity) =>
      preferences.blockedApplicationIds.some(
        (blocked) => blocked.toLocaleLowerCase() === identity.toLocaleLowerCase()
      )
    )
  ) return
  const item: ClipboardHistoryItem = {
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    applicationId: activeApplication?.applicationId ?? activeApplication?.applicationName
  }
  localDatabase?.addClipboardItem(item)
  clipboardHistory = localDatabase?.listClipboardHistory(preferences.clipboardRetentionDays) ?? [item, ...clipboardHistory].slice(0, 100)
}

function showWindow(pane?: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const replacement = createWindow()
    mainWindow = replacement
    replacement.once('ready-to-show', () => {
      if (replacement.isDestroyed()) return
      replacement.show()
      replacement.focus()
      if (pane) replacement.webContents.send(IPC.settingsNavigate, pane)
    })
    return
  }

  const window = mainWindow
  if (window.webContents.isLoadingMainFrame()) {
    window.once('ready-to-show', () => {
      if (window.isDestroyed()) return
      window.show()
      window.focus()
      if (pane) window.webContents.send(IPC.settingsNavigate, pane)
    })
    return
  }

  window.show()
  window.focus()
  if (pane) window.webContents.send(IPC.settingsNavigate, pane)
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
  cancelActiveDictation('application-quit')
  if (hotkeyCaptureSafetyTimer) clearTimeout(hotkeyCaptureSafetyTimer)
  if (overlayMoveSaveTimer) clearTimeout(overlayMoveSaveTimer)
  hotkeyCaptureSafetyTimer = null
  overlayMoveSaveTimer = null
  globalShortcut.unregisterAll()
  stopKeyboardHook()
  endOverlayDrag()
  asrEngine.dispose?.()
  smartCorrectionService.dispose()
  localDatabase?.close()
  localDatabase = null
}

if (!hasSingleInstanceLock) app.quit()

registerApplicationLifecycle({
  start: async () => {
    if (!hasSingleInstanceLock) return
    if (process.platform === 'win32') app.setAppUserModelId('com.curevoicer.desktop')
    if (process.platform === 'darwin') app.dock?.hide()
    await loadAppState()
    applyVoiceCommandPreferences()

    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback, details) => {
        if (permission !== 'media' || !('mediaTypes' in details)) {
          callback(false)
          return
        }

        const mediaTypes = details.mediaTypes ?? []
        const isAudioOnly = mediaTypes.every((type) => type === 'audio')
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

    if (smokeTestMode) {
      await Promise.all([
        waitForRendererLoad(mainWindow),
        waitForRendererLoad(overlayWindow)
      ])
      console.info('CURE_VOICER_SMOKE_OK')
      quitApplication()
      return
    }

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
  },
  secondInstance: () => {
    // The tray app does not open settings for repeated launches.
  },
  beforeQuit: () => {
    isQuitting = true
  },
  willQuit: disposeApplicationResources,
  windowAllClosed: () => {
    // Tray apps intentionally stay alive on both desktop platforms.
  },
  fatal: (error) => {
    console.error('Cure Voicer failed to start', error)
    isQuitting = true
    app.exit(1)
  }
})

function waitForRendererLoad(window: BrowserWindow): Promise<void> {
  if (!window.webContents.isLoadingMainFrame()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    window.webContents.once('did-finish-load', () => resolve())
    window.webContents.once('did-fail-load', (_event, code, description) => {
      reject(new Error(`Renderer failed to load (${code}): ${description}`))
    })
  })
}
