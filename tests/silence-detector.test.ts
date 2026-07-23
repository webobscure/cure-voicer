import { describe, expect, it, vi } from 'vitest'
import { SilenceDetector } from '../src/modules/dictation/silence-detector'

describe('SilenceDetector', () => {
  it('stops once after sustained speech followed by configured silence', () => {
    let now = 0
    const onSilence = vi.fn()
    const detector = new SilenceDetector(onSilence, () => now)
    detector.reset({
      silenceMs: 2_000,
      initialGraceMs: 500,
      minimumSpeechMs: 250,
      threshold: 0.05
    })

    now = 600
    detector.observe(0.2)
    now = 900
    detector.observe(0.2)
    now = 1_000
    detector.observe(0.01)
    now = 2_999
    detector.observe(0.01)
    expect(onSilence).not.toHaveBeenCalled()
    now = 3_000
    detector.observe(0.01)
    detector.observe(0.01)

    expect(onSilence).toHaveBeenCalledOnce()
  })

  it('does not trigger before voice is detected', () => {
    let now = 0
    const onSilence = vi.fn()
    const detector = new SilenceDetector(onSilence, () => now)
    detector.reset({ silenceMs: 1_000, initialGraceMs: 0 })

    now = 10_000
    detector.observe(0)
    expect(onSilence).not.toHaveBeenCalled()
  })

  it('resets the silence timer when speech resumes', () => {
    let now = 0
    const onSilence = vi.fn()
    const detector = new SilenceDetector(onSilence, () => now)
    detector.reset({
      silenceMs: 1_000,
      initialGraceMs: 0,
      minimumSpeechMs: 0
    })

    detector.observe(0.2)
    now = 100
    detector.observe(0)
    now = 900
    detector.observe(0.2)
    now = 1_000
    detector.observe(0)
    now = 1_999
    detector.observe(0)
    expect(onSilence).not.toHaveBeenCalled()
    now = 2_000
    detector.observe(0)
    expect(onSilence).toHaveBeenCalledOnce()
  })

  it('is disabled when the duration is zero', () => {
    let now = 0
    const onSilence = vi.fn()
    const detector = new SilenceDetector(onSilence, () => now)
    detector.reset({ silenceMs: 0, initialGraceMs: 0, minimumSpeechMs: 0 })
    detector.observe(1)
    now = 60_000
    detector.observe(0)
    expect(onSilence).not.toHaveBeenCalled()
  })
})
