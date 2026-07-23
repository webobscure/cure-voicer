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

Status: **completed on 2026-07-23**

- [x] Add `InsertionMode`, context/result/error types and
      `TextInsertionProvider` interface.
- [x] Implement provider registry, support probes and deterministic fallback.
- [x] Implement macOS keyboard/accessibility adapters and native Swift helper.
- [x] Implement Windows Unicode input/active-window adapters.
- [x] Add clipboard-only and internal-editor providers.
- [x] Implement serialized safe clipboard transaction: all formats snapshot,
      ownership fingerprint, target wait, mutation detection and conditional
      restoration.
- [x] Capture active application before recording and revalidate before insert.
- [x] Block detected password/secure fields and blacklisted applications.
- [x] Add redacted insertion journal and diagnostics.
- [x] Add simulated Punto/clipboard-manager race, user-copy, double-insert,
      focus-change,
      Unicode/emoji/newline and UAC failure tests.

Exit criteria: default insertion does not modify the clipboard; clipboard fallback
never overwrites newer user/third-party data.

The macOS helper was compiled and its active-application JSON contract was
exercised locally. Windows Unicode/UIPI capability is unit-tested; the Windows
native runtimes, Electron shell and packaged application are exercised by CI.
A real elevated target still requires the manual release matrix in stage 8.
The Punto tests simulate its observable clipboard mutation; a release candidate
still requires the manual Punto matrix documented in `docs/testing.md`.

## Stage 4 — editor and transformations

Status: **completed on 2026-07-23**

- [x] Add an explicit-focus React result editor; automatic insertion continues
      without focusing Cure Voicer.
- [x] Add original/transformed/manual versions and undo/redo history.
- [x] Define `TextTransformation`, pipeline and transformation registry.
- [x] Implement deterministic cleanup transforms and local Qwen adapter.
- [x] Add presets: none, punctuation, spelling, filler/repeat removal, written
      style, shorten/expand, tones, list, email, message, specification, translate
      and custom instruction.
- [x] Add preview/compare/retry/find-replace/insert/copy controls.
- [x] Require explicit opt-in for every external provider; stage 4 registers only
      deterministic and local-model transformations.

The editor preserves the application captured at dictation start. Explicit
Insert reactivates that process, revalidates focus and uses the same provider
chain as automatic insertion. Failure returns to the editor without discarding
the edited text.

## Stage 5 — commands, selection and shortcuts

Status: **completed on 2026-07-23**

- [x] Define `VoiceCommand`, registry, editable aliases and enable/disable configuration.
- [x] Add conservative command-intent detection and dangerous-action confirmation.
- [x] Connect newline/paragraph/punctuation/edit/insert/copy/transform/settings/
      repeat/clear/note commands and undo.
- [x] Add selected-text acquisition/replacement with safe clipboard rollback and a
      global transformation shortcut.
- [x] Replace secondary shortcut globals with action IDs and persisted preset bindings.
- [x] Add command false-positive, confirmation, shortcut-conflict and selection
      failure tests.

The hold-to-talk hook remains a dedicated low-level input path because Electron's
global shortcut API has no key-up event. All other global actions now have stable
IDs and persisted bindings. Dangerous commands are executed only after a native
confirmation dialog; command phrases are exact-match by default and can be edited
or disabled in settings.

## Stage 6 — active application integrations

Status: **completed on 2026-07-23**

- [x] Define `ActiveApplicationContext`, `AppIntegration` and integration registry.
- [x] Implement platform active-window adapters and secure-field capability.
- [x] Add generic browser, messenger, mail, IDE and text-editor integrations.
- [x] Add initial profiles for Telegram, Slack, Discord, Teams, Mail, Outlook,
      Gmail, Notion, Obsidian, VS Code and JetBrains.
- [x] Add per-app insertion, transformation, shortcut and blacklist rules.
- [x] Disable prose formatting by default in IDE/code contexts.

