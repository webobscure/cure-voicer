# Windows platform notes

Windows x64 transcription uses the existing sherpa-onnx utility process and
verified Parakeet model download.

Direct text input uses Win32 `SendInput` with `KEYEVENTF_UNICODE`, so Cyrillic,
Latin text, surrogate-pair emoji and newlines do not depend on the current
keyboard layout and do not use the clipboard. A fixed C# bridge is compiled by
PowerShell; dictated text is passed as base64 data.

The foreground window PID, process name, executable path, window title and token
elevation are captured through `GetForegroundWindow`/`GetWindowThreadProcessId`
and token inspection. A normal process cannot inject
input into a higher-integrity target because of UIPI. Cure Voicer does not ask
for elevation; that provider fails and the policy falls back to a safe mode.

Microphone permission is managed by Windows privacy settings. Distribution
builds use per-user NSIS and portable x64 targets. Production releases should be
Authenticode-signed to reduce SmartScreen warnings; SmartScreen reputation
cannot be bypassed safely in application code.

The Windows workflow passes `WINDOWS_CSC_LINK` and
`WINDOWS_CSC_KEY_PASSWORD` to electron-builder. Tagged production builds should
configure both repository secrets and verify the resulting signature before
distribution. Signing establishes publisher identity but does not instantly
guarantee SmartScreen reputation; EV signing or reputation accumulated over
time may still be required.
