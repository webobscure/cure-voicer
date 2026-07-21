import { existsSync } from 'node:fs'
import { FluidAudioEngine } from './fluid-audio-engine'
import { MockAsrEngine } from './mock-engine'
import { SherpaOnnxEngine } from './sherpa-onnx-engine'
import type { AsrEngine } from './types'

export function createAsrEngine(options: {
  windowsWorkerPath: string
  windowsModelsDirectory: string
}): AsrEngine {
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    const engine = new FluidAudioEngine()
    if (existsSync(engine.helperExecutablePath)) return engine
  }

  if (process.platform === 'win32' && process.arch === 'x64') {
    return new SherpaOnnxEngine(options.windowsWorkerPath, options.windowsModelsDirectory)
  }

  return new MockAsrEngine()
}
