export type AudioInput =
  | {
      kind: 'wav-file'
      path: string
      durationMs: number
      sampleRate: number
    }
  | {
      kind: 'pcm'
      samples: Uint8Array
      durationMs: number
      sampleRate: number
      channels: 1
    }

export interface TranscriptionOptions {
  language?: string
  detectLanguage: boolean
  preferredTerms: string[]
  signal?: AbortSignal
}

export interface SecureCredentialReference {
  id: string
  storage: 'system'
}

export interface SpeechRecognitionProviderConfiguration {
  providerId: string
  enabled: boolean
  credential?: SecureCredentialReference
}

export interface TranscriptionResult {
  text: string
  language?: string
  confidence?: number
  providerId: string
  durationMs: number
}

export interface SpeechRecognitionProvider {
  readonly id: string
  readonly kind: 'local' | 'cloud' | 'system' | 'backend'
  isSupported(): Promise<boolean>
  prepare(signal?: AbortSignal): Promise<void>
  transcribe(
    audio: AudioInput,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult>
}
