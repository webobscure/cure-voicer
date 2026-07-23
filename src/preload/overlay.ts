import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppPreferences,
  CureVoicerOverlayApi,
  RecordingState
} from '../shared/contracts'

const IPC = {
  getOverlayInfo: 'overlay:get-info',
  beginOverlayDrag: 'overlay:begin-drag',
  endOverlayDrag: 'overlay:end-drag',
  showOverlayMenu: 'overlay:show-menu',
  overlayState: 'overlay:state',
  overlayAudioLevel: 'overlay:audio-level',
  overlayPreferencesChanged: 'overlay:preferences-changed'
} as const

const api: CureVoicerOverlayApi = {
  getOverlayInfo: () => ipcRenderer.invoke(IPC.getOverlayInfo),
  beginOverlayDrag: () => ipcRenderer.send(IPC.beginOverlayDrag),
  endOverlayDrag: () => ipcRenderer.send(IPC.endOverlayDrag),
  showOverlayMenu: () => ipcRenderer.send(IPC.showOverlayMenu),
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
  onOverlayPreferencesChanged: (callback: (preferences: AppPreferences) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      preferences: AppPreferences
    ): void => callback(preferences)
    ipcRenderer.on(IPC.overlayPreferencesChanged, listener)
    return () => ipcRenderer.removeListener(IPC.overlayPreferencesChanged, listener)
  }
}

contextBridge.exposeInMainWorld('cureVoicerOverlay', api)