Specific profiles precede generic browser/editor matching. User rules can match a
profile ID or literal application identity fragment and override insertion,
transformation and contextual shortcut behavior. A blocked rule routes text to
the internal editor instead of typing into the target. Secure fields remain a
separate non-overridable insertion safety check.

## Stage 7 — product data and settings

Status: **in progress**

- [x] Add SQLite repositories and idempotent migrations from `settings.json`.
- [x] Add independent, opt-in history retention and deletion controls.
- [x] Add templates, pinned fragments and optional clipboard history.
- [x] Add sensitive-data heuristics, application exclusions and retention TTL.
- [x] Add import/export with schema validation and secret exclusion.
- [x] Complete system/light/dark theme handling, including live OS changes.
- [ ] Complete Russian/English localization across every renderer surface.
- [x] Migrate onboarding to a feature-based React page and controller.
- [x] Migrate the remaining legacy settings panels to feature-based React pages.

SQLite is now the source of truth; the legacy JSON file is read only for a
one-time, idempotent import and is not deleted. Clipboard history never polls the
system clipboard: it records only explicit Cure Voicer copy results after opt-in,
applies retention on reads, and rejects credential/private-key/payment-card
patterns and excluded applications. Templates support pinning, search and
optional global insertion shortcuts.

The onboarding flow is now a React feature backed by a framework-independent
controller. It no longer mutates a parallel tree of imperative DOM elements.
The shared typed localization store currently covers the complete onboarding
flow, vocabulary and history, and is the migration path for the remaining
settings surfaces. Vocabulary and history now use React pages backed by a shared
external data store, so dictation results can update them without DOM mutation.
The models page is also React-owned; ASR/Qwen status remains authoritative in
main and reaches the page through a presentation-only external store. Explicit
light/dark preferences override the OS correctly, while the system preference
tracks live color-scheme changes.

The General and Dictation panels are now React-owned as well. Recording,
silence detection, microphone enumeration and native hold-key capture remain in
the renderer service and publish presentation state through a typed external
controller; React components do not call IPC directly. The former markup is
kept hidden for one migration checkpoint and will be removed together with the
static settings shell after the bilingual shell is verified.

## Stage 8 — hardening, diagnostics and release

Status: **in progress**

- [x] Complete threat model and security documentation.
- [x] Store API secrets with `safeStorage`; add explicit cloud consent.
- [x] Add diagnostics page/report with redaction and service probes.
- [x] Add user-data deletion and model/cache controls.
- [x] Add IPC integration, Electron smoke and Playwright E2E suites.
- [x] Test packaged macOS/Windows builds and native runtime loading.
- [ ] Configure macOS entitlements/signing/notarization and Windows signing.
- [x] Add signed auto-update policy with staged rollout and rollback notes.
- [x] Finish all extension and platform documentation.

The first Electron E2E test caught and fixed a production-only preload failure:
Rollup had extracted IPC constants into a shared chunk that Electron's sandboxed
preload cannot require. Both preload bundles are now self-contained, and the E2E
asserts that Node/raw IPC are absent while the typed diagnostics capability is
present. Production dependency audit currently reports zero vulnerabilities;
dev-tool advisories remain isolated from packaged dependencies.

The macOS arm64 `.app`, DMG and ZIP were built locally and the packaged app
passed a separate smoke launch; both arm64 Swift helpers, usage descriptions and
the generated branded ICNS were inspected in the bundle. Signing was skipped
because no Developer ID identity is installed. Windows workflow run
`30009747899` passed source checks, Electron E2E, native runtime loading, x64
portable/NSIS packaging, packaged-app smoke launch, checksum generation and
artifact upload. The workflow accepts optional Authenticode secrets. The signed
update rollout/rollback policy is documented and enforced: update checks remain
disabled when the installed application does not have a valid package signature.
Actual macOS notarization and Windows Authenticode verification remain blocked
on release credentials rather than source implementation.

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
