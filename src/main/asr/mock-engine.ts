import type { AsrEngine, TranscriptionResult } from './types'

/**
 * Keeps the desktop recording pipeline usable before the native model sidecars
 * are added. It intentionally returns no text, so development recordings are
 * never pasted into the user's active application by accident.
 */
export class MockAsrEngine implements AsrEngine {
  readonly id = 'not-configured'

  async isAvailable(): Promise<boolean> {
    return true
  }

  async transcribe(_wavPath: string): Promise<TranscriptionResult> {
    return { text: '' }
  }
}
