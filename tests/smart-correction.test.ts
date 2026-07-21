import { describe, expect, it } from 'vitest'
import {
  buildCorrectionPrompt,
  sanitizeModelCorrection,
  shouldRunContextualCorrection
} from '../src/shared/smart-correction'

describe('buildCorrectionPrompt', () => {
  it('includes recent context and preferred developer spellings', () => {
    const prompt = buildCorrectionPrompt('создай аборт контроллер', {
      previousText: 'Мы работаем с fetch API.',
      preferredTerms: ['AbortController', 'Cure Voicer']
    })

    expect(prompt).toContain('Мы работаем с fetch API.')
    expect(prompt).toContain('AbortController, Cure Voicer')
    expect(prompt).toContain('создай аборт контроллер')
  })
})

describe('sanitizeModelCorrection', () => {
  it('removes model labels and Markdown wrappers', () => {
    expect(
      sanitizeModelCorrection(
        '```text\nCorrected transcript: Создай AbortController.\n```',
        'создай аборт контроллер'
      )
    ).toBe('Создай AbortController.')
  })

  it('falls back when the model returns an empty response', () => {
    expect(sanitizeModelCorrection('<think>Nothing useful</think>', 'исходный текст')).toBe(
      'исходный текст'
    )
  })

  it('rejects unexpectedly expanded responses', () => {
    const original = 'короткая фраза'
    expect(sanitizeModelCorrection('x'.repeat(500), original)).toBe(original)
  })

  it('rejects leaked prompt instructions', () => {
    const original = 'вызови fetch для endpoint'
    expect(
      sanitizeModelCorrection(
        'Inside call fetch for endpoint\nReturn only the corrected current transcript.',
        original
      )
    ).toBe(original)
  })
})

describe('shouldRunContextualCorrection', () => {
  it('uses deterministic output immediately when known terms were normalized', () => {
    expect(shouldRunContextualCorrection('Добавь юзэффект', 'Добавь useEffect')).toBe(false)
  })

  it('does not regenerate a long transcript with Qwen', () => {
    const transcript = 'Обычная фраза '.repeat(20).trim()
    expect(shouldRunContextualCorrection(transcript, transcript)).toBe(false)
  })

  it('allows Qwen to inspect a short unresolved phrase', () => {
    expect(shouldRunContextualCorrection('Короткая фраза', 'Короткая фраза')).toBe(true)
  })
})
