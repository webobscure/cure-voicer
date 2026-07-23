import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { AppPreferences, CureVoicerApi } from '../../shared/contracts'
import brandLogoUrl from '../../../assets/branding/cure-voicer-keycap-c-logo-v3.png'
import { I18nProvider } from './i18n/i18n-context'
import type { I18nStore } from './i18n/i18n-store'
import { ElectronDesktopClient } from './services/desktop-client'
import { SettingsShell } from './SettingsShell'
import { settingsShellController } from './settings-shell-controller'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { onboardingController } from '../features/onboarding/onboarding-controller'

let appRoot: Root | null = null
let onboardingRoot: Root | null = null

export function mountReactFeatures(
  api: CureVoicerApi | undefined,
  i18n: I18nStore,
  onPreferencesChanged: (preferences: AppPreferences) => void
): void {
  if (appRoot || onboardingRoot) return
  const appContainer = document.getElementById('appReactRoot')
  const onboardingContainer = document.getElementById('onboardingReactRoot')
  if (!appContainer || !onboardingContainer) throw new Error('Renderer roots are unavailable')

  onboardingRoot = createRoot(onboardingContainer)
  onboardingRoot.render(
    <StrictMode><I18nProvider store={i18n}><OnboardingPage controller={onboardingController} logoUrl={brandLogoUrl} /></I18nProvider></StrictMode>
  )

  if (!api) {
    appContainer.textContent = 'Cure Voicer settings are available in the desktop application.'
    return
  }

  const client = new ElectronDesktopClient(api, onPreferencesChanged)
  appRoot = createRoot(appContainer)
  appRoot.render(
    <StrictMode><I18nProvider store={i18n}><SettingsShell client={client} controller={settingsShellController} logoUrl={brandLogoUrl} /></I18nProvider></StrictMode>
  )
}
