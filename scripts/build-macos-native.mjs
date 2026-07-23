import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

if (process.platform !== 'darwin') {
  console.error('macOS native helpers can only be built on macOS')
  process.exit(1)
}

const packagePath = path.resolve('native/macos-asr')
const cachePath = path.join(packagePath, '.build', 'clang-module-cache')
const requestedSdk = process.env.CURE_VOICER_MACOS_SDK
const baseArguments = ['build', '-c', 'release', '--package-path', packagePath]
const environment = { ...process.env, CLANG_MODULE_CACHE_PATH: cachePath }

if (requestedSdk) {
  process.exitCode = await run([...baseArguments, '--sdk', requestedSdk])
} else {
  const defaultResult = await run(baseArguments, true)
  if (defaultResult === 0) process.exitCode = 0
  else {
    const candidates = await versionedCommandLineToolsSdks()
    let exitCode = defaultResult
    for (const sdk of candidates) {
      console.warn(`Default macOS SDK failed; retrying with ${sdk}`)
      exitCode = await run([...baseArguments, '--sdk', sdk])
      if (exitCode === 0) break
    }
    process.exitCode = exitCode
  }
}

async function run(arguments_, quietFailure = false) {
  return new Promise((resolve) => {
    const child = spawn('swift', arguments_, {
      env: environment,
      stdio: quietFailure ? ['inherit', 'inherit', 'pipe'] : 'inherit'
    })
    let stderr = ''
    if (quietFailure && child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }
    child.on('error', (error) => {
      console.error(error.message)
      resolve(1)
    })
    child.on('exit', (code) => {
      if (quietFailure && code !== 0 && stderr) console.warn(stderr.trim())
      resolve(code ?? 1)
    })
  })
}

async function versionedCommandLineToolsSdks() {
  const directory = '/Library/Developer/CommandLineTools/SDKs'
  const entries = await readdir(directory).catch(() => [])
  return entries
    .filter((entry) => /^MacOSX\d+(?:\.\d+)?\.sdk$/u.test(entry))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map((entry) => path.join(directory, entry))
}
