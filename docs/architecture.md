# Architecture

## Direction

Cure Voicer is migrating from a prototype with renderer-driven recording and a
monolithic Electron main process to a domain-oriented desktop architecture. The
migration is incremental: stable native speech providers remain in service while
new modules take ownership of state, policy and platform capabilities.

## Process model

```text
┌──────────────────────────────┐
│ Settings / editor renderer   │  React views and Web Audio capture port
└──────────────┬───────────────┘
               │ capability-scoped preload + validated DTOs
┌──────────────▼───────────────┐
│ Electron main process        │  composition, state machine, policy, storage
├──────────────────────────────┤
│ dictation  insertion         │
│ commands   integrations      │
│ settings   diagnostics       │
└──────┬─────────────┬─────────┘
       │             │ platform interfaces
┌──────▼──────┐ ┌────▼─────────┐
│ macOS       │ │ Windows      │
│ AX/Core ML  │ │ Win32/ONNX   │
└──────┬──────┘ └────┬─────────┘
       │             │ isolated protocols
┌──────▼─────────────▼─────────┐
│ Swift helper / utilityProcess│
└──────────────────────────────┘

┌──────────────────────────────┐
│ Floating orb renderer        │  Separate minimal preload; no history/settings writes
└──────────────────────────────┘
```

## Ownership rules

- Main owns the authoritative dictation state and all privileged actions.
- Renderer owns only view state and microphone capture mechanics.
- Domain modules do not import Electron.
- Platform adapters do not choose product policy.
- IPC DTOs are serializable, bounded and validated at runtime.
- Providers receive cancellation signals and return named errors/results.
- No component logs transcript, clipboard or audio payloads.

## Module boundaries

### Dictation

Coordinates capture, recognition, transformation, commands, editor policy and
insertion using one state machine and operation ID.

### Transcription

Selects a `SpeechRecognitionProvider`. Existing FluidAudio and sherpa-onnx
engines become local provider adapters. Cloud/system/backend providers are
disabled until configured and consented.

### Insertion

Selects a `TextInsertionProvider` from application policy and capability probes.
Keyboard/accessibility precede clipboard-safe. Clipboard-only and editor are
explicit outcomes, not hidden side effects.

### Clipboard

Provides snapshot, ownership, mutation detection and restoration primitives.
It never monitors the clipboard continuously unless history is explicitly
enabled.

### Transformations and commands

Registries contain small implementations. The dictation use case decides when
they may run; UI components never execute arbitrary OS commands.

### Integrations

Match a sanitized active-application context and return insertion/transformation
policy. Integration code cannot directly insert or read secrets.

### Settings/history

Repositories isolate persistence. Schemas are versioned and migrations are
idempotent. Secret values are references to protected storage, not database text.

## Current migration seam

The current `RecordingService` remains the compatibility pipeline. New domain
contracts live in `src/shared/types`; Zod validation lives in
`src/shared/validation`. The settings renderer now hosts the first React feature
(diagnostics) while the working imperative settings and recorder remain in place.
The orb has a separate, minimal preload.

See `rewrite-plan.md` for stage status and exit criteria.

