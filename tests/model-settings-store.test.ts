import { describe, expect, it, vi } from 'vitest'
import { ModelSettingsStore } from '../src/renderer/app/model-settings-store'

describe('ModelSettingsStore', () => {
  it('publishes native model status changes to React without owning workers', () => {
    const store = new ModelSettingsStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const asr = {
      state: 'ready' as const,
      progress: 1,
      engine: 'Parakeet V3 · ONNX Runtime',
      modelName: 'Parakeet TDT 0.6B V3',
      modelSizeBytes: 670_000_000
    }
    store.update({ platform: 'win32', asr, smartCorrectionEnabled: true })
    expect(store.getSnapshot()).toMatchObject({ platform: 'win32', asr, smartCorrectionEnabled: true })
    expect(listener).toHaveBeenCalledOnce()
    store.update({ platform: 'win32', asr, smartCorrectionEnabled: true })
    expect(listener).toHaveBeenCalledOnce()
  })
})
