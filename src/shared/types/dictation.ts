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
  | { type: 'CAPTURE_READY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'AUDIO_READY' }
  | { type: 'TRANSCRIPTION_READY'; text: string }
  | { type: 'OPEN_EDITOR' }
  | { type: 'INSERT' }
  | { type: 'INSERTION_COMPLETE'; result: InsertionResult }
  | { type: 'COMPLETE' }
  | { type: 'CANCEL'; reason?: string }
  | { type: 'FAIL'; code: string; recoverable: boolean }
  | { type: 'RESET' }

export interface DictationSnapshot {
  state: DictationState
  operationId: string | null
  revision: number
  startedAt?: string
  transcript?: string
  errorCode?: string
  recoverable?: boolean
  insertion?: InsertionResult
}

