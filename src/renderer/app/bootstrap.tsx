import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { CureVoicerApi } from '../../shared/contracts'
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage'
import { ElectronDesktopClient } from './services/desktop-client'
import { EditorPage } from '../features/editor/EditorPage'

let diagnosticsRoot: Root | null = null
let editorRoot: Root | null = null

export function mountReactFeatures(api: CureVoicerApi | undefined): void {
  const container = document.getElementById('diagnosticsReactRoot')
  const editorContainer = document.getElementById('editorReactRoot')
  if ((!container && !editorContainer) || diagnosticsRoot || editorRoot) return

  if (!api) {
    if (container) container.textContent = 'Диагностика доступна только в приложении.'
    if (editorContainer) editorContainer.textContent = 'Редактор доступен только в приложении.'
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
}
