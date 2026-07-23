import { useSyncExternalStore } from 'react'
import type { DesktopClient } from './services/desktop-client'
import type { SettingsPaneId, SettingsShellController } from './settings-shell-controller'
import { useI18n } from './i18n/i18n-context'
import type { MessageKey } from './i18n/messages'
import { GeneralSettingsPage } from '../features/settings/GeneralSettingsPage'
import { DictationSettingsPage } from '../features/settings/DictationSettingsPage'
import { ModelsPage } from '../features/models/ModelsPage'
import { VocabularyPage } from '../features/vocabulary/VocabularyPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { EditorPage } from '../features/editor/EditorPage'
import { CommandSettingsPage } from '../features/commands/CommandSettingsPage'
import { HotkeySettingsPage } from '../features/shortcuts/HotkeySettingsPage'
import { IntegrationSettingsPage } from '../features/integrations/IntegrationSettingsPage'
import { TemplatesPage } from '../features/templates/TemplatesPage'
import { ClipboardSettingsPage } from '../features/clipboard/ClipboardSettingsPage'
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage'
import { coreSettingsController } from './core-settings-controller'
import { modelSettingsStore } from './model-settings-store'
import { settingsDataStore } from './settings-data-store'

const paneMeta: ReadonlyArray<{
  id: SettingsPaneId
  symbol: string
  title: MessageKey
  subtitle: MessageKey
}> = [
  { id: 'general', symbol: '☷', title: 'shell.general', subtitle: 'shell.generalSubtitle' },
  { id: 'dictation', symbol: '♫', title: 'shell.dictation', subtitle: 'shell.dictationSubtitle' },
  { id: 'models', symbol: '▣', title: 'shell.models', subtitle: 'shell.modelsSubtitle' },
  { id: 'vocabulary', symbol: '▤', title: 'shell.vocabulary', subtitle: 'shell.vocabularySubtitle' },
  { id: 'history', symbol: '◷', title: 'shell.history', subtitle: 'shell.historySubtitle' },
  { id: 'editor', symbol: '✎', title: 'shell.editor', subtitle: 'shell.editorSubtitle' },
  { id: 'commands', symbol: '♩', title: 'shell.commands', subtitle: 'shell.commandsSubtitle' },
  { id: 'hotkeys', symbol: '⌨', title: 'shell.hotkeys', subtitle: 'shell.hotkeysSubtitle' },
  { id: 'integrations', symbol: '✥', title: 'shell.integrations', subtitle: 'shell.integrationsSubtitle' },
  { id: 'templates', symbol: '▧', title: 'shell.templates', subtitle: 'shell.templatesSubtitle' },
  { id: 'clipboard', symbol: '▣', title: 'shell.clipboard', subtitle: 'shell.clipboardSubtitle' },
  { id: 'diagnostics', symbol: '⌑', title: 'shell.diagnostics', subtitle: 'shell.diagnosticsSubtitle' }
]

export function SettingsShell({
  client,
  controller,
  logoUrl
}: {
  client: DesktopClient
  controller: SettingsShellController
  logoUrl: string
}): React.JSX.Element {
  const { t } = useI18n()
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const current = paneMeta.find((pane) => pane.id === snapshot.activePane) ?? paneMeta[0]
  if (!current) throw new Error('Settings navigation is empty')

  return <main className="settings-window">
    <aside className="sidebar">
      <div className="sidebar-drag-region" />
      <div className="sidebar-brand"><div className="app-icon" aria-hidden="true"><img src={logoUrl} alt="" draggable={false} /></div><div><strong>Cure Voicer</strong><span><i /> {t('shell.running')}</span></div></div>
      <nav className="sidebar-nav" aria-label={t('shell.settings')}>
        {paneMeta.map((pane) => <button className={`nav-item${snapshot.activePane === pane.id ? ' is-active' : ''}`} type="button" key={pane.id} onClick={() => controller.select(pane.id)}><span className="nav-symbol" aria-hidden="true">{pane.symbol}</span><span>{t(pane.title)}</span></button>)}
      </nav>
      <div className="sidebar-footer"><div className="privacy-mini"><span aria-hidden="true">▣</span> {t('shell.private')}</div><span>Cure Voicer {snapshot.version}</span></div>
    </aside>
    <section className="content-area">
      <header className="content-toolbar"><div><h1>{t(current.title)}</h1><p>{t(current.subtitle)}</p></div><div className="service-switch" aria-label={t('shell.enabled')}><span>{t('shell.enabled')}</span><i><b /></i></div></header>
      <div className="content-scroll">
        <SettingsPane id="general" active={snapshot.activePane}><GeneralSettingsPage controller={coreSettingsController} logoUrl={logoUrl} /></SettingsPane>
        <SettingsPane id="dictation" active={snapshot.activePane}><DictationSettingsPage controller={coreSettingsController} /></SettingsPane>
        <SettingsPane id="models" active={snapshot.activePane}><ModelsPage client={client} store={modelSettingsStore} /></SettingsPane>
        <SettingsPane id="vocabulary" active={snapshot.activePane}><VocabularyPage client={client} store={settingsDataStore} /></SettingsPane>
        <SettingsPane id="history" active={snapshot.activePane}><HistoryPage client={client} store={settingsDataStore} /></SettingsPane>
        <SettingsPane id="editor" active={snapshot.activePane}><EditorPage client={client} /></SettingsPane>
        <SettingsPane id="commands" active={snapshot.activePane}><CommandSettingsPage client={client} /></SettingsPane>
        <SettingsPane id="hotkeys" active={snapshot.activePane}><HotkeySettingsPage client={client} /></SettingsPane>
        <SettingsPane id="integrations" active={snapshot.activePane}><IntegrationSettingsPage client={client} /></SettingsPane>
        <SettingsPane id="templates" active={snapshot.activePane}><TemplatesPage client={client} /></SettingsPane>
        <SettingsPane id="clipboard" active={snapshot.activePane}><ClipboardSettingsPage client={client} /></SettingsPane>
        <SettingsPane id="diagnostics" active={snapshot.activePane}><DiagnosticsPage client={client} /></SettingsPane>
      </div>
    </section>
  </main>
}

function SettingsPane({ id, active, children }: { id: SettingsPaneId; active: SettingsPaneId; children: React.ReactNode }): React.JSX.Element {
  return <section id={`${id}ReactRoot`} className={`settings-pane${id === active ? ' is-active' : ''}`} data-pane={id} hidden={id !== active}>{children}</section>
}
