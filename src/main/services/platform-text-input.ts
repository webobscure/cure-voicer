import { app, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { PlatformTextInputPort } from '../../modules/insertion/ports'
import type { ActiveApplicationContext } from '../../shared/types/insertion'
import { MACOS_PASTE_SCRIPT } from '../../shared/platform-shortcuts'
import {
  canUseAccessibilityInsertion,
  canUseKeyboardInsertion,
  canUsePasteShortcut
} from '../../platform/input-capabilities'

const execFileAsync = promisify(execFile)

export class PlatformTextInputService implements PlatformTextInputPort {
  constructor(private readonly macInputBinary = resolveMacInputBinary()) {}

  async supportsKeyboardInsertion(context: ActiveApplicationContext): Promise<boolean> {
    const macRequirementsMet =
      process.platform === 'darwin' &&
      systemPreferences.isTrustedAccessibilityClient(false) &&
      (await fileExists(this.macInputBinary))
    return canUseKeyboardInsertion(process.platform, context, macRequirementsMet)
  }

  async supportsAccessibilityInsertion(
    context: ActiveApplicationContext
  ): Promise<boolean> {
    const macRequirementsMet =
      process.platform === 'darwin' &&
      systemPreferences.isTrustedAccessibilityClient(false) &&
      (await fileExists(this.macInputBinary))
    return canUseAccessibilityInsertion(
      process.platform,
      context,
      macRequirementsMet
    )
  }

  async supportsPasteShortcut(context: ActiveApplicationContext): Promise<boolean> {
    return canUsePasteShortcut(
      process.platform,
      context,
      process.platform === 'darwin' &&
        systemPreferences.isTrustedAccessibilityClient(false)
    )
  }

  async insertWithKeyboard(text: string, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)
    if (process.platform === 'darwin') {
      await execFileAsync(this.macInputBinary, ['type', encodeText(text)], {
        timeout: 15_000,
        signal
      })
      return
    }
    if (process.platform === 'win32') {
      await runWindowsUnicodeInput(text, signal)
      return
    }
    throw new Error('Direct keyboard insertion is unsupported on this platform')
  }

  async insertWithAccessibility(text: string, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)
    if (process.platform !== 'darwin') {
      throw new Error('Accessibility insertion is unsupported on this platform')
    }
    await execFileAsync(this.macInputBinary, ['accessibility', encodeText(text)], {
      timeout: 15_000,
      signal
    })
  }

  async pasteShortcut(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)
    if (process.platform === 'darwin') {
      await execFileAsync('/usr/bin/osascript', ['-e', MACOS_PASTE_SCRIPT], {
        timeout: 5_000,
        signal
      })
      return
    }
    if (process.platform === 'win32') {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-WindowStyle',
          'Hidden',
          '-Command',
          "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"
        ],
        { windowsHide: true, timeout: 5_000, signal }
      )
      return
    }
    throw new Error('Paste shortcut is unsupported on this platform')
  }
}

const windowsUnicodeScript = String.raw`
using System;
using System.Runtime.InteropServices;
public static class CureVoicerUnicodeInput {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion U; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
  const uint INPUT_KEYBOARD = 1; const uint KEYEVENTF_KEYUP = 2; const uint KEYEVENTF_UNICODE = 4;
  public static void Type(string value) {
    foreach (char character in value) {
      var down = new INPUT { type = INPUT_KEYBOARD, U = new InputUnion { ki = new KEYBDINPUT { wScan = character, dwFlags = KEYEVENTF_UNICODE } } };
      var up = new INPUT { type = INPUT_KEYBOARD, U = new InputUnion { ki = new KEYBDINPUT { wScan = character, dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP } } };
      var inputs = new INPUT[] { down, up };
      if (SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT))) != 2) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
  }
}`

async function runWindowsUnicodeInput(text: string, signal?: AbortSignal): Promise<void> {
  const command = [
    `$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(windowsUnicodeScript).toString('base64')}'))`,
    '$value=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($args[0]))',
    'Add-Type -TypeDefinition $source',
    '[CureVoicerUnicodeInput]::Type($value)'
  ].join(';')
  await execFileAsync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      command,
      encodeText(text)
    ],
    { windowsHide: true, timeout: 15_000, signal }
  )
}

export function resolveMacInputBinary(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'bin', 'cure-voicer-input')
  return path.join(app.getAppPath(), 'native', 'macos-asr', '.build', 'release', 'cure-voicer-input')
}

function encodeText(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

async function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false
  )
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Insertion operation was cancelled')
}
