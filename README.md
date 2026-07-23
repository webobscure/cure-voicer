# Cure Voicer

Local-first desktop dictation for macOS and Windows.

## Current milestone

The application currently provides:

- a secure Electron shell with an isolated preload API;
- tray/menu-bar operation and a global recording shortcut;
- a focus-safe, always-on-top Siri-style voice orb that reacts to microphone level;
- a draggable voice orb with saved custom position and left/center/right presets;
- microphone capture with a live level meter;
- conversion to mono 16 kHz PCM WAV;
- optional local recording storage (disabled by default for new profiles);
- local Parakeet TDT 0.6B V3 recognition on Apple Silicon through FluidAudio/Core ML;
- local Parakeet TDT 0.6B V3 INT8 recognition on Windows x64 through sherpa-onnx;
- direct Unicode insertion without the clipboard, with accessibility,
  transactional clipboard and internal-editor fallbacks.

Audio and transcription stay on the device. The platform-specific runtime downloads
the Parakeet model once on the first run and keeps it in its local model cache.

## Development prerequisites

- Node.js 24;
- npm;
- Xcode 16 / Swift 6 on macOS when building the FluidAudio helper;
- Windows 11 x64 for producing and validating Windows installers.

## Install and run

```bash
npm install
npm run build:macos-asr
npm run dev
```

Windows development does not use the Swift build step:

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
npm run test:e2e
```

Run all non-GUI checks:

```bash
npm run check
```

## Packaging

Build an unsigned macOS Apple Silicon DMG and ZIP:

```bash
npm run pack:mac
```

Tagged release builds use `.github/workflows/macos-build.yml` and
`.github/workflows/windows-build.yml`. Required signing secret names and the
fail-closed verification steps are documented in
[`docs/platform-macos.md`](docs/platform-macos.md) and
[`docs/platform-windows.md`](docs/platform-windows.md).

Build Windows x64 portable and NSIS packages on Windows:

```bash
npm run pack:win
```

Build Windows artifacts separately when needed:

```bash
npm run pack:win:portable
npm run pack:win:nsis
```

The same build is available through the `Windows x64 beta` GitHub Actions
workflow. See [docs/WINDOWS_BETA.md](docs/WINDOWS_BETA.md) for tester setup and
the QA checklist.

The default activation mode is hold-to-talk: hold right Option on macOS or right
Ctrl on Windows, speak, and release to transcribe and insert. Toggle mode with
`CommandOrControl+Shift+Space` is available in settings.

On macOS, global hotkeys and external insertion require **System Settings →
Privacy & Security → Accessibility** access for Cure Voicer. Direct insertion
uses a signed Swift helper and does not depend on the current keyboard layout.

The orb can be moved by holding the left mouse button over it. Presets are
available under **Settings → Dictation**; a manually dragged position is saved
and restored on the next launch.

Right-click the orb to open its context menu. From there you can open settings,
hide the orb until the next dictation hotkey, or quit Cure Voicer.

## Architecture

- `src/main` — Electron lifecycle, tray, permissions, recording persistence, ASR and paste orchestration.
- `native/macos-asr` — persistent Swift/FluidAudio Parakeet V3 helper.
- `src/preload` — the narrow renderer-to-main IPC bridge.
- `src/renderer` — Liquid-style settings, the transparent voice overlay, and Web Audio capture.
- `src/shared` — cross-process contracts.
- `tests` — audio pipeline unit tests.

The application is being migrated incrementally to domain modules, React views,
runtime-validated IPC and provider-based insertion. See:

- [current-state audit](docs/current-state-audit.md);
- [rewrite plan](docs/rewrite-plan.md);
- [architecture](docs/architecture.md);
- [security](docs/security.md);
- [testing](docs/testing.md);
- [text insertion](docs/text-insertion.md);
- [clipboard safety](docs/clipboard-safety.md);
- [macOS platform notes](docs/platform-macos.md);
- [Windows platform notes](docs/platform-windows.md).
- [adding an integration](docs/adding-integration.md);
- [adding a voice command](docs/adding-voice-command.md);
- [adding a transcription provider](docs/adding-transcription-provider.md).
- [signed update policy](docs/update-policy.md).

ASR adapters:

- macOS Apple Silicon: implemented with FluidAudio/Core ML and Parakeet TDT 0.6B V3.
- Windows x64: implemented in an isolated Electron utility process with
  sherpa-onnx and the SHA-256-verified ONNX Parakeet INT8 model.
