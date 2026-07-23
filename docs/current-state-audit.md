# Current-state audit

Date: 2026-07-23  
Audited revision: `7da70d6` (`main`)

## Executive summary

Cure Voicer is a working local-first Electron prototype, not yet a maintainable
desktop platform. It has useful native speech-recognition adapters, a solid
audio capture path and a secure baseline for BrowserWindow configuration, but
application lifecycle, settings, shortcuts, dictation orchestration, history,
permissions and IPC are concentrated in a single 1,100-line main-process file.
The renderer is another 1,100-line imperative module.

The highest-risk defect is text delivery. Every non-empty transcript is written
to the system clipboard before the application decides whether it should paste.
The previous clipboard is never captured or restored. A fixed 35 ms delay and a
synthetic paste shortcut are the only synchronization. This creates data loss
and races with Punto Switcher, clipboard managers and user clipboard activity.

The rewrite must be incremental. The existing ASR providers, Swift helper,
Windows model verification, AudioWorklet capture, transcript normalization,
tray and orb should remain operational while orchestration and insertion are
moved behind new interfaces.

## Repository and runtime map

| Area | Current implementation | Assessment |
| --- | --- | --- |
| Electron entry point | `src/main/index.ts` | Owns nearly every service and all mutable application state. |
| Settings/recorder renderer | `src/renderer/index.html`, `index.ts`, `styles.css` | Vanilla DOM, business logic and direct preload calls in one module. |
| Floating orb | `src/renderer/overlay.*` | Useful standalone renderer; can be retained and adapted to new state events. |
| Preload | `src/preload/index.ts` | Uses `contextBridge`; API is typed but broad and validation is mostly manual. |
| Shared contracts | `src/shared/contracts.ts` | One flat file shared by unrelated features. |
| Audio capture | `src/renderer/audio-recorder.ts`, AudioWorklet | Captures mono input, reports RMS, resamples to 16 kHz and transfers PCM. |
| Dictation orchestration | `src/renderer/index.ts`, `src/main/recording-service.ts` | Split across renderer/main without one authoritative state machine. |
| macOS ASR | `FluidAudioEngine` + Swift executable | Local Parakeet V3 through FluidAudio/Core ML; useful provider boundary exists. |
| Windows ASR | `SherpaOnnxEngine` + Electron utility process | Local Parakeet V3 ONNX; downloads pinned files and verifies SHA-256. |
| Smart correction | `SmartCorrectionService` + Qwen utility process | Local optional model; narrow correction policy and hard-coded prompt. |
| Text insertion | `src/main/text-inserter.ts` | Single clipboard-first implementation; principal reliability/data-loss risk. |
| Settings/history | One `settings.json` | No schema version, transaction, encryption, migration framework or query layer. |
| Packaging | electron-vite + electron-builder | Windows x64 configured; macOS packaging/signing/notarization is incomplete. |
| Tests | 29 Vitest unit tests | Good deterministic utility coverage; no main IPC, state-machine, insertion or E2E tests. |

## Current execution flow

1. `src/main/index.ts` obtains a single-instance lock and creates ASR/Qwen
   services using global mutable variables.
2. On ready it loads `settings.json`, registers IPC, creates the settings window,
   overlay and tray, prepares models and registers either `globalShortcut` or
   `uiohook-napi` listeners.
3. A global key command is sent to the hidden renderer.
4. The renderer starts `getUserMedia`, creates an `AudioContext` and AudioWorklet,
   buffers Float32 chunks in memory and publishes visual levels.
5. On stop, the entire 16 kHz PCM recording crosses IPC as a `Uint8Array`.
6. `RecordingService` writes a WAV file, calls the selected `AsrEngine`, runs
   deterministic normalization and optional Qwen correction.
7. `TextInserter` overwrites the clipboard and optionally synthesizes paste.
8. History and preferences are rewritten into one JSON file.

## Clipboard use and Punto Switcher conflict

### Current behaviour

