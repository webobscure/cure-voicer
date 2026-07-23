import type {
  AsrStatus,
  RecordingState
} from '../../../shared/contracts'

export interface OnboardingSnapshot {
  visible: boolean
  firstRun: boolean
  step: number
  busy: boolean
  platform: NodeJS.Platform
  globalInputAvailable: boolean
  microphonePermission: 'unknown' | 'granted' | 'denied'
  holdKeyGlyph: string
  holdKeyLabel: string
  asrStatus: AsrStatus
  recordingState: RecordingState
  transcript: string
  permissionMessage?: string
}

export interface OnboardingActions {
  requestMicrophone(): Promise<void>
  requestAccessibility(): Promise<void>
  toggleRecording(): Promise<void>
  finish(): Promise<void>
}

const initialSnapshot: OnboardingSnapshot = {
  visible: false,
  firstRun: true,
  step: 0,
  busy: false,
  platform: 'darwin',
  globalInputAvailable: false,
  microphonePermission: 'unknown',
  holdKeyGlyph: '⌥',
  holdKeyLabel: 'Right Option',
  asrStatus: {
    state: 'loading',
    progress: 0,
    engine: 'Parakeet V3',
    modelName: 'Parakeet TDT 0.6B V3',
    modelSizeBytes: 0
  },
  recordingState: 'idle',
  transcript: ''
}

export class OnboardingController {
  private snapshot: OnboardingSnapshot = initialSnapshot
  private actions: OnboardingActions | null = null
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): OnboardingSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  configure(actions: OnboardingActions): void {
    this.actions = actions
  }

  show(firstRun = false): void {
    this.update({ visible: true, firstRun, step: 0, permissionMessage: undefined })
  }

  hide(): void {
    this.update({ visible: false, busy: false })
  }

  setStep(step: number): void {
    this.update({ step: Math.max(0, Math.min(3, step)), permissionMessage: undefined })
  }

  update(patch: Partial<OnboardingSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if (sameSnapshot(this.snapshot, next)) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }

  async requestMicrophone(): Promise<void> {
    await this.actions?.requestMicrophone()
  }

  async requestAccessibility(): Promise<void> {
    await this.actions?.requestAccessibility()
  }

  async toggleRecording(): Promise<void> {
    await this.actions?.toggleRecording()
  }

  async finish(): Promise<void> {
    await this.actions?.finish()
  }
}

function sameSnapshot(left: OnboardingSnapshot, right: OnboardingSnapshot): boolean {
  return (
    left.visible === right.visible &&
    left.firstRun === right.firstRun &&
    left.step === right.step &&
    left.busy === right.busy &&
    left.platform === right.platform &&
    left.globalInputAvailable === right.globalInputAvailable &&
    left.microphonePermission === right.microphonePermission &&
    left.holdKeyGlyph === right.holdKeyGlyph &&
    left.holdKeyLabel === right.holdKeyLabel &&
    left.asrStatus === right.asrStatus &&
    left.recordingState === right.recordingState &&
    left.transcript === right.transcript &&
    left.permissionMessage === right.permissionMessage
  )
}

export const onboardingController = new OnboardingController()
