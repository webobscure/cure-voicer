import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PcmRecordingPayload, RecordingResult } from '../shared/contracts'
import type { AsrEngine } from './asr/types'
import { encodeFloat32PcmAsWav, float32FromBytes } from './audio/wav'
import { TextInserter } from './text-inserter'

export class RecordingService {
  constructor(
    private readonly asrEngine: AsrEngine,
    private readonly textInserter = new TextInserter()
  ) {}

  get recordingsDirectory(): string {
    return path.join(app.getPath('userData'), 'recordings')
  }

  async finish(payload: PcmRecordingPayload): Promise<RecordingResult> {
    if (payload.sampleRate !== 16_000) {
      throw new Error(`Unsupported sample rate: ${payload.sampleRate}`)
    }

    const samples = float32FromBytes(payload.samples)
    if (samples.length === 0) {
      throw new Error('The recording is empty')
    }
    if (samples.length < 4_800) {
      return {
        recordingPath: '',
        transcript: '',
        engine: this.asrEngine.id,
        latencyMs: 0,
        insertion: 'skipped'
      }
    }

    await mkdir(this.recordingsDirectory, { recursive: true })
    const fileName = `dictation-${formatFileTimestamp(new Date())}.wav`
    const recordingPath = path.join(this.recordingsDirectory, fileName)
    await writeFile(recordingPath, encodeFloat32PcmAsWav(samples, payload.sampleRate))

    const startedAt = performance.now()
    const result = await this.asrEngine.transcribe(recordingPath)
    const transcript = result.text.trim()
    const insertion = await this.textInserter.insert(transcript)

    return {
      recordingPath,
      transcript,
      engine: this.asrEngine.id,
      latencyMs: Math.round(performance.now() - startedAt),
      insertion
    }
  }
}

function formatFileTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}
