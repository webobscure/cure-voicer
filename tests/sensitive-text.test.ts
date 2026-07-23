import { describe, expect, it } from 'vitest'
import { isPotentiallySensitiveText } from '../src/modules/clipboard/sensitive-text'

describe('isPotentiallySensitiveText', () => {
  it('detects credentials, private keys and valid payment card numbers', () => {
    expect(isPotentiallySensitiveText('password: hunter2')).toBe(true)
    expect(isPotentiallySensitiveText('ghp_1234567890abcdefghijklmnop')).toBe(true)
    expect(isPotentiallySensitiveText('-----BEGIN PRIVATE KEY-----')).toBe(true)
    expect(isPotentiallySensitiveText('4111 1111 1111 1111')).toBe(true)
  })

  it('does not reject ordinary mixed-language text', () => {
    expect(isPotentiallySensitiveText('Создай AbortController and pass AbortSignal')).toBe(false)
  })
})
