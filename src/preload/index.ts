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
  SmartCorrectionStatus
} from '../shared/contracts'
import { IPC } from '../shared/contracts'

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
  }
}

contextBridge.exposeInMainWorld('cureVoicer', api)
