import { describe, expect, it } from 'vitest'
import {
  initialAsrStatus,
  WINDOWS_PARAKEET_MODEL_FILES,
  WINDOWS_PARAKEET_MODEL_REVISION,
  WINDOWS_PARAKEET_MODEL_SIZE_BYTES,
  windowsParakeetModelUrl
} from '../src/shared/asr'

describe('Windows Parakeet model manifest', () => {
  it('uses the pinned model revision for every download', () => {
    for (const file of WINDOWS_PARAKEET_MODEL_FILES) {
      const url = windowsParakeetModelUrl(file.name)
      expect(url).toContain(WINDOWS_PARAKEET_MODEL_REVISION)
      expect(url).toContain(encodeURIComponent(file.name))
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/u)
    }
  })

  it('reports the exact aggregate download size', () => {
    expect(WINDOWS_PARAKEET_MODEL_SIZE_BYTES).toBe(
      WINDOWS_PARAKEET_MODEL_FILES.reduce((total, file) => total + file.size, 0)
    )
    expect(WINDOWS_PARAKEET_MODEL_SIZE_BYTES).toBe(670_478_772)
  })

  it('creates bounded initial status values', () => {
    expect(initialAsrStatus('not-downloaded').progress).toBe(0)
    expect(initialAsrStatus('ready').progress).toBe(1)
  })
})
