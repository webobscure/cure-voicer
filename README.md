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
- local recording storage;
- local Parakeet TDT 0.6B V3 recognition on Apple Silicon through FluidAudio/Core ML;
- local Parakeet TDT 0.6B V3 INT8 recognition on Windows x64 through sherpa-onnx;
- clipboard delivery and automatic paste into the field that had focus.

Audio and transcription stay on the device. The platform-specific runtime downloads
the Parakeet model once on the first run and keeps it in its local model cache.

## Development

```bash
npm install
npm run build:macos-asr
npm run dev
```

Run all non-interactive checks:

```bash
npm run check
```

Build Windows x64 portable and NSIS packages on Windows:

```bash
npm run pack:win
```

The same build is available through the `Windows x64 beta` GitHub Actions
workflow. See [docs/WINDOWS_BETA.md](docs/WINDOWS_BETA.md) for tester setup and
the QA checklist.

The default activation mode is hold-to-talk: hold right Option on macOS or right
Ctrl on Windows, speak, and release to transcribe and insert. Toggle mode with
`CommandOrControl+Shift+Space` is available in settings.

On macOS, automatic paste requires **System Settings → Privacy & Security →
Accessibility** access for Cure Voicer/Electron. If access has not been granted,
the recognized text remains safely available in the clipboard.

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

ASR adapters:

- macOS Apple Silicon: implemented with FluidAudio/Core ML and Parakeet TDT 0.6B V3.
- Windows x64: implemented in an isolated Electron utility process with
  sherpa-onnx and the SHA-256-verified ONNX Parakeet INT8 model.
