# Text insertion

Text insertion is a policy-driven module. `RecordingService` never calls
Electron clipboard APIs or platform commands directly. It supplies text and an
`InsertionContext` to `TextInsertionService`, which chooses a provider.

## Modes and default order

1. `keyboard` — native Unicode events, no clipboard.
2. `accessibility` — focused-element accessibility API, no clipboard.
3. `clipboard-safe` — transactional temporary clipboard plus paste shortcut.
4. `internal-editor` — keeps the text inside Cure Voicer.

`clipboard-only` is an explicit delivery mode and is not part of the automatic
insertion fallback. The user can select every mode in settings. The default is
`keyboard`.

Before an external insertion, the service compares the application captured at
dictation start with the current foreground application. It blocks automatic
insertion when focus changed or the focused element is marked secure, and opens
the internal editor when that fallback is allowed.

Providers implement `TextInsertionProvider` from
`src/shared/types/insertion.ts`. A provider must report support honestly and
return a typed outcome; it must not claim success after an OS call fails.

## Platform behavior

- macOS direct input uses `cure-voicer-input`, which posts Unicode `CGEvent`s.
  Accessibility mode writes `AXSelectedText` on the focused element.
- Windows direct input uses Win32 `SendInput` with `KEYEVENTF_UNICODE` from a
  fixed PowerShell/C# bridge. Text is base64-encoded data, never executable
  command text.
- Elevated Windows targets are treated as unsupported from a non-elevated Cure
  Voicer process; the chain falls back without requesting elevation.

Insertion logs contain operation ID, provider, outcome, duration and fallback
status. They never contain inserted text.

