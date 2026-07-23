import { performance } from 'node:perf_hooks'
import type { AsrEngine } from '../../main/asr/types'
import type {
  AudioInput,
  SpeechRecognitionProvider,
  TranscriptionOptions,
  TranscriptionResult
} from '../../shared/types/transcription'
import { throwIfAborted } from './provider-registry'

export class LegacyAsrProvider implements SpeechRecognitionProvider {
  readonly kind = 'local' as const

  constructor(private readonly engine: AsrEngine) {}

  get id(): string {
    return this.engine.id
  }

  isSupported(): Promise<boolean> {
    return this.engine.isAvailable()
  }

  async prepare(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)
    await this.engine.prepare?.()
    throwIfAborted(signal)
  }

  async transcribe(
    audio: AudioInput,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (audio.kind !== 'wav-file') {
      throw new Error(`Provider ${this.id} only accepts WAV file input`)
    }

    throwIfAborted(options.signal)
    const startedAt = performance.now()
    const result = await this.engine.transcribe(audio.path)
    throwIfAborted(options.signal)
    return {
      text: result.text,
      language: result.language,
      providerId: this.id,
      durationMs: Math.round(performance.now() - startedAt)
    }
  }
}
