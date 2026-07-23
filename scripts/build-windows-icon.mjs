import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const sourcePath = path.join(root, 'assets', 'branding', 'cure-voicer-keycap-c-logo-v3.png')
const outputPath = path.join(root, 'assets', 'branding', 'cure-voicer.ico')
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'cure-voicer-windows-icon-'))
const architecture = process.arch === 'arm64' ? 'arm64' : 'x64'
const binaryDirectory = path.join(root, 'node_modules', 'app-builder-bin')
const binary = process.platform === 'darwin'
  ? path.join(binaryDirectory, 'mac', `app-builder_${architecture}`)
  : process.platform === 'win32'
    ? path.join(binaryDirectory, 'win', architecture, 'app-builder.exe')
    : path.join(binaryDirectory, 'linux', architecture, 'app-builder')

try {
  await execFileAsync(binary, [
    'icon',
    '--format=ico',
    `--root=${root}`,
    `--input=${sourcePath}`,
    `--out=${temporaryDirectory}`
  ])
  await copyFile(path.join(temporaryDirectory, 'icon.ico'), outputPath)
  console.info(`Created ${outputPath}`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
