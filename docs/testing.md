# Testing

## Local checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
```

`npm run check` runs typecheck, lint, unit tests and the production build. The
Electron smoke test is separate because it opens a real application process and
may require desktop permissions in a sandboxed development environment.

## Current suites

- audio resampling and WAV encoding;
- deterministic transcript post-processing and vocabulary;
- local smart-correction prompt/output safeguards;
- Windows model manifest integrity metadata;
- platform shortcut construction;
- settings schema/default/migration tests;
- renderer URL policy tests;
- validated IPC handler tests;
- structured log redaction tests.

## Required insertion scenarios

The stage 3 harness will use fake platform/clipboard ports and a deterministic
scheduler for:

1. Punto Switcher or a clipboard manager mutating temporary text;
2. a user copying new data before restoration;
3. two insertion requests arriving concurrently;
4. target application changing while recognition runs;
5. target rejecting simulated keyboard input;
6. cancellation at every phase;
7. recognition/transform failure before insertion;
8. missing macOS Accessibility permission;
9. Windows elevated target mismatch;
10. Cyrillic, Latin, emoji and multiline Unicode;
11. IDE, browser and messenger integration policy.

Tests must assert that newer clipboard data survives and that logs contain no
text payload.

## Platform validation

### macOS

- unsigned local development launch;
- microphone and Accessibility grant/revocation;
- hidden-window hold-to-talk;
- FluidAudio helper packaged path;
- direct/accessibility insertion in native and Chromium apps;
- signed/notarized package before release.

### Windows

- Windows 11 x64 standard-user install and portable launch;
- microphone permission;
- native runtime load in CI;
- Unicode input in Notepad, Office, browsers, messengers and IDEs;
- elevated target safe failure;
- signed NSIS/portable artifacts before public release.

