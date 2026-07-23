import type {
  AppInfo,
  CureVoicerApi,
  EditorCommand,
  DiagnosticReport,
  InternalEditorPayload,
  ClipboardHistoryItem,
  TextTemplate,
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
  report: DiagnosticReport
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
  getTemplates(): Promise<TextTemplate[]>
  getClipboardHistory(): Promise<ClipboardHistoryItem[]>
  upsertTemplate(template: Pick<TextTemplate, 'id' | 'name' | 'text' | 'pinned' | 'shortcut'>): Promise<TextTemplate[]>
  removeTemplate(id: string): Promise<TextTemplate[]>
  clearClipboardHistory(): Promise<void>
  exportSettings(): Promise<boolean>
  importSettings(): Promise<AppInfo['preferences'] | null>
  getDiagnosticReport(): Promise<DiagnosticReport>
  copyDiagnosticReport(): Promise<void>
  deleteAllUserData(): Promise<void>
}

export class ElectronDesktopClient implements DesktopClient {
  constructor(
    private readonly api: CureVoicerApi,
    private readonly onPreferencesChanged: (preferences: AppInfo['preferences']) => void = () => undefined
  ) {}

  async getDiagnostics(): Promise<DiagnosticsViewModel> {
    const [info, report]: [AppInfo, DiagnosticReport] = await Promise.all([
      this.api.getAppInfo(),
      this.api.getDiagnosticReport()
    ])
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
      shortcutConflicts: info.shortcutConflicts,
      report
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
    return this.api.updatePreferences(patch).then((preferences) => {
      this.onPreferencesChanged(preferences)
      return preferences
    })
  }

  async getTemplates(): Promise<TextTemplate[]> {
    return (await this.api.getAppInfo()).templates
  }

  async getClipboardHistory(): Promise<ClipboardHistoryItem[]> {
    return (await this.api.getAppInfo()).clipboardHistory
  }

  upsertTemplate(template: Pick<TextTemplate, 'id' | 'name' | 'text' | 'pinned' | 'shortcut'>): Promise<TextTemplate[]> {
    return this.api.upsertTemplate(template)
  }

  removeTemplate(id: string): Promise<TextTemplate[]> {
    return this.api.removeTemplate(id)
  }

  clearClipboardHistory(): Promise<void> {
    return this.api.clearClipboardHistory()
  }

  exportSettings(): Promise<boolean> {
    return this.api.exportSettings()
  }

  importSettings(): Promise<AppInfo['preferences'] | null> {
    return this.api.importSettings().then((preferences) => {
      if (preferences) this.onPreferencesChanged(preferences)
      return preferences
    })
  }

  getDiagnosticReport(): Promise<DiagnosticReport> {
    return this.api.getDiagnosticReport()
  }

  copyDiagnosticReport(): Promise<void> {
    return this.api.copyDiagnosticReport()
  }

  deleteAllUserData(): Promise<void> {
    return this.api.deleteAllUserData()
  }
}
