import { contextBridge, ipcRenderer } from 'electron'
import type {
  CureVoicerApi,
  OverlayPlacement,
  OverlayPlacementMode,
  PcmRecordingPayload,
  RecordingState
} from '../shared/contracts'
import { IPC } from '../shared/contracts'

const api: CureVoicerApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  setRecordingState: (state: RecordingState) =>
    ipcRenderer.invoke(IPC.setRecordingState, state),
  setAudioLevel: (level: number) => ipcRenderer.send(IPC.setAudioLevel, level),
  finishRecording: (payload: PcmRecordingPayload) =>
    ipcRenderer.invoke(IPC.finishRecording, payload),
  setOverlayPlacement: (mode: Exclude<OverlayPlacementMode, 'custom'>) =>
    ipcRenderer.invoke(IPC.setOverlayPlacement, mode),
  beginOverlayDrag: () => ipcRenderer.send(IPC.beginOverlayDrag),
  endOverlayDrag: () => ipcRenderer.send(IPC.endOverlayDrag),
  showOverlayMenu: () => ipcRenderer.send(IPC.showOverlayMenu),
  onToggleRequested: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.toggleRequested, listener)
    return () => ipcRenderer.removeListener(IPC.toggleRequested, listener)
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
  }
}

contextBridge.exposeInMainWorld('cureVoicer', api)
