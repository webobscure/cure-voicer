import type {
  AppPreferences,
  AsrStatus,
  HoldKey,
  OverlayPlacement,
  RecordingState
} from '../../shared/contracts'

export interface MicrophoneOption {
  id: string
  label: string
  available: boolean
}

export interface CoreSettingsSnapshot {
  preferences: AppPreferences
  platform: NodeJS.Platform
  globalInputAvailable: boolean
  recordingState: RecordingState
  recordingDetail: string
  audioLevel: number
  microphones: readonly MicrophoneOption[]
  holdKeyCaptureActive: boolean
  holdKeyStatus: string
  asrStatus: AsrStatus
  overlayPlacement: OverlayPlacement
  overlayPlacementBusy: boolean
  error: string
}

export interface CoreSettingsActions {
  toggleRecording(): Promise<void>
  updatePreferences(patch: Partial<AppPreferences>): Promise<boolean>
  beginHoldKeyCapture(): Promise<void>
  cancelHoldKeyCapture(): Promise<void>
  setOverlayPlacement(mode: Exclude<OverlayPlacement['mode'], 'custom'>): Promise<void>
  restartOnboarding(): void
}

const initialPreferences: AppPreferences = {
  launchAtLogin: false,
  activationMode: 'hold',
  accelerator: 'CommandOrControl+Shift+Space',
  holdKey: 'right-option',
  microphoneId: '',
  autoPaste: true,
  insertionMode: 'keyboard',
  blockedApplicationIds: [],
  transformationPresetId: 'none',
  shortcutBindings: {},
  voiceCommands: {},
  integrationRules: [],
  historyEnabled: false,
  clipboardHistoryEnabled: false,
  cloudProcessingEnabled: false,
  automaticUpdatesEnabled: true,
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

const initialSnapshot: CoreSettingsSnapshot = {
  preferences: initialPreferences,
  platform: 'darwin',
  globalInputAvailable: true,
  recordingState: 'idle',
  recordingDetail: '',
  audioLevel: 0,
  microphones: [{ id: '', label: 'System', available: true }],
  holdKeyCaptureActive: false,
  holdKeyStatus: '',
  asrStatus: {
    state: 'loading',
    progress: 0,
    engine: 'Parakeet V3',
    modelName: 'Parakeet TDT 0.6B V3',
    modelSizeBytes: 0
  },
  overlayPlacement: { mode: 'bottom-center' },
  overlayPlacementBusy: false,
  error: ''
}

const noActions: CoreSettingsActions = {
  toggleRecording: async () => undefined,
  updatePreferences: async () => false,
  beginHoldKeyCapture: async () => undefined,
  cancelHoldKeyCapture: async () => undefined,
  setOverlayPlacement: async () => undefined,
  restartOnboarding: () => undefined
}

export class CoreSettingsController {
  private snapshot = initialSnapshot
  private actions = noActions
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): CoreSettingsSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  configure(actions: CoreSettingsActions): void {
    this.actions = actions
  }

  update(patch: Partial<CoreSettingsSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if (Object.keys(patch).every((key) => next[key as keyof CoreSettingsSnapshot] === this.snapshot[key as keyof CoreSettingsSnapshot])) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }

  toggleRecording = (): Promise<void> => this.actions.toggleRecording()
  updatePreferences = (patch: Partial<AppPreferences>): Promise<boolean> => this.actions.updatePreferences(patch)
  beginHoldKeyCapture = (): Promise<void> => this.actions.beginHoldKeyCapture()
  cancelHoldKeyCapture = (): Promise<void> => this.actions.cancelHoldKeyCapture()
  setOverlayPlacement = (mode: Exclude<OverlayPlacement['mode'], 'custom'>): Promise<void> => this.actions.setOverlayPlacement(mode)
  restartOnboarding = (): void => this.actions.restartOnboarding()
}

export function holdKeyGlyph(key: HoldKey, platform: NodeJS.Platform): string {
  if (key.includes('control')) return platform === 'darwin' ? '⌃' : 'Ctrl'
  if (key.includes('option')) return platform === 'darwin' ? '⌥' : 'Alt'
  if (key.includes('command')) return platform === 'darwin' ? '⌘' : 'Win'
  if (key.includes('shift')) return '⇧'
  return key.toUpperCase()
}

export const coreSettingsController = new CoreSettingsController()
