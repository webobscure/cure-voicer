export const IPC = {
  getAppInfo: 'app:get-info',
  setRecordingState: 'recording:set-state',
  setAudioLevel: 'recording:set-audio-level',
  finishRecording: 'recording:finish',
  toggleRequested: 'recording:toggle-requested',
  overlayState: 'overlay:state',
  overlayAudioLevel: 'overlay:audio-level',
  setOverlayPlacement: 'overlay:set-placement',
  overlayPlacementChanged: 'overlay:placement-changed',
  beginOverlayDrag: 'overlay:begin-drag',
  endOverlayDrag: 'overlay:end-drag',
  showOverlayMenu: 'overlay:show-menu'
} as const

export type RecordingState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'transcribing'
  | 'error'

export type OverlayPlacementMode =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom'

export interface OverlayPlacement {
  mode: OverlayPlacementMode
  x?: number
  y?: number
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  accelerator: string
  recordingsDirectory: string
  asrEngine: string
  overlayPlacement: OverlayPlacement
}

export interface PcmRecordingPayload {
  samples: Uint8Array
  sampleRate: 16000
  durationMs: number
}

export type TextInsertionStatus = 'pasted' | 'clipboard' | 'skipped'

export interface RecordingResult {
  recordingPath: string
  transcript: string
  engine: string
  latencyMs: number
  insertion: TextInsertionStatus
}

export interface CureVoicerApi {
  getAppInfo(): Promise<AppInfo>
  setRecordingState(state: RecordingState): Promise<void>
  setAudioLevel(level: number): void
  finishRecording(payload: PcmRecordingPayload): Promise<RecordingResult>
  setOverlayPlacement(mode: Exclude<OverlayPlacementMode, 'custom'>): Promise<OverlayPlacement>
  beginOverlayDrag(): void
  endOverlayDrag(): void
  showOverlayMenu(): void
  onToggleRequested(callback: () => void): () => void
  onOverlayState(callback: (state: RecordingState) => void): () => void
  onOverlayAudioLevel(callback: (level: number) => void): () => void
  onOverlayPlacementChanged(callback: (placement: OverlayPlacement) => void): () => void
}
