export const IPC = {
  getAppInfo: 'app:get-info',
  getOverlayInfo: 'overlay:get-info',
  setRecordingState: 'recording:set-state',
  beginDictation: 'recording:begin',
  setAudioLevel: 'recording:set-audio-level',
  finishRecording: 'recording:finish',
  cancelDictation: 'recording:cancel',
  recordingCommand: 'recording:command',
  overlayState: 'overlay:state',
  overlayAudioLevel: 'overlay:audio-level',
  setOverlayPlacement: 'overlay:set-placement',
  overlayPlacementChanged: 'overlay:placement-changed',
  beginOverlayDrag: 'overlay:begin-drag',
  endOverlayDrag: 'overlay:end-drag',
  showOverlayMenu: 'overlay:show-menu',
  overlayPreferencesChanged: 'overlay:preferences-changed',
  updatePreferences: 'settings:update-preferences',
  requestGlobalInputAccess: 'permissions:request-global-input',
  openSystemSettings: 'permissions:open-system-settings',
  completeOnboarding: 'onboarding:complete',
  setHotkeyCapture: 'settings:set-hotkey-capture',
  addVocabularyTerm: 'settings:add-vocabulary-term',
  removeVocabularyTerm: 'settings:remove-vocabulary-term',
  removeHistoryEntry: 'settings:remove-history-entry',
  clearHistory: 'settings:clear-history',
  copyText: 'settings:copy-text',
  prepareAsr: 'models:prepare-asr',
  prepareSmartCorrection: 'models:prepare-smart-correction',
  smartCorrectionStatusChanged: 'models:smart-correction-status-changed',
  asrStatusChanged: 'models:asr-status-changed',
  internalEditorText: 'editor:open-text',
  editorCommand: 'editor:command',
  transformText: 'editor:transform-text',
  insertEditorText: 'editor:insert-text',
  settingsNavigate: 'settings:navigate'
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

export type OverlayMotion = 'calm' | 'balanced' | 'expressive'

export type RecordingActivationMode = 'toggle' | 'hold'

export type SmartCorrectionState =
  | 'not-downloaded'
  | 'downloaded'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error'

export interface SmartCorrectionStatus {
  state: SmartCorrectionState
  progress: number
  modelName: string
  modelSizeBytes: number
  error?: string
}

export interface AsrStatus {
  state: SmartCorrectionState
  progress: number
  engine: string
  modelName: string
  modelSizeBytes: number
  error?: string
}

export type HoldKey =
  | 'left-control'
  | 'right-control'
  | 'left-option'
  | 'right-option'
  | 'left-command'
  | 'right-command'
  | 'left-shift'
  | 'right-shift'
  | 'f6'
  | 'f7'
  | 'f8'
  | 'f9'
  | 'f10'
  | 'f11'
  | 'f12'

export type RecordingCommand = 'toggle' | 'start' | 'stop'

export type PermissionSettingsKind = 'microphone' | 'accessibility'

export interface AppPreferences {
  launchAtLogin: boolean
  activationMode: RecordingActivationMode
  accelerator: string
  holdKey: HoldKey
  microphoneId: string
  autoPaste: boolean
  insertionMode: import('./types/insertion').InsertionMode
  blockedApplicationIds: string[]
  transformationPresetId: string
  shortcutBindings: Record<string, string>
  voiceCommands: Record<string, { enabled: boolean; phrases: string[] }>
  keepRecordings: boolean
  showOverlayWhenIdle: boolean
  overlayMotion: OverlayMotion
  smartCorrectionEnabled: boolean
  autoStopSilenceMs: number
  onboardingCompleted: boolean
}

export interface DictationHistoryItem {
  id: string
  createdAt: string
  text: string
  durationMs: number
  latencyMs: number
  insertion: TextInsertionStatus
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  accelerator: string
  recordingsDirectory: string
  asrEngine: string
  overlayPlacement: OverlayPlacement
  preferences: AppPreferences
  globalInputAvailable: boolean
  vocabulary: string[]
  history: DictationHistoryItem[]
  smartCorrection: SmartCorrectionStatus
  asrStatus: AsrStatus
  shortcutConflicts: string[]
}

export interface OverlayInfo {
  preferences: AppPreferences
}

export interface PcmRecordingPayload {
  sessionId: string
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

export interface TransformTextRequest {
  text: string
  presetId: string
  targetLanguage?: string
  customInstruction?: string
}

export interface TransformTextResponse {
  transformedText: string
  changed: boolean
  durationMs: number
}

export interface InternalEditorPayload {
  originalText: string
  text: string
  applicationName?: string
  insertionMode: string
}

export type EditorCommand = 'undo'

export interface CureVoicerApi {
  getAppInfo(): Promise<AppInfo>
  setRecordingState(state: RecordingState): Promise<void>
  beginDictation(sessionId: string): Promise<void>
  setAudioLevel(level: number): void
  finishRecording(payload: PcmRecordingPayload): Promise<RecordingResult>
  cancelDictation(): Promise<void>
  setOverlayPlacement(mode: Exclude<OverlayPlacementMode, 'custom'>): Promise<OverlayPlacement>
  updatePreferences(patch: Partial<AppPreferences>): Promise<AppPreferences>
  requestGlobalInputAccess(): Promise<boolean>
  openSystemSettings(kind: PermissionSettingsKind): Promise<void>
  completeOnboarding(): Promise<AppPreferences>
  setHotkeyCapture(active: boolean): Promise<boolean>
  addVocabularyTerm(term: string): Promise<string[]>
  removeVocabularyTerm(term: string): Promise<string[]>
  removeHistoryEntry(id: string): Promise<DictationHistoryItem[]>
  clearHistory(): Promise<void>
  copyText(text: string): Promise<void>
  prepareAsr(): Promise<AsrStatus>
  prepareSmartCorrection(): Promise<SmartCorrectionStatus>
  beginOverlayDrag(): void
  endOverlayDrag(): void
  showOverlayMenu(): void
  onRecordingCommand(callback: (command: RecordingCommand) => void): () => void
  onOverlayState(callback: (state: RecordingState) => void): () => void
  onOverlayAudioLevel(callback: (level: number) => void): () => void
  onOverlayPlacementChanged(callback: (placement: OverlayPlacement) => void): () => void
  onOverlayPreferencesChanged(callback: (preferences: AppPreferences) => void): () => void
  onSmartCorrectionStatusChanged(
    callback: (status: SmartCorrectionStatus) => void
  ): () => void
  onAsrStatusChanged(callback: (status: AsrStatus) => void): () => void
  onInternalEditorText(callback: (payload: InternalEditorPayload) => void): () => void
  onEditorCommand(callback: (command: EditorCommand) => void): () => void
  transformText(request: TransformTextRequest): Promise<TransformTextResponse>
  insertEditorText(text: string): Promise<import('./types/insertion').InsertionResult>
  onSettingsNavigate(callback: (pane: string) => void): () => void
}

export interface CureVoicerOverlayApi {
  getOverlayInfo(): Promise<OverlayInfo>
  beginOverlayDrag(): void
  endOverlayDrag(): void
  showOverlayMenu(): void
  onOverlayState(callback: (state: RecordingState) => void): () => void
  onOverlayAudioLevel(callback: (level: number) => void): () => void
  onOverlayPreferencesChanged(callback: (preferences: AppPreferences) => void): () => void
}
