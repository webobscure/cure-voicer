import { describe, expect, it, vi } from 'vitest'
import {
  SpeechRecognitionProviderRegistry,
  throwIfAborted
} from '../src/modules/transcription/provider-registry'
import {
  TranscriptionCancelledError,
  TranscriptionProviderUnavailableError
} from '../src/modules/transcription/errors'
import type {
  AudioInput,
  SpeechRecognitionProvider,
  TranscriptionOptions
} from '../src/shared/types/transcription'

const audio: AudioInput = {
  kind: 'wav-file',
  path: '/tmp/dictation.wav',
  durationMs: 900,
  sampleRate: 16_000
}

const options: TranscriptionOptions = {
  detectLanguage: true,
  preferredTerms: []
}

function provider(
  id: string,
  supported: boolean
): SpeechRecognitionProvider & { prepare: ReturnType<typeof vi.fn> } {
  const prepare = vi.fn(async () => undefined)
  return {
    id,
    kind: 'local',
    isSupported: vi.fn(async () => supported),
    prepare,
    transcribe: vi.fn(async () => ({
      text: 'test',
      providerId: id,
      durationMs: 10
    }))
  }
}

describe('SpeechRecognitionProviderRegistry', () => {
  it('selects the first supported provider and prepares it', async () => {
    const unavailable = provider('unavailable', false)
    const available = provider('available', true)
    const registry = new SpeechRecognitionProviderRegistry([unavailable, available])

    await expect(registry.transcribe(audio, options)).resolves.toMatchObject({
      providerId: 'available',
      text: 'test'
    })
    expect(unavailable.prepare).not.toHaveBeenCalled()
    expect(available.prepare).toHaveBeenCalledOnce()
  })

  it('does not silently fall back from an explicitly selected provider', async () => {
    const registry = new SpeechRecognitionProviderRegistry([
      provider('preferred', false),
      provider('fallback', true)
    ])

    await expect(registry.select('preferred')).rejects.toBeInstanceOf(
      TranscriptionProviderUnavailableError
    )
  })

  it('treats support probe failures as unavailable', async () => {
    const broken = provider('broken', true)
    broken.isSupported = vi.fn(async () => {
      throw new Error('probe failed')
    })
    const registry = new SpeechRecognitionProviderRegistry([broken])

    await expect(registry.select()).rejects.toBeInstanceOf(
      TranscriptionProviderUnavailableError
    )
  })

  it('rejects duplicate provider identifiers', () => {
    expect(
      () => new SpeechRecognitionProviderRegistry([provider('same', true), provider('same', true)])
    ).toThrow('Duplicate speech recognition provider: same')
  })

  it('honours cancellation before provider work begins', async () => {
    const selected = provider('local', true)
    const registry = new SpeechRecognitionProviderRegistry([selected])
    const controller = new AbortController()
    controller.abort()

    await expect(
      registry.transcribe(audio, { ...options, signal: controller.signal })
    ).rejects.toBeInstanceOf(TranscriptionCancelledError)
    expect(selected.isSupported).not.toHaveBeenCalled()
  })

  it('throws the named cancellation error', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => throwIfAborted(controller.signal)).toThrow(
      TranscriptionCancelledError
    )
  })
})
