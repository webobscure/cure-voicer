import { clipboard, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { TextInsertionStatus } from '../shared/contracts'
import { MACOS_PASTE_SCRIPT } from '../shared/platform-shortcuts'

const execFileAsync = promisify(execFile)

let textInsertionInProgress = false

export function isTextInsertionInProgress(): boolean {
  return textInsertionInProgress
}

export class TextInserter {
  async insert(text: string, autoPaste = true): Promise<TextInsertionStatus> {
    if (!text) return 'skipped'

    clipboard.writeText(text)
    if (!autoPaste) return 'clipboard'

    if (process.platform === 'darwin') {
      if (!systemPreferences.isTrustedAccessibilityClient(false)) {
        systemPreferences.isTrustedAccessibilityClient(true)
        return 'clipboard'
      }

      await waitForClipboard()
      textInsertionInProgress = true
      try {
        // macOS virtual key code 9 is the physical V key. Unlike `keystroke
        // "v"`, it does not pass through the currently selected input source.
        await execFileAsync('/usr/bin/osascript', ['-e', MACOS_PASTE_SCRIPT])
      } finally {
        textInsertionInProgress = false
      }
      return 'pasted'
    }

    if (process.platform === 'win32') {
      await waitForClipboard()
      textInsertionInProgress = true
      try {
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
          { windowsHide: true, timeout: 5_000 }
        )
        return 'pasted'
      } catch (error) {
        console.warn('Windows automatic paste failed; text remains in clipboard', error)
        return 'clipboard'
      } finally {
        // Ignore the synthetic Ctrl+V in the global hold-key hook. This is
        // especially important when the user selected left Ctrl for dictation.
        textInsertionInProgress = false
      }
    }

    return 'clipboard'
  }
}

function waitForClipboard(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 35))
}
