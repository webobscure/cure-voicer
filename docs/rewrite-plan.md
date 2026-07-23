# Cure Voicer rewrite plan

This document is the migration ledger. It must be updated after every stage.
Existing working features remain in place until their replacement has passing
tests and has been exercised in the application.

## Architecture principles

1. The main process owns application and dictation state.
2. Renderers are untrusted views. They request typed commands and subscribe to
   sanitized snapshots; they never receive raw Node/Electron primitives.
3. Business modules depend on interfaces, not Electron or a specific OS.
4. Platform code implements those interfaces under `src/platform`.
5. All IPC and persisted inputs receive runtime schema validation.
6. Text insertion is a policy-driven provider chain. Clipboard is a fallback,
   not the default transport.
7. Sensitive text, clipboard data, audio and secrets never enter diagnostics.
8. Every long-running operation has an ID, cancellation signal and explicit
   state transition.

## Target structure

```text
src/
  main/
    app/                 # composition root and lifecycle
    ipc/                 # validated channel registration
    security/            # navigation, URL, secret and permission policies
    services/            # Electron-facing application services
    shortcuts/           # action-based shortcut registry
    windows/             # hardened BrowserWindow factories
  preload/               # capability-scoped bridges
  renderer/
    app/                  # React roots, routes and providers
    components/           # reusable presentation components
    features/             # UI adapters/hooks by feature
    pages/                # top-level product pages
    stores/               # renderer view state only
  shared/
    contracts/            # transport DTOs and channel definitions
    types/                # domain types safe in every process
    validation/           # Zod schemas and decoders
  platform/
    macos/                # Accessibility, active app, input and clipboard adapters
    windows/              # Win32 input, active window and integrity adapters
  modules/
    dictation/            # state machine and use cases
    transcription/        # provider registry/adapters
    transformations/      # text pipeline and presets
    insertion/            # provider registry and fallback policy
    clipboard/            # transactional clipboard abstraction
    commands/             # voice command registry/parser
    integrations/         # active-app policies
    history/              # repositories and retention
    settings/             # schema, migration and repositories
    diagnostics/          # redacted structured events/reports
```

## Compatibility strategy

- The current entry point remains operational during stages 1–3.
- New domain modules are framework-free and are tested before they are composed.
- Existing ASR engines are wrapped as `SpeechRecognitionProvider` instances;
  their model/runtime implementation is not rewritten initially.
- The current renderer is replaced page-by-page after the React shell can display
  state from the compatibility API.
- `settings.json` remains the source of truth until the database importer and
  migration tests are complete.
- The legacy inserter remains available only as an explicit last-resort adapter
  during stage 3, then is removed after provider parity.

## Stage 1 — foundation and safe shell

Status: **completed on 2026-07-23**

- [x] Audit repository and document current state.
- [x] Define target module boundaries and migration strategy.
- [x] Add React/ReactDOM feature root without removing the working renderer or overlay.
- [x] Add Zod schemas for IPC envelopes, preferences and core commands.
- [x] Split overlay/settings capabilities and add a validated IPC handler foundation.
- [x] Add hardened renderer policy: deny navigation/window-open, validate dev URL,
      capability-scope preload access.
- [x] Add application composition root and move lifecycle registration out of `main/index.ts`.
- [x] Add versioned settings schema and compatibility migration interface.
- [x] Add structured redacted logger foundation.
- [x] Add Oxlint and scripts for `lint`, macOS build and exact README commands.
- [x] Add baseline IPC/security tests and Electron smoke-test harness.
- [x] Verify macOS smoke launch and review the Windows x64 CI/build configuration.

Exit criteria:

- A React diagnostics feature runs through electron-vite beside the preserved UI.
- The old dictation/ASR/insertion path remains wired during migration.
- The overlay preload is capability-scoped and privileged IPC checks renderer role.
- `typecheck`, `lint`, 40 unit tests, production build and macOS smoke test pass.

Windows packaging is defined and checked by `.github/workflows/windows-build.yml`;
the binary build itself still requires the Windows runner and is tracked as a
release validation task in stage 8.

## Stage 2 — dictation domain and transcription

Status: **completed on 2026-07-23**

- [x] Implement authoritative state machine with `idle`, `starting`, `recording`,
      `paused`, `processing`, `recognizing`, `editing`, `inserting`, `completed`,
      `error` and `cancelled` states.
- [x] Add event guards, operation IDs, cancellation and deterministic recovery.
- [x] Move microphone capture behind a renderer capture port with chunk/session
      protocol and bounded memory.
- [x] Add silence detection, automatic stop and pause/resume capture capability.
- [x] Define `SpeechRecognitionProvider` and provider registry.
- [x] Adapt FluidAudio and sherpa-onnx engines without changing model behaviour.
- [x] Add cloud/system/backend extension points and secure credential references.
- [x] Drive tray/overlay presentation from state-machine snapshots while retaining
      the compatibility renderer commands.
- [x] Add state-machine, cancellation, capture-session, silence and
      provider-selection tests.

