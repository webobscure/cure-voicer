import { describe, expect, it, vi } from 'vitest'
import { DictationMachine } from '../src/modules/dictation/dictation-machine'
import {
  InvalidDictationTransitionError,
  StaleDictationOperationError
} from '../src/modules/dictation/errors'
import type { InsertionResult } from '../src/shared/types/insertion'

const operationId = 'operation-1'

describe('DictationMachine', () => {
  it('runs a complete insert flow deterministically', () => {
    const machine = new DictationMachine({
      now: () => new Date('2026-07-23T10:00:00.000Z')
    })
    const states: string[] = []
    machine.subscribe((snapshot) => states.push(snapshot.state))

    machine.dispatch({ type: 'START', operationId })
    machine.dispatch({ type: 'CAPTURE_READY', operationId })
    machine.dispatch({ type: 'STOP', operationId })
    machine.dispatch({ type: 'AUDIO_READY', operationId })
    machine.dispatch({ type: 'TRANSCRIPTION_READY', operationId, text: 'Привет' })
    machine.dispatch({ type: 'INSERT', operationId })
    const insertion: InsertionResult = {
      operationId,
      providerId: 'keyboard',
      outcome: 'inserted',
      usedFallback: false,
      attempts: [{ providerId: 'keyboard', outcome: 'inserted', durationMs: 12 }]
    }
    const completed = machine.dispatch({
      type: 'INSERTION_COMPLETE',
      operationId,
      result: insertion
    })

    expect(states).toEqual([
      'starting',
      'recording',
      'processing',
      'recognizing',
      'editing',
      'inserting',
      'completed'
    ])
    expect(completed).toMatchObject({
      state: 'completed',
      operationId,
      revision: 7,
      startedAt: '2026-07-23T10:00:00.000Z',
      transcript: 'Привет',
      insertion
    })
  })

  it('supports pause, resume and completion without insertion', () => {
    const machine = new DictationMachine()
    machine.dispatch({ type: 'START', operationId })
    machine.dispatch({ type: 'CAPTURE_READY', operationId })
    expect(machine.dispatch({ type: 'PAUSE', operationId }).state).toBe('paused')
    expect(machine.dispatch({ type: 'RESUME', operationId }).state).toBe('recording')
    machine.dispatch({ type: 'STOP', operationId })
    machine.dispatch({ type: 'AUDIO_READY', operationId })
    machine.dispatch({ type: 'TRANSCRIPTION_READY', operationId, text: '' })
    expect(machine.dispatch({ type: 'COMPLETE', operationId }).state).toBe('completed')
    expect(machine.dispatch({ type: 'RESET', operationId })).toEqual({
      state: 'idle',
      operationId: null,
      revision: 9
    })
  })

  it('cancels an active operation and ignores listener removal', () => {
    const machine = new DictationMachine()
    const listener = vi.fn()
    const unsubscribe = machine.subscribe(listener)
    machine.dispatch({ type: 'START', operationId })
    unsubscribe()
    const cancelled = machine.dispatch({
      type: 'CANCEL',
      operationId,
      reason: 'user-request'
    })

    expect(cancelled).toMatchObject({
      state: 'cancelled',
      cancellationReason: 'user-request'
    })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('moves active operations to a named recoverable error', () => {
    const machine = new DictationMachine()
    machine.dispatch({ type: 'START', operationId })
    const failed = machine.dispatch({
      type: 'FAIL',
      operationId,
      code: 'MICROPHONE_DENIED',
      recoverable: true
    })

    expect(failed).toMatchObject({
      state: 'error',
      errorCode: 'MICROPHONE_DENIED',
      recoverable: true
    })
  })

  it('rejects stale operations and invalid transitions', () => {
    const machine = new DictationMachine()
    machine.dispatch({ type: 'START', operationId })

    expect(() =>
      machine.dispatch({ type: 'CAPTURE_READY', operationId: 'operation-2' })
    ).toThrow(StaleDictationOperationError)
    expect(() => machine.dispatch({ type: 'AUDIO_READY', operationId })).toThrow(
      InvalidDictationTransitionError
    )
    expect(machine.snapshot).toMatchObject({ state: 'starting', revision: 1 })
  })

  it('allows a fresh operation after a terminal state', () => {
    const machine = new DictationMachine()
    machine.dispatch({ type: 'START', operationId })
    machine.dispatch({ type: 'CANCEL', operationId })
    const next = machine.dispatch({ type: 'START', operationId: 'operation-2' })

    expect(next).toMatchObject({
      state: 'starting',
      operationId: 'operation-2',
      revision: 3
    })
    expect(next).not.toHaveProperty('cancellationReason')
  })
})
