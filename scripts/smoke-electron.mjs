import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const electronBinary = path.join(
  process.cwd(),
  'node_modules',
  'electron',
  'dist',
  process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron.exe'
)
const userData = await mkdtemp(path.join(os.tmpdir(), 'cure-voicer-smoke-'))

try {
  await runSmokeTest(electronBinary, userData)
} finally {
  await rm(userData, { recursive: true, force: true })
}

async function runSmokeTest(binary, profileDirectory) {
  await new Promise((resolve, reject) => {
    const child = spawn(binary, ['.'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CURE_VOICER_SMOKE_TEST: '1',
        CURE_VOICER_SMOKE_USER_DATA: profileDirectory
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let output = ''
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Electron smoke test timed out.\n${output}`))
    }, 20_000)

    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += String(chunk)
    })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0 && output.includes('CURE_VOICER_SMOKE_OK')) resolve()
      else reject(new Error(`Electron smoke test failed (${signal ?? `code ${code}`}).\n${output}`))
    })
  })
  console.info('Electron smoke test passed')
}

