import type { InsertionResult } from './insertion'

export type DictationState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'recognizing'
  | 'editing'
  | 'inserting'
  | 'completed'
  | 'error'
  | 'cancelled'

export type DictationEvent =
  | { type: 'START'; operationId: string }
  | { type: 'CAPTURE_READY'; operationId: string }
  | { type: 'PAUSE'; operationId: string }
  | { type: 'RESUME'; operationId: string }
  | { type: 'STOP'; operationId: string }
  | { type: 'AUDIO_READY'; operationId: string }
  | { type: 'TRANSCRIPTION_READY'; operationId: string; text: string }
  | { type: 'OPEN_EDITOR'; operationId: string }
  | { type: 'INSERT'; operationId: string }
  | { type: 'INSERTION_COMPLETE'; operationId: string; result: InsertionResult }
  | { type: 'COMPLETE'; operationId: string }
  | { type: 'CANCEL'; operationId: string; reason?: string }
  | { type: 'FAIL'; operationId: string; code: string; recoverable: boolean }
  | { type: 'RESET'; operationId: string }

export interface DictationSnapshot {
  state: DictationState
  operationId: string | null
  revision: number
  startedAt?: string
  transcript?: string
  cancellationReason?: string
  errorCode?: string
  recoverable?: boolean
  insertion?: InsertionResult
}
