import type { AsrEngine, TranscriptionResult } from './types'
import type { AsrStatus } from '../../shared/contracts'
import { initialAsrStatus } from '../../shared/asr'

/**
 * Keeps the desktop recording pipeline usable before the native model sidecars
 * are added. It intentionally returns no text, so development recordings are
 * never pasted into the user's active application by accident.
 */
export class MockAsrEngine implements AsrEngine {
  readonly id = 'not-configured'
  readonly status: AsrStatus = {
    ...initialAsrStatus('error', this.id),
    error: 'Локальное распознавание пока не поддерживается на этой платформе'
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async transcribe(_wavPath: string): Promise<TranscriptionResult> {
    return { text: '' }
  }
}
