import type {
  DictationEvent,
  DictationSnapshot,
  DictationState
} from '../../shared/types/dictation'
import {
  InvalidDictationTransitionError,
  StaleDictationOperationError
} from './errors'

export type DictationSnapshotListener = (snapshot: Readonly<DictationSnapshot>) => void

export interface DictationMachineOptions {
  now?: () => Date
}

const TERMINAL_STATES = new Set<DictationState>([
  'idle',
  'completed',
  'error',
  'cancelled'
])

const ACTIVE_STATES = new Set<DictationState>([
  'starting',
  'recording',
  'paused',
  'processing',
  'recognizing',
  'editing',
  'inserting'
])

export class DictationMachine {
  private current: DictationSnapshot = {
    state: 'idle',
    operationId: null,
    revision: 0
  }

  private readonly listeners = new Set<DictationSnapshotListener>()
  private readonly now: () => Date

  constructor(options: DictationMachineOptions = {}) {
    this.now = options.now ?? (() => new Date())
  }

  get snapshot(): Readonly<DictationSnapshot> {
    return Object.freeze({ ...this.current })
  }

  subscribe(listener: DictationSnapshotListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispatch(event: DictationEvent): Readonly<DictationSnapshot> {
    const next = this.reduce(this.current, event)
    this.current = { ...next, revision: this.current.revision + 1 }
    const snapshot = this.snapshot
    for (const listener of this.listeners) listener(snapshot)
    return snapshot
  }

  private reduce(snapshot: DictationSnapshot, event: DictationEvent): DictationSnapshot {
    if (event.type === 'START') {
      if (!TERMINAL_STATES.has(snapshot.state)) {
        throw new InvalidDictationTransitionError(snapshot.state, event.type)
      }
      return {
        state: 'starting',
        operationId: event.operationId,
        revision: snapshot.revision,
        startedAt: this.now().toISOString()
      }
    }

    this.assertCurrentOperation(snapshot, event.operationId)

    if (event.type === 'CANCEL' && ACTIVE_STATES.has(snapshot.state)) {
      return this.next(snapshot, 'cancelled', {
        cancellationReason: event.reason
      })
    }

    if (event.type === 'FAIL' && ACTIVE_STATES.has(snapshot.state)) {
      return this.next(snapshot, 'error', {
        errorCode: event.code,
        recoverable: event.recoverable
      })
    }

    switch (snapshot.state) {
      case 'starting':
        if (event.type === 'CAPTURE_READY') return this.next(snapshot, 'recording')
        break
      case 'recording':
        if (event.type === 'PAUSE') return this.next(snapshot, 'paused')
        if (event.type === 'STOP') return this.next(snapshot, 'processing')
        break
      case 'paused':
        if (event.type === 'RESUME') return this.next(snapshot, 'recording')
        if (event.type === 'STOP') return this.next(snapshot, 'processing')
        break
      case 'processing':
        if (event.type === 'AUDIO_READY') return this.next(snapshot, 'recognizing')
        break
      case 'recognizing':
        if (event.type === 'TRANSCRIPTION_READY') {
          return this.next(snapshot, 'editing', { transcript: event.text })
        }
        break
      case 'editing':
        if (event.type === 'OPEN_EDITOR') return this.next(snapshot, 'editing')
        if (event.type === 'INSERT') return this.next(snapshot, 'inserting')
        if (event.type === 'COMPLETE') return this.next(snapshot, 'completed')
        break
      case 'inserting':
        if (event.type === 'INSERTION_COMPLETE') {
          return this.next(snapshot, 'completed', { insertion: event.result })
        }
        break
      case 'completed':
      case 'error':
      case 'cancelled':
        if (event.type === 'RESET') {
          return { state: 'idle', operationId: null, revision: snapshot.revision }
        }
        break
      case 'idle':
        break
    }

    throw new InvalidDictationTransitionError(snapshot.state, event.type)
  }

  private assertCurrentOperation(
    snapshot: DictationSnapshot,
    receivedOperationId: string
  ): void {
    if (snapshot.operationId === receivedOperationId) return
    throw new StaleDictationOperationError(
      snapshot.operationId ?? 'none',
      receivedOperationId
    )
  }

  private next(
    snapshot: DictationSnapshot,
    state: DictationState,
    patch: Partial<DictationSnapshot> = {}
  ): DictationSnapshot {
    return { ...snapshot, ...patch, state }
  }
}
