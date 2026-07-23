# Adding an application integration

Application integrations are policy objects. They do not call Electron, inspect
the clipboard or insert text themselves. This keeps matching separate from the
security-sensitive insertion pipeline.

## 1. Add a profile

Built-in profiles live in
`src/modules/integrations/built-in-integrations.ts`. Put a more specific profile
before a generic one. For example, Gmail must precede the browser profile because
both match the same active Chrome window.

Each profile defines:

- stable `id`;
- identifiers, display names, executable names and/or window-title fragments;
- a preferred insertion strategy and fallbacks;
- a transformation preset, or `null` when automatic prose formatting must be
  disabled.

Matching is case-insensitive and treats patterns as literal fragments. Do not put
regular expressions or shell commands in a profile.

## 2. Keep platform detection behind the active-app provider

macOS obtains bundle ID, PID, focused-window title and secure-field state through
the signed Accessibility helper. Windows obtains PID, executable, title and token
elevation through Win32/PowerShell. Integration code consumes only the shared
`ActiveApplicationContext` contract.

## 3. Test precedence and policy

Add tests to `tests/integration-registry.test.ts` for:

- positive and negative matching;
- precedence over broader profiles;
- insertion mode and fallback order;
- transformation choice;
- user override and blocked-rule behaviour.

## User rules

Settings store user rules as data, never executable code. A rule can match a
profile ID or a fragment of bundle ID, application name, executable path or window
title. It may override insertion, transformation and shortcut policy, or force the
result into the internal editor. Disabled rules are ignored.
