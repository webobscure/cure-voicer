import type { AsrStatus, SmartCorrectionStatus } from '../../shared/contracts'

export interface ModelSettingsSnapshot {
  platform: NodeJS.Platform
  asr: AsrStatus
  smartCorrection: SmartCorrectionStatus
  smartCorrectionEnabled: boolean
}

const initialSnapshot: ModelSettingsSnapshot = {
  platform: 'darwin',
  asr: {
    state: 'loading', progress: 0, engine: 'Parakeet V3',
    modelName: 'Parakeet TDT 0.6B V3', modelSizeBytes: 0
  },
  smartCorrection: {
    state: 'not-downloaded', progress: 0,
    modelName: 'Qwen3.5-0.8B Q8_0', modelSizeBytes: 834_000_000
  },
  smartCorrectionEnabled: false
}

export class ModelSettingsStore {
  private snapshot = initialSnapshot
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): ModelSettingsSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  update(patch: Partial<ModelSettingsSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if (
      next.platform === this.snapshot.platform && next.asr === this.snapshot.asr &&
      next.smartCorrection === this.snapshot.smartCorrection &&
      next.smartCorrectionEnabled === this.snapshot.smartCorrectionEnabled
    ) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}

export const modelSettingsStore = new ModelSettingsStore()
