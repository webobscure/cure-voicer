export class TranscriptionProviderUnavailableError extends Error {
  readonly code = 'TRANSCRIPTION_PROVIDER_UNAVAILABLE'

  constructor(providerId?: string) {
    super(
      providerId
        ? `Speech recognition provider ${providerId} is unavailable`
        : 'No speech recognition provider is available'
    )
    this.name = 'TranscriptionProviderUnavailableError'
  }
}

export class TranscriptionCancelledError extends Error {
  readonly code = 'TRANSCRIPTION_CANCELLED'

  constructor() {
    super('Speech recognition was cancelled')
    this.name = 'TranscriptionCancelledError'
  }
}
