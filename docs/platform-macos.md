# macOS platform notes

Local transcription uses the existing FluidAudio/Parakeet helper. Direct text
input and active-field inspection use the separate `cure-voicer-input` Swift
executable in the same Swift package.

Required permissions:

- Microphone for renderer audio capture.
- Accessibility for global hold-key input, Unicode events, focused-element
  inspection and accessibility insertion.
- Input Monitoring may be required by macOS for the global keyboard hook on
  some system configurations.

The input helper accepts fixed commands plus base64 UTF-8 data. It never invokes
a shell. It detects `AXSecureTextField` and reports only application identity,
PID, focused-window title and the secure-field boolean; it does not read field
contents. Window titles are used for in-memory integration matching and are not
included in diagnostics or logs.

Build both helpers with `npm run build:macos-asr`. The build script accepts
`CURE_VOICER_MACOS_SDK=/path/to/MacOSX.sdk` and retries versioned Command Line
Tools SDKs when the default compiler/SDK pair is mismatched. Packaged builds put
both executables under `Contents/Resources/bin`.

Release builds require a Developer ID Application certificate and notarization.
The repository supplies hardened-runtime entitlements, microphone and Apple
Events usage descriptions; CI/release credentials must provide signing identity
and Apple notarization credentials. Unsigned local DMGs are development artifacts
and must not be offered through automatic update.
