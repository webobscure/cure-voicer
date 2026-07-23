import type {
  AudioInput,
  SpeechRecognitionProvider,
  TranscriptionOptions,
  TranscriptionResult
} from '../../shared/types/transcription'
import {
  TranscriptionCancelledError,
  TranscriptionProviderUnavailableError
} from './errors'

export class SpeechRecognitionProviderRegistry {
  private readonly providersById: ReadonlyMap<string, SpeechRecognitionProvider>

  constructor(private readonly providers: readonly SpeechRecognitionProvider[]) {
    const providersById = new Map<string, SpeechRecognitionProvider>()
    for (const provider of providers) {
      if (providersById.has(provider.id)) {
        throw new Error(`Duplicate speech recognition provider: ${provider.id}`)
      }
      providersById.set(provider.id, provider)
    }
    this.providersById = providersById
  }

  get(providerId: string): SpeechRecognitionProvider | undefined {
    return this.providersById.get(providerId)
  }

  async select(preferredProviderId?: string): Promise<SpeechRecognitionProvider> {
    if (preferredProviderId) {
      const preferred = this.providersById.get(preferredProviderId)
      if (!preferred || !(await this.supported(preferred))) {
        throw new TranscriptionProviderUnavailableError(preferredProviderId)
      }
      return preferred
    }

    for (const provider of this.providers) {
      if (await this.supported(provider)) return provider
    }
    throw new TranscriptionProviderUnavailableError()
  }

  async transcribe(
    audio: AudioInput,
    options: TranscriptionOptions,
    preferredProviderId?: string
  ): Promise<TranscriptionResult> {
    throwIfAborted(options.signal)
    const provider = await this.select(preferredProviderId)
    throwIfAborted(options.signal)
    await provider.prepare(options.signal)
    throwIfAborted(options.signal)
    return provider.transcribe(audio, options)
  }

  private async supported(provider: SpeechRecognitionProvider): Promise<boolean> {
    return provider.isSupported().catch(() => false)
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new TranscriptionCancelledError()
}