`TextInserter.insert()` performs `clipboard.writeText(text)` for every transcript.
If auto-paste is enabled it waits 35 ms and invokes:

- macOS: AppleScript `key code 9 using command down`;
- Windows: PowerShell `System.Windows.Forms.SendKeys.SendWait('^v')`.

The `copyText` IPC endpoint also overwrites plain text directly.

### Why conflicts occur

- The previous clipboard is destroyed before insertion starts.
- Only plain text is considered; HTML, RTF, images, file lists and custom formats
  are discarded.
- There is no operation mutex, so two finishes/copies can interleave.
- The 35 ms delay does not prove that the target application consumed the data.
- There is no ownership token or sequence check before restoration (because no
  restoration exists at all).
- Punto Switcher and similar tools monitor keyboard and/or clipboard changes.
  They can rewrite text or clipboard contents between `writeText` and paste.
- Synthetic Cmd/Ctrl+V is observable by global keyboard hooks and target-app
  extensions, introducing another race.
- The boolean `textInsertionInProgress` only suppresses Cure Voicer's hold-key
  hook; it does not serialize insertions or protect clipboard data.
- Windows SendKeys is focus-sensitive and cannot inject into elevated apps from
  a non-elevated process.

### Required replacement

Use a provider registry with keyboard/Unicode and accessibility providers before
the clipboard provider. The clipboard provider must capture every advertised
format, serialize operations, write an ownership fingerprint, wait for target
consumption, detect third-party/user mutations and restore only when Cure Voicer
still owns the temporary clipboard value. Logs must contain operation IDs and
phases, never clipboard or transcript content.

## Global shortcuts and native modules

- Toggle mode uses Electron `globalShortcut`.
- Hold mode uses `uiohook-napi` and observes global keydown/keyup events.
- Default hold key is right Option on macOS and right Ctrl on Windows.
- macOS hold mode requires Accessibility trust.
- Windows hold mode has no explicit permission but is subject to process
  integrity/UAC boundaries.
- Native/runtime dependencies are `uiohook-napi`, `sherpa-onnx-node`,
  `node-llama-cpp`, and the separately built Swift/FluidAudio helper.

The shortcut manager should become a platform service with registration status,
conflict reporting, action IDs and a single event stream. Raw hook events must
never reach renderer code.

## Platform differences

### macOS

- Apple Silicon has a FluidAudio/Core ML provider; other Macs fall back to a
  mock/no-op engine.
- Microphone and Accessibility permission flows are partly implemented.
- Paste is performed through AppleScript and requires Accessibility.
- The app is menu-bar oriented and hides its Dock icon.
- Signing, hardened runtime, entitlements and notarization are not configured.
- Active application and secure-field detection are absent.

### Windows

- Windows x64 uses sherpa-onnx in an Electron utility process.
- Model downloads are pinned to a revision and verified by size and SHA-256.
- Paste uses PowerShell/WinForms SendKeys, adding latency and focus/UAC failure
  modes.
- There is no Unicode keyboard injection provider, active-window adapter,
  protected-field detection or elevated-target diagnosis.
- NSIS and portable builds exist, but signing and auto-update do not.

## Persistence

`settings.json` stores preferences, overlay coordinates, vocabulary and up to
100 full transcripts. Writes replace the complete document. There is no schema
version, atomic temporary-file swap, migration record, separation of sensitive
history, retention policy or corruption recovery. Audio retention defaults to
enabled, contrary to the new privacy requirement.

The replacement will use a repository layer. Structured data will move to the
SQLite implementation available in the Electron runtime after a capability
check, with versioned migrations and a JSON compatibility importer. Secrets will
use Electron `safeStorage`; plaintext fallback will require explicit warning and
opt-in. Audio retention and clipboard history will default to off.

## Security review

