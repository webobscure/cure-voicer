import { describe, expect, it } from 'vitest'
import { resampleLinear } from '../src/renderer/audio-recorder'

describe('audio resampling', () => {
  it('downsamples to the expected number of samples', () => {
    const input = Float32Array.from({ length: 48_000 }, (_, index) =>
      Math.sin((index / 48_000) * Math.PI * 2 * 440)
    )
    const output = resampleLinear(input, 48_000, 16_000)

    expect(output).toHaveLength(16_000)
    expect(output.every(Number.isFinite)).toBe(true)
  })

  it('does not copy data when sample rates match', () => {
    const input = new Float32Array([0, 0.5, -0.5])
    expect(resampleLinear(input, 16_000, 16_000)).toBe(input)
  })
})
