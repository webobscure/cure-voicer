import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { ActiveApplicationProvider } from '../../modules/insertion/ports'
import type { ActiveApplicationContext } from '../../shared/types/insertion'
import { resolveMacInputBinary } from './platform-text-input'

const execFileAsync = promisify(execFile)
const macContextSchema = z.object({
  applicationName: z.string().nullable(),
  applicationId: z.string().nullable(),
  processId: z.number().int().positive().nullable(),
  isSecureField: z.boolean()
})

export class SystemActiveApplicationProvider implements ActiveApplicationProvider {
  async getActiveApplication(): Promise<ActiveApplicationContext> {
    if (process.platform === 'darwin') return getMacActiveApplication()
    if (process.platform === 'win32') return getWindowsActiveApplication()
    return { platform: 'unknown', capturedAt: new Date().toISOString() }
  }
}

async function getMacActiveApplication(): Promise<ActiveApplicationContext> {
  const nativeContext = await execFileAsync(resolveMacInputBinary(), ['context'], {
    timeout: 3_000
  }).catch(() => null)
  if (nativeContext) {
    const parsed = macContextSchema.parse(JSON.parse(nativeContext.stdout))
    return {
      platform: 'darwin',
      applicationName: parsed.applicationName ?? undefined,
      applicationId: parsed.applicationId ?? undefined,
      processId: parsed.processId ?? undefined,
      isSecureField: parsed.isSecureField,
      capturedAt: new Date().toISOString()
    }
  }

  const script = [
    'tell application "System Events"',
    'set frontProcess to first application process whose frontmost is true',
    'set processName to name of frontProcess',
    'set processId to unix id of frontProcess',
    'try',
    'set bundleId to bundle identifier of frontProcess',
    'on error',
    'set bundleId to ""',
    'end try',
    'return processName & linefeed & processId & linefeed & bundleId',
    'end tell'
  ].join('\n')
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script], {
    timeout: 3_000
  })
  const [applicationName, processId, applicationId] = stdout.trim().split('\n')
  return {
    platform: 'darwin',
    applicationName,
    applicationId,
    processId: Number(processId) || undefined,
    capturedAt: new Date().toISOString()
  }
}

async function getWindowsActiveApplication(): Promise<ActiveApplicationContext> {
  const command = [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class CVWindow { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); }'",
    '$processIdentifier=0',
    '$handle=[CVWindow]::GetForegroundWindow()',
    '[CVWindow]::GetWindowThreadProcessId($handle, [ref]$processIdentifier) | Out-Null',
    '$process=Get-Process -Id $processIdentifier',
    'Write-Output $processIdentifier',
    'Write-Output $process.ProcessName',
    'Write-Output $process.Path'
  ].join(';')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
    { windowsHide: true, timeout: 3_000 }
  )
  const [processId, applicationName, executablePath] = stdout.trim().split(/\r?\n/u)
  return {
    platform: 'win32',
    processId: Number(processId) || undefined,
    applicationName,
    executablePath,
    capturedAt: new Date().toISOString()
  }
}