### Existing strengths

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- CSP restricts scripts/styles to self and media to self/blob.
- Preload exposes explicit functions rather than raw `ipcRenderer`.
- IPC checks renderer URL and validates several payloads.
- Windows model artifacts are pinned and hash-verified.
- Worker processes isolate ASR and LLM memory/crashes from the main renderer.

### Findings to address

1. IPC contracts use manual, inconsistent validation; worker messages are cast
   without runtime validation.
2. One renderer origin is trusted for both settings and overlay, so the overlay
   receives capabilities it does not need.
3. `shell.openExternal` destinations are currently enumerated, but there is no
   shared URL policy for future integrations.
4. Full transcript history and WAV recordings can be retained by default.
5. There is no secret storage abstraction for future cloud providers.
6. Logs are unstructured and cannot be safely exported or redacted centrally.
7. No protected-field or sensitive-application check precedes insertion.
8. Model/helper messages and paths need schema validation and clearer trust
   boundaries.
9. No navigation/window-open denial handlers are installed.
10. No CSP `object-src 'none'`, `base-uri 'none'` or explicit production
    `connect-src` policy exists.

## Code quality and reliability findings

- Main and settings renderer are monoliths with extensive mutable global state.
- Renderer and main both believe they own recording state, enabling divergence.
- The current state type lacks pause, edit, insert, complete, cancel and explicit
  recognition phases.
- `RecordingService.finish()` combines persistence, ASR, normalization, LLM,
  insertion and cleanup, preventing isolated policy tests.
- Settings updates have validation but no formal schema or migrations.
- No cancellation token crosses the full dictation pipeline.
- Active target application is not captured at recording start or revalidated at
  insertion time.
- History cannot be disabled independently of audio retention.
- Automatic silence stop is absent.
- Error categories are strings, making diagnostics and recovery inconsistent.
- The renderer transfers a complete recording in one IPC message; long sessions
  increase memory pressure in both processes.

## Preserve, adapt, replace

### Preserve behind interfaces

- FluidAudio and sherpa-onnx transcription implementations.
- Verified Windows model download pipeline.
- Swift JSON-line helper protocol, after validation/versioning.
- AudioWorklet capture and resampling utilities.
- Transcript normalization and vocabulary helpers.
- Qwen utility-process lifecycle as one local transformation provider.
- Tray, orb rendering and saved positioning behaviour.

### Adapt

- BrowserWindow creation into a hardened window factory.
- Global hooks into a shortcut service.
- Permission flows into platform adapters and diagnostics.
- Existing JSON into a one-time migration source.
- Overlay events into the central dictation state machine.

### Replace

- Clipboard-first `TextInserter`.
- Main/renderer global mutable state.
- Flat IPC contract and manual validation.
- Monolithic imperative settings UI.
- Unversioned persistence and always-on transcript history.
- Hard-coded single smart-correction mode.

## Rewrite risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Native modules break packaging | Keep providers intact initially; add packaged smoke checks per platform before moving them. |
| Rewrite regresses working dictation | Introduce compatibility adapters and contract tests before switching orchestration. |
| Clipboard restoration overwrites user data | Ownership fingerprints, OS sequence checks where available, serialized operations and no-restore-on-mutation rule. |
| Direct Unicode input behaves differently by target | Per-platform providers plus integration policy/fallback telemetry. |
| Accessibility APIs expose sensitive UI | Minimum queries, secure-field blocking, no field content in logs. |
| Windows elevated targets reject input | Detect integrity mismatch where possible and fail safely to editor/clipboard-only. |
| Database migration loses settings/history | Read-only import, backup marker, idempotent migrations and rollback tests. |
| React migration blocks hidden recorder | Move recorder into a dedicated feature controller before replacing UI pages. |
| Scope causes a long-lived broken branch | Commit each stage only after typecheck, lint, tests, build and smoke verification. |

## Baseline verification

At audit time the repository reports:

- TypeScript strict mode enabled;
- 7 Vitest files / 29 tests passing;
- electron-vite production build passing;
- no lint script;
- no integration, IPC, Electron smoke or E2E suite.

