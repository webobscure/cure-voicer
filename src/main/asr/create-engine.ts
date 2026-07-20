import { existsSync } from 'node:fs'
import { FluidAudioEngine } from './fluid-audio-engine'
import { MockAsrEngine } from './mock-engine'
import type { AsrEngine } from './types'

export function createAsrEngine(): AsrEngine {
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    const engine = new FluidAudioEngine()
    if (existsSync(engine.helperExecutablePath)) return engine
  }

  return new MockAsrEngine()
}
