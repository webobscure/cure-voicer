import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function isCurrentApplicationSigned(): Promise<boolean> {
  if (!process.execPath) return false
  if (process.platform === 'darwin') {
    const appBundle = applicationBundleFromExecutable(process.execPath)
    if (!appBundle) return false
    return execFileAsync('/usr/bin/codesign', ['--verify', '--deep', '--strict', appBundle], {
      timeout: 10_000
    }).then(() => true, () => false)
  }
  if (process.platform === 'win32') {
    const command = [
      '$signature=Get-AuthenticodeSignature -LiteralPath $args[0]',
      'if ($signature.Status -eq "Valid") { exit 0 } else { exit 1 }'
    ].join(';')
    return execFileAsync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command, process.execPath
    ], { windowsHide: true, timeout: 10_000 }).then(() => true, () => false)
  }
  return false
}

function applicationBundleFromExecutable(executable: string): string | null {
  const marker = '.app/Contents/MacOS/'
  const index = executable.indexOf(marker)
  return index >= 0 ? executable.slice(0, index + 4) : null
}
