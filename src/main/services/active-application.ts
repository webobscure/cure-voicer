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
  windowTitle: z.string().nullable(),
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
      windowTitle: parsed.windowTitle ?? undefined,
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
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class CVWindow { [StructLayout(LayoutKind.Sequential)] struct TOKEN_ELEVATION { public int TokenIsElevated; } [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); [DllImport(\"kernel32.dll\")] static extern IntPtr OpenProcess(uint access, bool inherit, uint id); [DllImport(\"advapi32.dll\", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token); [DllImport(\"advapi32.dll\", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int tokenClass, out TOKEN_ELEVATION elevation, int length, out int returned); [DllImport(\"kernel32.dll\")] static extern bool CloseHandle(IntPtr handle); public static bool IsElevated(uint id) { IntPtr process=OpenProcess(0x1000, false, id); if(process==IntPtr.Zero) return true; IntPtr token; if(!OpenProcessToken(process, 0x0008, out token)) { CloseHandle(process); return true; } TOKEN_ELEVATION elevation; int returned; bool ok=GetTokenInformation(token, 20, out elevation, Marshal.SizeOf(typeof(TOKEN_ELEVATION)), out returned); CloseHandle(token); CloseHandle(process); return !ok || elevation.TokenIsElevated != 0; } }'",
    '$processIdentifier=0',
    '$handle=[CVWindow]::GetForegroundWindow()',
    '[CVWindow]::GetWindowThreadProcessId($handle, [ref]$processIdentifier) | Out-Null',
    '$process=Get-Process -Id $processIdentifier',
    'Write-Output $processIdentifier',
    'Write-Output $process.ProcessName',
    'try { Write-Output $process.Path } catch { Write-Output "" }',
    'Write-Output $process.MainWindowTitle',
    'Write-Output ([CVWindow]::IsElevated([uint32]$processIdentifier))'
  ].join(';')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
    { windowsHide: true, timeout: 3_000 }
  )
  const [processId, applicationName, executablePath, windowTitle, elevated] = stdout.trim().split(/\r?\n/u)
  return {
    platform: 'win32',
    processId: Number(processId) || undefined,
    applicationName,
    executablePath,
    windowTitle,
    isElevated: elevated?.trim().toLocaleLowerCase() === 'true',
    capturedAt: new Date().toISOString()
  }
}
