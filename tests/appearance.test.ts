import { describe, expect, it } from 'vitest'
import { AppearanceController, resolveTheme } from '../src/renderer/app/appearance'

class FakeMedia {
  matches = false
  private listener: (() => void) | null = null

  addEventListener(_type: 'change', listener: () => void): void {
    this.listener = listener
  }

  removeEventListener(_type: 'change', listener: () => void): void {
    if (this.listener === listener) this.listener = null
  }

  setDark(value: boolean): void {
    this.matches = value
    this.listener?.()
  }
}

describe('renderer appearance', () => {
  it('resolves explicit and system themes', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('tracks system color scheme changes only for the system preference', () => {
    const media = new FakeMedia()
    const root = {
      dataset: {} as DOMStringMap,
      lang: '',
      style: { colorScheme: '' }
    }
    const controller = new AppearanceController({ documentElement: root }, media, 'ru-RU')
    controller.start()
    controller.update({ theme: 'system', locale: 'system' })
    expect(root).toMatchObject({
      dataset: { theme: 'light', themePreference: 'system' },
      lang: 'ru',
      style: { colorScheme: 'light' }
    })
    media.setDark(true)
    expect(root.dataset.theme).toBe('dark')
    controller.update({ theme: 'light', locale: 'en' })
    media.setDark(false)
    expect(root.dataset.theme).toBe('light')
    expect(root.lang).toBe('en')
    controller.stop()
  })
})
