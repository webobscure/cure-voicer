import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const sourcePath = path.join(root, 'assets', 'branding', 'cure-voicer-liquid-glass-logo.png')
const outputPath = path.join(root, 'assets', 'branding', 'cure-voicer.icns')
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'cure-voicer-icon-'))
const binary = path.join(
  root,
  'node_modules',
  'app-builder-bin',
  'mac',
  process.arch === 'arm64' ? 'app-builder_arm64' : 'app-builder_amd64'
)

try {
  await execFileAsync(binary, [
    'icon',
    '--format=icns',
    `--root=${root}`,
    `--input=${sourcePath}`,
    `--out=${temporaryDirectory}`
  ])
  await copyFile(path.join(temporaryDirectory, 'icon.icns'), outputPath)
  console.info(`Created ${outputPath}`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
