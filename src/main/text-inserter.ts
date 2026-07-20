import { clipboard, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { TextInsertionStatus } from '../shared/contracts'

const execFileAsync = promisify(execFile)

export class TextInserter {
  async insert(text: string): Promise<TextInsertionStatus> {
    if (!text) return 'skipped'

    clipboard.writeText(text)

    if (process.platform === 'darwin') {
      if (!systemPreferences.isTrustedAccessibilityClient(false)) {
        systemPreferences.isTrustedAccessibilityClient(true)
        return 'clipboard'
      }

      await waitForClipboard()
      await execFileAsync('/usr/bin/osascript', [
        '-e',
        'tell application "System Events" to keystroke "v" using command down'
      ])
      return 'pasted'
    }

    if (process.platform === 'win32') {
      await waitForClipboard()
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"
      ])
      return 'pasted'
    }

    return 'clipboard'
  }
}

function waitForClipboard(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 35))
}
