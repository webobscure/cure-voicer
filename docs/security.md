# Security

## Trust boundaries

- Renderer content is untrusted, even when bundled locally.
- Preload bridges expose product capabilities, never `ipcRenderer`, Node or
  Electron objects.
- Main validates sender URLs and every untrusted payload before use.
- Utility processes and the Swift helper are separate protocol boundaries and
  require message validation before the migration is complete.
- External transcription/transformation is disabled by default.

## Threat model

Protected assets are dictated/selected text, clipboard formats, recordings,
credentials, application identity, settings and the ability to generate global
input. Relevant adversaries include compromised renderer content, malicious or
buggy clipboard software, an untrusted destination field, a tampered update, and
another local process reading weakly protected files.

Primary mitigations are renderer sandboxing and capability APIs; sender/payload
validation; secure-field and focus revalidation; serialized clipboard ownership;
encrypted secret files with restrictive permissions; no implicit cloud access;
and signed release/update requirements. A same-user process with full filesystem
or Accessibility access remains outside the protection boundary. Windows cannot
insert into a higher-integrity process, and macOS permissions can be revoked at
any time; both conditions must fail safely rather than trigger elevation.

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
- Enabling clipboard history does not enable clipboard polling. Only explicit
  Cure Voicer copy operations may be recorded, after credential/private-key/card
  heuristics and sensitive-application checks.
- Settings export excludes transcript history, clipboard history, audio, model
  data and future protected credential values.
- Cloud processing is off by default and requires per-provider consent.
- API keys are encrypted using Electron `safeStorage`; unavailable protected
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

- Add macOS entitlements, hardened runtime, signing and notarization.
- Add Windows Authenticode signing and integrity-level diagnostics.
- Configure signed auto-updates with rollback policy.
- Add dependency scanning and produce an SBOM for releases.

Automatic installation of updates remains disabled until both platform artifacts
are signed and the release feed can be cryptographically trusted. The app must
never downgrade to an unsigned package or execute a renderer-provided update URL.
