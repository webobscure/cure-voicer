import { describe, expect, it } from 'vitest'
import { encodeFloat32PcmAsWav, float32FromBytes } from '../src/main/audio/wav'

describe('WAV encoder', () => {
  it('writes a valid mono PCM16 header', () => {
    const wav = encodeFloat32PcmAsWav(new Float32Array([0, 1, -1]), 16_000)

    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt16LE(22)).toBe(1)
    expect(wav.readUInt32LE(24)).toBe(16_000)
    expect(wav.readUInt16LE(34)).toBe(16)
    expect(wav.readUInt32LE(40)).toBe(6)
    expect(wav.readInt16LE(44)).toBe(0)
    expect(wav.readInt16LE(46)).toBe(32_767)
    expect(wav.readInt16LE(48)).toBe(-32_768)
  })

  it('reconstructs float samples from IPC bytes', () => {
    const input = new Float32Array([0.25, -0.5, 0.75])
    const bytes = new Uint8Array(input.buffer.slice(0))
    expect(Array.from(float32FromBytes(bytes))).toEqual(Array.from(input))
  })
})
