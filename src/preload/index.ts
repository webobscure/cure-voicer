import { contextBridge, ipcRenderer } from 'electron'
import type {
  AsrStatus,
  AppPreferences,
  CureVoicerApi,
  RecordingCommand,
  OverlayPlacement,
  OverlayPlacementMode,
  PermissionSettingsKind,
  PcmRecordingPayload,
  RecordingState,
  SmartCorrectionStatus,
  InternalEditorPayload,
  EditorCommand
} from '../shared/contracts'

// A sandboxed preload cannot require a Rollup-generated local shared chunk.
// Keep this runtime table self-contained; compile-time API types still come from
// the shared contract and IPC handlers validate every payload in main.
const IPC = {
  getAppInfo: 'app:get-info', setRecordingState: 'recording:set-state', beginDictation: 'recording:begin',
  setAudioLevel: 'recording:set-audio-level', finishRecording: 'recording:finish', cancelDictation: 'recording:cancel',
  recordingCommand: 'recording:command', overlayState: 'overlay:state', overlayAudioLevel: 'overlay:audio-level',
  setOverlayPlacement: 'overlay:set-placement', overlayPlacementChanged: 'overlay:placement-changed',
  beginOverlayDrag: 'overlay:begin-drag', endOverlayDrag: 'overlay:end-drag', showOverlayMenu: 'overlay:show-menu',
  overlayPreferencesChanged: 'overlay:preferences-changed', updatePreferences: 'settings:update-preferences',
  requestGlobalInputAccess: 'permissions:request-global-input', openSystemSettings: 'permissions:open-system-settings',
  completeOnboarding: 'onboarding:complete', setHotkeyCapture: 'settings:set-hotkey-capture',
  addVocabularyTerm: 'settings:add-vocabulary-term', removeVocabularyTerm: 'settings:remove-vocabulary-term',
  removeHistoryEntry: 'settings:remove-history-entry', clearHistory: 'settings:clear-history',
  upsertTemplate: 'templates:upsert', removeTemplate: 'templates:remove', clearClipboardHistory: 'clipboard-history:clear',
  exportSettings: 'settings:export', importSettings: 'settings:import', getDiagnosticReport: 'diagnostics:get-report',
  copyDiagnosticReport: 'diagnostics:copy-report', deleteAllUserData: 'settings:delete-all-user-data',
  copyText: 'settings:copy-text', prepareAsr: 'models:prepare-asr', prepareSmartCorrection: 'models:prepare-smart-correction',
  smartCorrectionStatusChanged: 'models:smart-correction-status-changed', asrStatusChanged: 'models:asr-status-changed',
  internalEditorText: 'editor:open-text', editorCommand: 'editor:command', transformText: 'editor:transform-text',
  insertEditorText: 'editor:insert-text', settingsNavigate: 'settings:navigate'
} as const

