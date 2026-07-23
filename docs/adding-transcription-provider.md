# Adding a transcription provider

Providers implement `SpeechRecognitionProvider` from
`src/shared/types/transcription.ts` and are registered in
`SpeechRecognitionProviderRegistry` at the main-process composition root.

## Contract

`transcribe(audio, options)` receives a validated local audio descriptor and
must return text, language metadata, provider ID and timing information. Honor
`options.signal` before expensive work and after every await. If the native SDK
cannot cancel an inference, discard its late result after abort and document the
limitation.

## Security requirements

- A local provider may receive an application-owned WAV path, never an arbitrary
  renderer-supplied path.
- A cloud provider must remain unregistered until the user explicitly enables
  cloud processing for it.
- Store credentials through `SecretVault`/Electron `safeStorage`; settings keep
  only a credential reference.
- Never log audio, transcript text, request bodies, API keys or identifying file
  paths.
- Validate worker/native-helper messages with Zod and bound response sizes.
- Delete temporary audio in `finally` unless recording retention is enabled.

## Provider selection

Give every provider a stable ID and a truthful availability probe. The registry
must fail explicitly when a requested provider is unavailable; it must not send
audio to a different cloud service as a silent fallback.

## Tests

Add registry selection, unavailable-provider, cancellation, malformed response,
timeout and redacted-error tests. Cloud adapters also require a test proving that
no network call happens without consent.
