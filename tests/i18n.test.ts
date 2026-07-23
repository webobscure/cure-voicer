import { describe, expect, it, vi } from 'vitest'
import { I18nStore, resolveLocale } from '../src/renderer/app/i18n/i18n-store'
import { formatMessage } from '../src/renderer/app/i18n/messages'

describe('renderer localization', () => {
  it('resolves explicit and system locale preferences', () => {
    expect(resolveLocale('ru', 'en-US')).toBe('ru')
    expect(resolveLocale('en', 'ru-RU')).toBe('en')
    expect(resolveLocale('system', 'ru-RU')).toBe('ru')
    expect(resolveLocale('system', 'de-DE')).toBe('en')
  })

  it('formats typed messages without leaking unresolved values', () => {
    expect(formatMessage('en', 'onboarding.modelDownloading', { percent: 42 }))
      .toBe('Downloading to this computer · 42%')
    expect(formatMessage('ru', 'common.continue')).toBe('Продолжить')
  })

  it('notifies React subscribers only when the resolved locale changes', () => {
    const store = new I18nStore('system', 'en-US')
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.setPreference('en')
    store.setPreference('ru')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toBe('ru')
    expect(store.translate('common.back')).toBe('Назад')
    unsubscribe()
    store.setPreference('en')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
