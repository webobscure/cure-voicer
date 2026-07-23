import { app } from 'electron'
import path from 'node:path'
import { createAsrEngine } from '../asr/create-engine'
import type { AsrEngine } from '../asr/types'
import { RecordingService } from '../recording-service'
import { SmartCorrectionService } from '../smart-correction-service'
import { DictationMachine } from '../../modules/dictation/dictation-machine'
import { LegacyAsrProvider } from '../../modules/transcription/legacy-asr-provider'
import { SpeechRecognitionProviderRegistry } from '../../modules/transcription/provider-registry'

export interface ApplicationServices {
  asrEngine: AsrEngine
  smartCorrection: SmartCorrectionService
  dictation: DictationMachine
  transcriptionProviders: SpeechRecognitionProviderRegistry
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

  return {
    asrEngine,
    smartCorrection,
    dictation: new DictationMachine(),
    transcriptionProviders,
    recording: new RecordingService(
      transcriptionProviders,
      asrEngine.id,
      smartCorrection
    )
  }
}
