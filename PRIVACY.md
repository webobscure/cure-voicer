# Privacy

Cure Voicer is designed as a local-first dictation application.

- Microphone audio is processed on the user's device.
- Parakeet speech recognition runs locally through Core ML on supported Macs
  and ONNX Runtime on Windows x64.
- Optional Qwen smart correction runs locally.
- The application does not send recordings or transcripts to a Cure Voicer
  server.
- An internet connection is used to download selected model files on first use.
- Dictation history and, when enabled, WAV recordings are stored in the local
  application data directory.
- Automatic paste writes the transcript to the system clipboard and sends the
  platform paste shortcut to the currently focused application.
- Hold-to-talk observes global key events while enabled, but the application
  only evaluates the configured activation key and does not store typed keys.

Users can disable recording retention, disable automatic paste, clear local
history, and revoke microphone access in operating-system settings.
