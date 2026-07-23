import type { AppPreferences } from '../../shared/contracts'
import { resolveLocale } from './i18n/i18n-store'

export type ResolvedTheme = 'light' | 'dark'

export function resolveTheme(
  preference: AppPreferences['theme'],
  systemPrefersDark: boolean
): ResolvedTheme {
  return preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference
}

interface AppearanceDocument {
  documentElement: {
    dataset: DOMStringMap
    lang: string
    style: Pick<CSSStyleDeclaration, 'colorScheme'>
  }
}

interface ColorSchemeMedia {
  matches: boolean
  addEventListener(type: 'change', listener: () => void): void
  removeEventListener(type: 'change', listener: () => void): void
}

export class AppearanceController {
  private preferences: Pick<AppPreferences, 'locale' | 'theme'> = {
    locale: 'system',
    theme: 'system'
  }
  private started = false

  constructor(
    private readonly target: AppearanceDocument,
    private readonly media: ColorSchemeMedia,
    private readonly systemLanguage: string
  ) {}

  start(): void {
    if (this.started) return
    this.started = true
    this.media.addEventListener('change', this.apply)
    this.apply()
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.media.removeEventListener('change', this.apply)
  }

  update(preferences: Pick<AppPreferences, 'locale' | 'theme'>): void {
    this.preferences = preferences
    this.apply()
  }

  private readonly apply = (): void => {
    const root = this.target.documentElement
    const theme = resolveTheme(this.preferences.theme, this.media.matches)
    root.dataset.theme = theme
    root.dataset.themePreference = this.preferences.theme
    root.style.colorScheme = theme
    root.lang = resolveLocale(this.preferences.locale, this.systemLanguage)
  }
}
