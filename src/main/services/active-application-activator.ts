import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ActiveApplicationContext } from '../../shared/types/insertion'
import { resolveMacInputBinary } from './platform-text-input'

const execFileAsync = promisify(execFile)

export class ActiveApplicationActivator {
  async activate(context: ActiveApplicationContext): Promise<void> {
    if (!context.processId) throw new Error('Target application process is unavailable')
    if (process.platform === 'darwin') {
      await execFileAsync(resolveMacInputBinary(), ['activate', String(context.processId)], {
        timeout: 3_000
      })
      await wait(120)
      return
    }
    if (process.platform === 'win32') {
      const command = [
        "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class CVActivate { [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h); }'",
        `$process=Get-Process -Id ${context.processId}`,
        'if (-not [CVActivate]::SetForegroundWindow($process.MainWindowHandle)) { exit 2 }'
      ].join(';')
      await execFileAsync(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
        { windowsHide: true, timeout: 3_000 }
      )
      await wait(120)
      return
    }
    throw new Error('Application activation is unsupported on this platform')
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
