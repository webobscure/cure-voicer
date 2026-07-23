import { describe, expect, it } from 'vitest'
import type {
  DiagnosticEvent,
  DiagnosticSink
} from '../src/modules/diagnostics/structured-logger'
import { StructuredLogger } from '../src/modules/diagnostics/structured-logger'

class MemorySink implements DiagnosticSink {
  readonly events: DiagnosticEvent[] = []

  write(event: DiagnosticEvent): void {
    this.events.push(event)
  }
}

describe('StructuredLogger', () => {
  it('redacts sensitive values and preserves operational metadata', () => {
    const sink = new MemorySink()
    const logger = new StructuredLogger('insertion', sink, 'darwin')

    logger.info('provider-finished', {
      operationId: 'operation-1',
      provider: 'keyboard-macos',
      durationMs: 42,
      transcript: 'sensitive words',
      clipboardFormat: 'text/plain'
    })

    expect(sink.events).toHaveLength(1)
    expect(sink.events[0]).toMatchObject({
      scope: 'insertion',
      stage: 'provider-finished',
      operationId: 'operation-1',
      platform: 'darwin',
      details: {
        provider: 'keyboard-macos',
        durationMs: 42,
        transcript: '[REDACTED]',
        clipboardFormat: '[REDACTED]'
      }
    })
  })
})

