# Security

## Trust boundaries

- Renderer content is untrusted, even when bundled locally.
- Preload bridges expose product capabilities, never `ipcRenderer`, Node or
  Electron objects.
- Main validates sender URLs and every untrusted payload before use.
- Utility processes and the Swift helper are separate protocol boundaries and
  require message validation before the migration is complete.
- External transcription/transformation is disabled by default.

## Electron baseline

All windows use:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- `sandbox: true`;
- explicit preload paths;
- denied popup creation;
- blocked navigation outside the declared renderer set/development origin;
- blocked webview attachment.

Renderer CSP denies objects, frames, forms and base URL changes. Development
WebSocket access is restricted to localhost; production services run in main or
isolated workers.

The orb uses `preload/overlay.ts` and cannot read history, copy text, update
settings, prepare models or invoke recording completion.

## Sensitive data policy

Never write these values to logs or diagnostic exports:

- transcripts or selected text;
- clipboard contents or clipboard payload bytes;
- audio data or recording paths that identify user content;
- passwords, API keys, tokens or custom prompts containing private text;
- full window titles when they may contain document/customer names.

The structured logger redacts sensitive keys and accepts only scalar metadata.
Future adapters must log provider ID, phase, duration, platform, result category
and fallback fact—not payload content.

## Storage policy

- Transcript history is off by default in the new settings schema.
- WAV retention is off by default in the new settings schema.
- Clipboard history is off by default and must never be enabled implicitly.
- Cloud processing is off by default and requires per-provider consent.
- API keys will be encrypted using Electron `safeStorage`; unavailable protected
  storage is an explicit diagnostic/error, not a silent plaintext fallback.
- User data deletion must cover database, recordings, models on request, logs and
  secret-store entries.

## IPC rules

1. One named product operation per channel.
2. Runtime validation for request and response DTOs.
3. Bounded strings, arrays and binary recordings.
4. No arbitrary path, shell command, executable or URL parameters from renderer.
5. Capability-specific preload APIs for settings/editor and overlay.
6. Subscription methods return an unsubscribe function.
7. Errors cross IPC as named, user-safe DTOs without stacks or payload values.

## Insertion safety

- Block secure/password fields.
- Capture and revalidate the target application.
- Prefer direct platform input or accessibility.
- Serialize clipboard transactions.
- Restore clipboard only while Cure Voicer still owns the temporary value.
- Never overwrite a newer user/Punto/clipboard-manager mutation.
- Fail to editor/copy with an actionable diagnostic when privilege boundaries or
  target restrictions prevent insertion.

## Release security backlog

- Validate utility-process and Swift helper messages with versioned schemas.
- Add macOS entitlements, hardened runtime, signing and notarization.
- Add Windows Authenticode signing and integrity-level diagnostics.
- Configure signed auto-updates with rollback policy.
- Add dependency scanning and produce an SBOM for releases.
- Threat-model active-application and selected-text adapters before enabling.

