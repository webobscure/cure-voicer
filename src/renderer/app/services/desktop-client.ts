import type {
  AppInfo,
  CureVoicerApi,
  EditorCommand,
  InternalEditorPayload,
  TransformTextRequest,
  TransformTextResponse
} from '../../../shared/contracts'
import type { InsertionMode } from '../../../shared/types/insertion'
import type { InsertionResult } from '../../../shared/types/insertion'

export interface DiagnosticsViewModel {
  appVersion: string
  platform: NodeJS.Platform
  recognitionEngine: string
  recognitionState: string
  globalInputAvailable: boolean
  onboardingCompleted: boolean
  currentInsertion: InsertionMode
  shortcutConflicts: string[]
}

export interface DesktopClient {
  getDiagnostics(): Promise<DiagnosticsViewModel>
  transformText(request: TransformTextRequest): Promise<TransformTextResponse>
  copyText(text: string): Promise<void>
  onInternalEditorText(callback: (payload: InternalEditorPayload) => void): () => void
  onEditorCommand(callback: (command: EditorCommand) => void): () => void
  getDefaultTransformationPreset(): Promise<string>
  setDefaultTransformationPreset(presetId: string): Promise<void>
  insertEditorText(text: string): Promise<InsertionResult>
  getPreferences(): Promise<AppInfo['preferences']>
  updatePreferences(patch: Partial<AppInfo['preferences']>): Promise<AppInfo['preferences']>
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
        ? info.preferences.insertionMode
        : 'clipboard-only',
      shortcutConflicts: info.shortcutConflicts
    }
  }

  transformText(request: TransformTextRequest): Promise<TransformTextResponse> {
    return this.api.transformText(request)
  }

  copyText(text: string): Promise<void> {
    return this.api.copyText(text)
  }

  onInternalEditorText(callback: (payload: InternalEditorPayload) => void): () => void {
    return this.api.onInternalEditorText(callback)
  }

  onEditorCommand(callback: (command: EditorCommand) => void): () => void {
    return this.api.onEditorCommand(callback)
  }

  async getDefaultTransformationPreset(): Promise<string> {
    return (await this.api.getAppInfo()).preferences.transformationPresetId
  }

  async setDefaultTransformationPreset(presetId: string): Promise<void> {
    await this.api.updatePreferences({ transformationPresetId: presetId })
  }

  insertEditorText(text: string): Promise<InsertionResult> {
    return this.api.insertEditorText(text)
  }

  async getPreferences(): Promise<AppInfo['preferences']> {
    return (await this.api.getAppInfo()).preferences
  }

  updatePreferences(
    patch: Partial<AppInfo['preferences']>
  ): Promise<AppInfo['preferences']> {
    return this.api.updatePreferences(patch)
  }
}
