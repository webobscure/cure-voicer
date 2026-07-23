import type { AppPreferences } from '../../../shared/contracts'
import { formatMessage, type MessageKey, type MessageValues } from './messages'

export type ResolvedLocale = 'ru' | 'en'
export type LocalePreference = AppPreferences['locale']

export function resolveLocale(
  preference: LocalePreference,
  systemLanguage: string
): ResolvedLocale {
  if (preference === 'ru' || preference === 'en') return preference
  return systemLanguage.toLocaleLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export class I18nStore {
  private locale: ResolvedLocale
  private readonly listeners = new Set<() => void>()

  constructor(
    preference: LocalePreference = 'system',
    private readonly systemLanguage = 'en'
  ) {
    this.locale = resolveLocale(preference, systemLanguage)
  }

  getSnapshot = (): ResolvedLocale => this.locale

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setPreference(preference: LocalePreference): void {
    const locale = resolveLocale(preference, this.systemLanguage)
    if (locale === this.locale) return
    this.locale = locale
    for (const listener of this.listeners) listener()
  }

  translate(key: MessageKey, values?: MessageValues): string {
    return formatMessage(this.locale, key, values)
  }
}
