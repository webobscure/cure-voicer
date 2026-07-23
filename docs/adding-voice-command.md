# Adding a voice command

Commands implement `VoiceCommand` from `src/shared/types/commands.ts` and are
registered in `VoiceCommandRegistry`. Keep OS/UI work behind an action port; a
command object should only interpret context and return `VoiceCommandResult`.

1. Choose a stable command ID.
2. Add conservative Russian and English phrases.
3. Implement the action through `VoiceCommandActions` or another injected port.
4. Set `dangerous: true` for destructive or externally visible actions.
5. Add exact-match, false-positive, disabled/custom-alias and confirmation tests.

The detector matches a complete normalized phrase or a phrase following the
explicit `команда`/`command` prefix. Do not weaken this rule for convenience:
ordinary dictated prose must not execute commands accidentally.

Dangerous commands return `requiresConfirmation: true` until the caller repeats
execution with `context.confirmed`. Command configuration persists enabled state
and custom phrases through the settings repository once the stage 7 data
migration is active.

Inline typography such as “новая строка”, “новый абзац” and “поставь точку” is
handled by the deterministic transcript postprocessor, not by side-effecting
command actions.

