import type { AppInfo, CureVoicerApi } from '../../../shared/contracts'

export interface DiagnosticsViewModel {
  appVersion: string
  platform: NodeJS.Platform
  recognitionEngine: string
  recognitionState: string
  globalInputAvailable: boolean
  onboardingCompleted: boolean
  currentInsertion: 'legacy-clipboard' | 'clipboard-only'
}

export interface DesktopClient {
  getDiagnostics(): Promise<DiagnosticsViewModel>
}

export class ElectronDesktopClient implements DesktopClient {
  constructor(private readonly api: CureVoicerApi) {}

  async getDiagnostics(): Promise<DiagnosticsViewModel> {
    const info: AppInfo = await this.api.getAppInfo()
    return {
      appVersion: info.version,
      platform: info.platform,
      recognitionEngine: info.asrEngine,
      recognitionState: info.asrStatus.state,
      globalInputAvailable: info.globalInputAvailable,
      onboardingCompleted: info.preferences.onboardingCompleted,
      currentInsertion: info.preferences.autoPaste
        ? 'legacy-clipboard'
        : 'clipboard-only'
    }
  }
}

