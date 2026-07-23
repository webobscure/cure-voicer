import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { CureVoicerApi } from '../../shared/contracts'
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage'
import { ElectronDesktopClient } from './services/desktop-client'
import { EditorPage } from '../features/editor/EditorPage'
import { CommandSettingsPage } from '../features/commands/CommandSettingsPage'
import { HotkeySettingsPage } from '../features/shortcuts/HotkeySettingsPage'
import { IntegrationSettingsPage } from '../features/integrations/IntegrationSettingsPage'
import { TemplatesPage } from '../features/templates/TemplatesPage'
import { ClipboardSettingsPage } from '../features/clipboard/ClipboardSettingsPage'
import { I18nProvider } from './i18n/i18n-context'
import type { I18nStore } from './i18n/i18n-store'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { onboardingController } from '../features/onboarding/onboarding-controller'
import brandLogoUrl from '../../../assets/branding/cure-voicer-liquid-glass-logo.png'
import type { AppPreferences } from '../../shared/contracts'
import { VocabularyPage } from '../features/vocabulary/VocabularyPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { settingsDataStore } from './settings-data-store'

let diagnosticsRoot: Root | null = null
let editorRoot: Root | null = null
let commandsRoot: Root | null = null
let hotkeysRoot: Root | null = null
let integrationsRoot: Root | null = null
let templatesRoot: Root | null = null
let clipboardRoot: Root | null = null
let onboardingRoot: Root | null = null
let vocabularyRoot: Root | null = null
let historyRoot: Root | null = null

export function mountReactFeatures(
  api: CureVoicerApi | undefined,
  i18n: I18nStore,
  onPreferencesChanged: (preferences: AppPreferences) => void
): void {
  const container = document.getElementById('diagnosticsReactRoot')
  const editorContainer = document.getElementById('editorReactRoot')
  const commandsContainer = document.getElementById('commandsReactRoot')
  const hotkeysContainer = document.getElementById('hotkeysReactRoot')
  const integrationsContainer = document.getElementById('integrationsReactRoot')
  const templatesContainer = document.getElementById('templatesReactRoot')
  const clipboardContainer = document.getElementById('clipboardReactRoot')
  const onboardingContainer = document.getElementById('onboardingReactRoot')
  const vocabularyContainer = document.getElementById('vocabularyReactRoot')
  const historyContainer = document.getElementById('historyReactRoot')
  if ((!container && !editorContainer && !commandsContainer && !hotkeysContainer && !integrationsContainer && !templatesContainer && !clipboardContainer && !onboardingContainer && !vocabularyContainer && !historyContainer) || diagnosticsRoot || editorRoot || commandsRoot || hotkeysRoot || integrationsRoot || templatesRoot || clipboardRoot || onboardingRoot || vocabularyRoot || historyRoot) return

  if (onboardingContainer) {
    onboardingRoot = createRoot(onboardingContainer)
    onboardingRoot.render(
      <StrictMode><I18nProvider store={i18n}><OnboardingPage controller={onboardingController} logoUrl={brandLogoUrl} /></I18nProvider></StrictMode>
    )
  }

  if (!api) {
    if (container) container.textContent = 'Диагностика доступна только в приложении.'
    if (editorContainer) editorContainer.textContent = 'Редактор доступен только в приложении.'
    if (commandsContainer) commandsContainer.textContent = 'Команды доступны только в приложении.'
    if (hotkeysContainer) hotkeysContainer.textContent = 'Горячие клавиши доступны только в приложении.'
    if (integrationsContainer) integrationsContainer.textContent = 'Интеграции доступны только в приложении.'
    if (templatesContainer) templatesContainer.textContent = 'Шаблоны доступны только в приложении.'
    if (clipboardContainer) clipboardContainer.textContent = 'Буфер доступен только в приложении.'
    if (vocabularyContainer) vocabularyContainer.textContent = 'Vocabulary is available only in the desktop application.'
    if (historyContainer) historyContainer.textContent = 'History is available only in the desktop application.'
    return
  }

  const client = new ElectronDesktopClient(api, onPreferencesChanged)
  if (container) {
    diagnosticsRoot = createRoot(container)
    diagnosticsRoot.render(<StrictMode><I18nProvider store={i18n}><DiagnosticsPage client={client} /></I18nProvider></StrictMode>)
  }
  if (editorContainer) {
    editorRoot = createRoot(editorContainer)
    editorRoot.render(<StrictMode><I18nProvider store={i18n}><EditorPage client={client} /></I18nProvider></StrictMode>)
  }
  if (commandsContainer) {
    commandsRoot = createRoot(commandsContainer)
    commandsRoot.render(<StrictMode><I18nProvider store={i18n}><CommandSettingsPage client={client} /></I18nProvider></StrictMode>)
  }
  if (hotkeysContainer) {
    hotkeysRoot = createRoot(hotkeysContainer)
    hotkeysRoot.render(<StrictMode><I18nProvider store={i18n}><HotkeySettingsPage client={client} /></I18nProvider></StrictMode>)
  }
  if (integrationsContainer) {
    integrationsRoot = createRoot(integrationsContainer)
    integrationsRoot.render(<StrictMode><I18nProvider store={i18n}><IntegrationSettingsPage client={client} /></I18nProvider></StrictMode>)
  }
  if (templatesContainer) {
    templatesRoot = createRoot(templatesContainer)
    templatesRoot.render(<StrictMode><I18nProvider store={i18n}><TemplatesPage client={client} /></I18nProvider></StrictMode>)
  }
  if (clipboardContainer) {
    clipboardRoot = createRoot(clipboardContainer)
    clipboardRoot.render(<StrictMode><I18nProvider store={i18n}><ClipboardSettingsPage client={client} /></I18nProvider></StrictMode>)
  }
  if (vocabularyContainer) {
    vocabularyRoot = createRoot(vocabularyContainer)
    vocabularyRoot.render(<StrictMode><I18nProvider store={i18n}><VocabularyPage client={client} store={settingsDataStore} /></I18nProvider></StrictMode>)
  }
  if (historyContainer) {
    historyRoot = createRoot(historyContainer)
    historyRoot.render(<StrictMode><I18nProvider store={i18n}><HistoryPage client={client} store={settingsDataStore} /></I18nProvider></StrictMode>)
  }
}
