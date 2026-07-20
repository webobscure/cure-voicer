export interface TranscriptionResult {
  text: string
  language?: string
}

export interface AsrEngine {
  readonly id: string
  isAvailable(): Promise<boolean>
  prepare?(): Promise<void>
  transcribe(wavPath: string): Promise<TranscriptionResult>
  dispose?(): void
}