Exit criteria: existing local dictation works through the new state machine on
macOS and Windows, including cancellation and actionable errors.

The existing native ASR API cannot interrupt an inference already executing.
Cancellation is nevertheless immediate in the UI and prevents correction,
history and insertion after the native call returns. Cooperative native-worker
cancellation remains a stage 8 hardening task.

## Stage 3 — insertion and clipboard safety

Status: **not started**

- [ ] Add `InsertionMode`, context/result/error types and
      `TextInsertionProvider` interface.
- [ ] Implement provider registry, support probes and deterministic fallback.
- [ ] Implement macOS keyboard/accessibility adapters.
- [ ] Implement Windows Unicode input/active-window adapters.
- [ ] Add clipboard-only and internal-editor providers.
- [ ] Implement serialized safe clipboard transaction: all formats snapshot,
      ownership fingerprint, target wait, mutation detection and conditional
      restoration.
- [ ] Capture active application before recording and revalidate before insert.
- [ ] Block password/secure fields and blacklisted applications.
- [ ] Add redacted insertion journal and diagnostics.
- [ ] Add Punto/clipboard-manager race, user-copy, double-insert, focus-change,
      Unicode/emoji/newline and UAC failure tests.

Exit criteria: default insertion does not modify the clipboard; clipboard fallback
never overwrites newer user/third-party data.

## Stage 4 — editor and transformations

Status: **not started**

- [ ] Add compact non-focus-stealing result editor plus explicit focus mode.
- [ ] Add original/transformed/manual versions and undo history.
- [ ] Define `TextTransformation`, pipeline and transformation registry.
- [ ] Implement deterministic cleanup transforms and local Qwen adapter.
- [ ] Add presets: none, punctuation, spelling, filler/repeat removal, written
      style, shorten/expand, tones, list, email, message, specification, translate
      and custom instruction.
- [ ] Add preview/compare/retry/find-replace/insert/copy controls.
- [ ] Require explicit opt-in for every external provider.

## Stage 5 — commands, selection and shortcuts

Status: **not started**

- [ ] Define `VoiceCommand`, registry, aliases and enable/disable persistence.
- [ ] Add conservative command-intent detection and dangerous-action confirmation.
- [ ] Implement newline/paragraph/punctuation/edit/insert/copy/transform/settings/
      repeat/clear/note commands and undo.
- [ ] Add selected-text acquisition/replacement with safe rollback.
- [ ] Replace shortcut globals with action IDs, conflict probes and preset bindings.
- [ ] Add command false-positive and selection failure tests.

## Stage 6 — active application integrations

Status: **not started**

- [ ] Define `ActiveApplicationContext`, `AppIntegration` and integration registry.
- [ ] Implement platform active-window adapters and secure-field capability.
- [ ] Add generic browser, messenger, mail, IDE and text-editor integrations.
- [ ] Add initial profiles for Telegram, Slack, Discord, Teams, Mail, Outlook,
      Gmail, Notion, Obsidian, VS Code and JetBrains.
- [ ] Add per-app insertion, transformation, shortcut and blacklist rules.
- [ ] Disable prose formatting by default in IDE/code contexts.

## Stage 7 — product data and settings

Status: **not started**

- [ ] Add SQLite repositories and idempotent migrations from `settings.json`.
- [ ] Add independent, opt-in history retention and deletion controls.
- [ ] Add templates, pinned fragments and optional clipboard history.
- [ ] Add sensitive-data heuristics, application exclusions and retention TTL.
- [ ] Add import/export with schema validation and secret exclusion.
- [ ] Complete Russian/English localization and theme handling.
- [ ] Migrate onboarding and settings to feature-based React pages.

## Stage 8 — hardening, diagnostics and release

Status: **not started**

- [ ] Complete threat model and security documentation.
- [ ] Store API secrets with `safeStorage`; add explicit cloud consent.
- [ ] Add diagnostics page/report with redaction and service probes.
- [ ] Add user-data deletion and model/cache controls.
- [ ] Add IPC integration, Electron smoke and Playwright E2E suites.
- [ ] Test packaged macOS/Windows builds and native runtime loading.
- [ ] Configure macOS entitlements/signing/notarization and Windows signing.
- [ ] Add signed auto-update policy with staged rollout and rollback notes.
- [ ] Finish all extension and platform documentation.

## Validation required after every stage

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
```

Platform packaging is additionally required before a platform release:

```bash
npm run pack:mac
npm run pack:win
```

## Decision log

### 2026-07-23 — incremental replacement

Decision: do not move the current implementation wholesale into `legacy` yet.
Build new domain modules beside it, adapt stable providers, and replace the
composition root only after contract tests pass.

Reason: the ASR/native packaging path already works and is expensive to recover
if a broad file move breaks sidecar path resolution.

### 2026-07-23 — clipboard is a fallback

Decision: direct platform input/accessibility providers precede clipboard-safe.
Clipboard-only and internal-editor modes remain explicit user choices.

Reason: this is the only architecture that removes the Punto Switcher race from
the default path rather than attempting to tune timing around it.
