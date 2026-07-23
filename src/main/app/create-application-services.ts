import { app } from 'electron'
import path from 'node:path'
import { createAsrEngine } from '../asr/create-engine'
import type { AsrEngine } from '../asr/types'
import { RecordingService } from '../recording-service'
import { SmartCorrectionService } from '../smart-correction-service'

export interface ApplicationServices {
  asrEngine: AsrEngine
  smartCorrection: SmartCorrectionService
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

  return {
    asrEngine,
    smartCorrection,
    recording: new RecordingService(asrEngine, smartCorrection)
  }
}

