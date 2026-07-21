import { describe, expect, it } from 'vitest'
import { applyPreferredTerms } from '../src/shared/vocabulary'

describe('applyPreferredTerms', () => {
  it('restores the preferred spelling regardless of recognition casing', () => {
    expect(
      applyPreferredTerms('запусти cure voicer через parakeet', ['Cure Voicer', 'Parakeet'])
    ).toBe('запусти Cure Voicer через Parakeet')
  })

  it('treats punctuation in a term as literal text', () => {
    expect(applyPreferredTerms('используем c++ сегодня', ['C++'])).toBe(
      'используем C++ сегодня'
    )
  })
})
