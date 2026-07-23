import { app } from 'electron'
import path from 'node:path'
import { createAsrEngine } from '../asr/create-engine'
import type { AsrEngine } from '../asr/types'
import { RecordingService } from '../recording-service'
import { SmartCorrectionService } from '../smart-correction-service'
import { DictationMachine } from '../../modules/dictation/dictation-machine'
import { LegacyAsrProvider } from '../../modules/transcription/legacy-asr-provider'
import { SpeechRecognitionProviderRegistry } from '../../modules/transcription/provider-registry'
import { ClipboardTransactionManager } from '../../modules/clipboard/clipboard-transaction'
import { AccessibilityInsertionProvider } from '../../modules/insertion/accessibility-provider'
import { ClipboardOnlyInsertionProvider } from '../../modules/insertion/clipboard-only-provider'
import { ClipboardSafeInsertionProvider } from '../../modules/insertion/clipboard-safe-provider'
import { InternalEditorInsertionProvider } from '../../modules/insertion/internal-editor-provider'
import { KeyboardInsertionProvider } from '../../modules/insertion/keyboard-provider'
import { TextInsertionService } from '../../modules/insertion/insertion-service'
import { ConsoleDiagnosticSink, StructuredLogger } from '../../modules/diagnostics/structured-logger'
import { ElectronClipboardPort } from '../services/electron-clipboard-port'
import { PlatformTextInputService } from '../services/platform-text-input'
import { SystemActiveApplicationProvider } from '../services/active-application'
import { DeferredInternalEditorPort } from '../services/internal-editor-port'
import { createBuiltInTransformations } from '../../modules/transformations/presets'
import { TransformationRegistry } from '../../modules/transformations/transformation-registry'
import { ActiveApplicationActivator } from '../services/active-application-activator'
import { SelectedTextService } from '../../modules/selection/selected-text-service'
import { VoiceCommandRegistry } from '../../modules/commands/voice-command-registry'
import { createBuiltInVoiceCommands } from '../../modules/commands/built-in-commands'
import { CommandUiBridge } from '../services/command-ui-bridge'

export interface ApplicationServices {
  asrEngine: AsrEngine
  smartCorrection: SmartCorrectionService
  dictation: DictationMachine
  transcriptionProviders: SpeechRecognitionProviderRegistry
  activeApplications: SystemActiveApplicationProvider
  internalEditor: DeferredInternalEditorPort
  transformations: TransformationRegistry
  insertion: TextInsertionService
  applicationActivator: ActiveApplicationActivator
  selectedText: SelectedTextService
  voiceCommands: VoiceCommandRegistry
  commandUi: CommandUiBridge
  recording: RecordingService
}

export function createApplicationServices(mainDirectory: string): ApplicationServices {
  const asrEngine = createAsrEngine({
    windowsWorkerPath: path.join(mainDirectory, 'windows-asr-worker.js'),
    windowsModelsDirectory: path.join(
      app.getPath('userData'),
      'models',
      'parakeet-v3-onnx'
    )
  })
  const smartCorrection = new SmartCorrectionService(
    path.join(mainDirectory, 'llm-worker.js'),
    path.join(app.getPath('userData'), 'models', 'smart-correction')
  )
  const transcriptionProviders = new SpeechRecognitionProviderRegistry([
    new LegacyAsrProvider(asrEngine)
  ])
  const clipboard = new ElectronClipboardPort()
  const input = new PlatformTextInputService()
  const activeApplications = new SystemActiveApplicationProvider()
  const internalEditor = new DeferredInternalEditorPort()
  const insertionLogger = new StructuredLogger('text-insertion', new ConsoleDiagnosticSink())
  const transactions = new ClipboardTransactionManager(clipboard, {
    logger: insertionLogger
  })
  const insertion = new TextInsertionService(
    [
      new KeyboardInsertionProvider(input),
      new AccessibilityInsertionProvider(input),
      new ClipboardSafeInsertionProvider(transactions, input),
      new ClipboardOnlyInsertionProvider(clipboard),
      new InternalEditorInsertionProvider(internalEditor)
    ],
    {
      fallbackModes: ['accessibility', 'clipboard-safe', 'internal-editor'],
      activeApplications,
      logger: insertionLogger
    }
  )
  const transformations = new TransformationRegistry(
    createBuiltInTransformations(smartCorrection)
  )
  const applicationActivator = new ActiveApplicationActivator()
  const selectedText = new SelectedTextService(clipboard, input)
  const commandUi = new CommandUiBridge()
  const voiceCommands = new VoiceCommandRegistry(
    createBuiltInVoiceCommands({
      cancel: async () => undefined,
      insertEditorText: async (context) => context.editorText,
      copyEditorText: async (context) => clipboard.writeText(context.editorText),
      openSettings: async (context) => commandUi.dispatch('open-settings', context.editorText),
      repeatLastInsertion: async (context) => context.editorText,
      clearEditor: async (context) => commandUi.dispatch('clear-editor', context.editorText),
      saveNote: async (context) => commandUi.dispatch('save-note', context.editorText),
      transformEditor: async (context, presetId, targetLanguage) =>
        transformations
          .transform(context.editorText, {
            operationId: context.operationId,
            presetId,
            targetLanguage,
            activeApplication: context.activeApplication,
            preferredTerms: [],
            allowExternalService: false,
            signal: context.signal
          })
          .then((result) => result.transformedText)
    })
  )

  return {
    asrEngine,
    smartCorrection,
    dictation: new DictationMachine(),
    transcriptionProviders,
    activeApplications,
    internalEditor,
    transformations,
    insertion,
    applicationActivator,
    selectedText,
    voiceCommands,
    commandUi,
    recording: new RecordingService(
      transcriptionProviders,
      asrEngine.id,
      smartCorrection,
      insertion,
      activeApplications,
      transformations,
      voiceCommands
    )
  }
}
