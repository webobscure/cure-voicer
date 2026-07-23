import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { CureVoicerApi } from '../../shared/contracts'
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage'
import { ElectronDesktopClient } from './services/desktop-client'

let diagnosticsRoot: Root | null = null

export function mountReactFeatures(api: CureVoicerApi | undefined): void {
  const container = document.getElementById('diagnosticsReactRoot')
  if (!container || diagnosticsRoot) return

  if (!api) {
    container.textContent = 'Диагностика доступна только в приложении.'
    return
  }

  diagnosticsRoot = createRoot(container)
  diagnosticsRoot.render(
    <StrictMode>
      <DiagnosticsPage client={new ElectronDesktopClient(api)} />
    </StrictMode>
  )
}

