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

The `afterSign` hook notarizes the signed `.app` with `notarytool`, staples the
ticket, validates it, and only then lets electron-builder create the DMG and ZIP.
Local builds skip the hook when credentials are absent. Tagged CI releases fail
closed unless all signing secrets are present:

- `MACOS_CSC_LINK`: base64/P12 Developer ID Application certificate accepted by electron-builder;
- `MACOS_CSC_KEY_PASSWORD`: certificate password;
- `APPLE_API_KEY_P8`: App Store Connect API private-key contents;
- `APPLE_API_KEY_ID`: API key ID;
- `APPLE_API_ISSUER`: API issuer ID.

The macOS workflow verifies `codesign`, Gatekeeper assessment and the stapled
ticket before uploading artifacts. These checks cannot be completed locally
without the project owner's Apple Developer credentials.
