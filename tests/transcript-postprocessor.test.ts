import { describe, expect, it } from 'vitest'
import { postProcessTranscript } from '../src/shared/transcript-postprocessor'

describe('postProcessTranscript', () => {
  it('restores English developer terms from Russian phonetic output', () => {
    expect(
      postProcessTranscript('Создай аборт контроллер и вызови фетч для эндпоинта.')
    ).toBe('Создай AbortController и вызови fetch для endpoint.')
  })

  it('uses canonical casing for English developer terms', () => {
    expect(postProcessTranscript('Use abort controller with type script and github.')).toBe(
      'Use AbortController with TypeScript and GitHub.'
    )
  })

  it('turns the Russian voice command into a real newline', () => {
    expect(postProcessTranscript('Создай переменную, новая строка верни результат.')).toBe(
      'Создай переменную\nверни результат.'
    )
  })

  it('supports the English new line command', () => {
    expect(postProcessTranscript('const value new line return value')).toBe(
      'const value\nreturn value'
    )
  })

  it('still applies terms from the personal vocabulary', () => {
    expect(postProcessTranscript('запусти cure voicer', ['Cure Voicer'])).toBe(
      'запусти Cure Voicer'
    )
  })

  it('normalizes compact React terms from the observed dictation output', () => {
    expect(postProcessTranscript('Добавь юзэффект. Внутри вызови фечт для endpoint.')).toBe(
      'Добавь useEffect. Внутри вызови fetch для endpoint.'
    )
  })

  it('restores a phonetically dictated English developer sentence', () => {
    expect(postProcessTranscript('Юз TypeScript визракт энд локал сторож.')).toBe(
      'Use TypeScript with React and localStorage.'
    )
  })

  it('uses QueryClient context when ASR drops Tan from TanStack', () => {
    expect(postProcessTranscript('Добавьте стек и настрой query клиент.')).toBe(
      'Добавьте TanStack Query и настрой QueryClient.'
    )
  })

  it('repairs the observed endpoint and QueryClient distortions', () => {
    expect(postProcessTranscript('Внутри вызови fetch. D endpoint')).toBe(
      'Внутри вызови fetch для endpoint'
    )
    expect(postProcessTranscript('Добавь TanStack Query и настройку клиента.')).toBe(
      'Добавь TanStack Query и настрой QueryClient.'
    )
  })

  it('supports pronunciation variants observed in real dictation', () => {
    const transcript = [
      'Создай AbortController и передай в него AbortSignal',
      'Добавь useEffect',
      'Внутри вызови фечь для endpoint',
      'Юз TypeScript в React энд localStorage',
      'Добавь ten stack query и настойку клиент.'
    ].join('\n')

    expect(postProcessTranscript(transcript)).toBe(
      [
        'Создай AbortController и передай в него AbortSignal',
        'Добавь useEffect',
        'Внутри вызови fetch для endpoint',
        'Use TypeScript with React and localStorage',
        'Добавь TanStack Query и настрой QueryClient.'
      ].join('\n')
    )
  })

  it('normalizes rhotacism variants without duplicating QueryClient', () => {
    expect(
      postProcessTranscript('Добавь тенстек верри и настройку клиент. QueryClient.')
    ).toBe('Добавь TanStack Query и настрой QueryClient.')
  })
})
