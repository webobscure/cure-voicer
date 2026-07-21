export interface TranscriptionResult {
  text: string
  language?: string
}

export interface AsrEngine {
  readonly id: string
  readonly status: AsrStatus
  isAvailable(): Promise<boolean>
  refreshStatus?(): Promise<AsrStatus>
  onStatusChanged?(listener: (status: AsrStatus) => void): void
  prepare?(): Promise<void>
  transcribe(wavPath: string): Promise<TranscriptionResult>
  dispose?(): void
}
import type { AsrStatus } from '../../shared/contracts'