const api: CureVoicerApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  setRecordingState: (state: RecordingState) =>
    ipcRenderer.invoke(IPC.setRecordingState, state),
  beginDictation: (sessionId: string) =>
    ipcRenderer.invoke(IPC.beginDictation, sessionId),
  setAudioLevel: (level: number) => ipcRenderer.send(IPC.setAudioLevel, level),
  finishRecording: (payload: PcmRecordingPayload) =>
    ipcRenderer.invoke(IPC.finishRecording, payload),
  cancelDictation: () => ipcRenderer.invoke(IPC.cancelDictation),
  setOverlayPlacement: (mode: Exclude<OverlayPlacementMode, 'custom'>) =>
    ipcRenderer.invoke(IPC.setOverlayPlacement, mode),
  updatePreferences: (patch: Partial<AppPreferences>) =>
    ipcRenderer.invoke(IPC.updatePreferences, patch),
  requestGlobalInputAccess: () => ipcRenderer.invoke(IPC.requestGlobalInputAccess),
  openSystemSettings: (kind: PermissionSettingsKind) =>
    ipcRenderer.invoke(IPC.openSystemSettings, kind),
  completeOnboarding: () => ipcRenderer.invoke(IPC.completeOnboarding),
  setHotkeyCapture: (active: boolean) =>
    ipcRenderer.invoke(IPC.setHotkeyCapture, active),
  addVocabularyTerm: (term: string) => ipcRenderer.invoke(IPC.addVocabularyTerm, term),
  removeVocabularyTerm: (term: string) =>
    ipcRenderer.invoke(IPC.removeVocabularyTerm, term),
  removeHistoryEntry: (id: string) => ipcRenderer.invoke(IPC.removeHistoryEntry, id),
  clearHistory: () => ipcRenderer.invoke(IPC.clearHistory),
  upsertTemplate: (template) => ipcRenderer.invoke(IPC.upsertTemplate, template),
  removeTemplate: (id) => ipcRenderer.invoke(IPC.removeTemplate, id),
  clearClipboardHistory: () => ipcRenderer.invoke(IPC.clearClipboardHistory),
  exportSettings: () => ipcRenderer.invoke(IPC.exportSettings),
  importSettings: () => ipcRenderer.invoke(IPC.importSettings),
  getDiagnosticReport: () => ipcRenderer.invoke(IPC.getDiagnosticReport),
  copyDiagnosticReport: () => ipcRenderer.invoke(IPC.copyDiagnosticReport),
  deleteAllUserData: () => ipcRenderer.invoke(IPC.deleteAllUserData),
  copyText: (text: string) => ipcRenderer.invoke(IPC.copyText, text),
  prepareAsr: () => ipcRenderer.invoke(IPC.prepareAsr),
  prepareSmartCorrection: () => ipcRenderer.invoke(IPC.prepareSmartCorrection),
  beginOverlayDrag: () => ipcRenderer.send(IPC.beginOverlayDrag),
  endOverlayDrag: () => ipcRenderer.send(IPC.endOverlayDrag),
  showOverlayMenu: () => ipcRenderer.send(IPC.showOverlayMenu),
  onRecordingCommand: (callback: (command: RecordingCommand) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      command: RecordingCommand
    ): void => callback(command)
    ipcRenderer.on(IPC.recordingCommand, listener)
    return () => ipcRenderer.removeListener(IPC.recordingCommand, listener)
  },
  onOverlayState: (callback: (state: RecordingState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: RecordingState): void =>
      callback(state)
    ipcRenderer.on(IPC.overlayState, listener)
    return () => ipcRenderer.removeListener(IPC.overlayState, listener)
  },
  onOverlayAudioLevel: (callback: (level: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, level: number): void =>
      callback(level)
    ipcRenderer.on(IPC.overlayAudioLevel, listener)
    return () => ipcRenderer.removeListener(IPC.overlayAudioLevel, listener)
  },
  onOverlayPlacementChanged: (callback: (placement: OverlayPlacement) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      placement: OverlayPlacement
    ): void => callback(placement)
    ipcRenderer.on(IPC.overlayPlacementChanged, listener)
    return () => ipcRenderer.removeListener(IPC.overlayPlacementChanged, listener)
  },
  onOverlayPreferencesChanged: (callback: (preferences: AppPreferences) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      preferences: AppPreferences
    ): void => callback(preferences)
    ipcRenderer.on(IPC.overlayPreferencesChanged, listener)
    return () => ipcRenderer.removeListener(IPC.overlayPreferencesChanged, listener)
  },
  onSmartCorrectionStatusChanged: (
    callback: (status: SmartCorrectionStatus) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: SmartCorrectionStatus
    ): void => callback(status)
    ipcRenderer.on(IPC.smartCorrectionStatusChanged, listener)
    return () =>
      ipcRenderer.removeListener(IPC.smartCorrectionStatusChanged, listener)
  },
  onAsrStatusChanged: (callback: (status: AsrStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: AsrStatus): void =>
      callback(status)
    ipcRenderer.on(IPC.asrStatusChanged, listener)
    return () => ipcRenderer.removeListener(IPC.asrStatusChanged, listener)
  },
  onInternalEditorText: (callback: (payload: InternalEditorPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: InternalEditorPayload): void =>
      callback(payload)
    ipcRenderer.on(IPC.internalEditorText, listener)
    return () => ipcRenderer.removeListener(IPC.internalEditorText, listener)
  },
  onEditorCommand: (callback: (command: EditorCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: EditorCommand): void =>
      callback(command)
    ipcRenderer.on(IPC.editorCommand, listener)
    return () => ipcRenderer.removeListener(IPC.editorCommand, listener)
  },
  transformText: (request) => ipcRenderer.invoke(IPC.transformText, request),
  insertEditorText: (text) => ipcRenderer.invoke(IPC.insertEditorText, { text }),
  onSettingsNavigate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, pane: string): void => callback(pane)
    ipcRenderer.on(IPC.settingsNavigate, listener)
    return () => ipcRenderer.removeListener(IPC.settingsNavigate, listener)
  }
}

contextBridge.exposeInMainWorld('cureVoicer', api)
