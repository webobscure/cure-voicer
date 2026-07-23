import { describe, expect, it } from 'vitest'
import {
  AudioCaptureLimitError,
  PcmCaptureSession
} from '../src/modules/dictation/audio-capture-port'

describe('PcmCaptureSession', () => {
  it('assembles ordered worklet chunks for one session', () => {
    const session = new PcmCaptureSession('session-1', 5)
    session.append(new Float32Array([0.1, 0.2]))
    session.append(new Float32Array([0.3, 0.4, 0.5]))

    expect(Array.from(session.finish())).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
      expect.closeTo(0.4),
      expect.closeTo(0.5)
    ])
  })

  it('rejects a chunk before exceeding bounded memory', () => {
    const session = new PcmCaptureSession('session-1', 3)
    session.append(new Float32Array([1, 2]))

    expect(() => session.append(new Float32Array([3, 4]))).toThrow(
      AudioCaptureLimitError
    )
    expect(Array.from(session.finish())).toEqual([1, 2])
  })

  it('cannot be reused after finish or cancel', () => {
    const finished = new PcmCaptureSession('finished', 2)
    finished.finish()
    expect(() => finished.append(new Float32Array([1]))).toThrow(
      'Audio capture session is closed'
    )

    const cancelled = new PcmCaptureSession('cancelled', 2)
    cancelled.cancel()
    expect(() => cancelled.finish()).toThrow('Audio capture session is closed')
  })
})
