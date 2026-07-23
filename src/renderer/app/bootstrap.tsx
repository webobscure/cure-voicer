import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { CureVoicerApi } from '../../shared/contracts'
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage'
import { ElectronDesktopClient } from './services/desktop-client'
import { EditorPage } from '../features/editor/EditorPage'
import { CommandSettingsPage } from '../features/commands/CommandSettingsPage'
import { HotkeySettingsPage } from '../features/shortcuts/HotkeySettingsPage'
import { IntegrationSettingsPage } from '../features/integrations/IntegrationSettingsPage'

let diagnosticsRoot: Root | null = null
let editorRoot: Root | null = null
let commandsRoot: Root | null = null
let hotkeysRoot: Root | null = null
let integrationsRoot: Root | null = null

export function mountReactFeatures(api: CureVoicerApi | undefined): void {
  const container = document.getElementById('diagnosticsReactRoot')
  const editorContainer = document.getElementById('editorReactRoot')
  const commandsContainer = document.getElementById('commandsReactRoot')
  const hotkeysContainer = document.getElementById('hotkeysReactRoot')
  const integrationsContainer = document.getElementById('integrationsReactRoot')
  if ((!container && !editorContainer && !commandsContainer && !hotkeysContainer && !integrationsContainer) || diagnosticsRoot || editorRoot || commandsRoot || hotkeysRoot || integrationsRoot) return

  if (!api) {
    if (container) container.textContent = 'Диагностика доступна только в приложении.'
    if (editorContainer) editorContainer.textContent = 'Редактор доступен только в приложении.'
    if (commandsContainer) commandsContainer.textContent = 'Команды доступны только в приложении.'
    if (hotkeysContainer) hotkeysContainer.textContent = 'Горячие клавиши доступны только в приложении.'
    if (integrationsContainer) integrationsContainer.textContent = 'Интеграции доступны только в приложении.'
    return
  }

  const client = new ElectronDesktopClient(api)
  if (container) {
    diagnosticsRoot = createRoot(container)
    diagnosticsRoot.render(<StrictMode><DiagnosticsPage client={client} /></StrictMode>)
  }
  if (editorContainer) {
    editorRoot = createRoot(editorContainer)
    editorRoot.render(<StrictMode><EditorPage client={client} /></StrictMode>)
  }
  if (commandsContainer) {
    commandsRoot = createRoot(commandsContainer)
    commandsRoot.render(<StrictMode><CommandSettingsPage client={client} /></StrictMode>)
  }
  if (hotkeysContainer) {
    hotkeysRoot = createRoot(hotkeysContainer)
    hotkeysRoot.render(<StrictMode><HotkeySettingsPage client={client} /></StrictMode>)
  }
  if (integrationsContainer) {
    integrationsRoot = createRoot(integrationsContainer)
    integrationsRoot.render(<StrictMode><IntegrationSettingsPage client={client} /></StrictMode>)
  }
}
