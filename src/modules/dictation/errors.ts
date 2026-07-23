import type { DictationEvent, DictationState } from '../../shared/types/dictation'

export class InvalidDictationTransitionError extends Error {
  readonly code = 'DICTATION_INVALID_TRANSITION'

  constructor(state: DictationState, event: DictationEvent['type']) {
    super(`Dictation event ${event} is not valid in state ${state}`)
    this.name = 'InvalidDictationTransitionError'
  }
}

export class StaleDictationOperationError extends Error {
  readonly code = 'DICTATION_STALE_OPERATION'

  constructor(expectedOperationId: string, receivedOperationId: string) {
    super(
      `Dictation event belongs to operation ${receivedOperationId}, expected ${expectedOperationId}`
    )
    this.name = 'StaleDictationOperationError'
  }
}
