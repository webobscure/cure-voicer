import { app } from 'electron'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PcmRecordingPayload, RecordingResult } from '../shared/contracts'
import {
  shouldRunContextualCorrection,
  type TranscriptCorrector
} from '../shared/smart-correction'
import { encodeFloat32PcmAsWav, float32FromBytes } from './audio/wav'
import { TextInserter } from './text-inserter'
import { postProcessTranscript } from '../shared/transcript-postprocessor'
import type { SpeechRecognitionProviderRegistry } from '../modules/transcription/provider-registry'

export class RecordingService {
  private previousTranscript = ''

  constructor(
    private readonly transcriptionProviders: SpeechRecognitionProviderRegistry,
    private readonly defaultProviderId: string,
    private readonly transcriptCorrector?: TranscriptCorrector,
    private readonly textInserter = new TextInserter()
  ) {}

  get recordingsDirectory(): string {
    return path.join(app.getPath('userData'), 'recordings')
  }

  async finish(
    payload: PcmRecordingPayload,
    options: {
      autoPaste?: boolean
      keepRecording?: boolean
      preferredTerms?: string[]
      smartCorrectionEnabled?: boolean
      signal?: AbortSignal
    } = {}
  ): Promise<RecordingResult> {
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
        engine: this.defaultProviderId,
        latencyMs: 0,
        insertion: 'skipped'
      }
    }

    await mkdir(this.recordingsDirectory, { recursive: true })
    const fileName = `dictation-${formatFileTimestamp(new Date())}.wav`
    const recordingPath = path.join(this.recordingsDirectory, fileName)
    await writeFile(recordingPath, encodeFloat32PcmAsWav(samples, payload.sampleRate))

    const startedAt = performance.now()
    const keepRecording = options.keepRecording ?? false
    try {
      const result = await this.transcriptionProviders.transcribe(
        {
          kind: 'wav-file',
          path: recordingPath,
          durationMs: payload.durationMs,
          sampleRate: payload.sampleRate
        },
        {
          detectLanguage: true,
          preferredTerms: options.preferredTerms ?? [],
          signal: options.signal
        },
        this.defaultProviderId
      )
      const preferredTerms = options.preferredTerms ?? []
      const normalizedText = postProcessTranscript(result.text, preferredTerms)
      let correctedText = normalizedText
      if (
        options.smartCorrectionEnabled &&
        this.transcriptCorrector &&
        shouldRunContextualCorrection(result.text, normalizedText)
      ) {
        correctedText = await this.transcriptCorrector
          .correct(normalizedText, {
            previousText: this.previousTranscript,
            preferredTerms
          })
          .catch((error) => {
            console.warn('Smart correction fallback is being used', error)
            return normalizedText
          })
      }
      const transcript = postProcessTranscript(correctedText, preferredTerms)
      if (transcript) this.previousTranscript = transcript
      const insertion = await this.textInserter.insert(transcript, options.autoPaste ?? true)

      return {
        recordingPath: keepRecording ? recordingPath : '',
        transcript,
        engine: result.providerId,
        latencyMs: Math.round(performance.now() - startedAt),
        insertion
      }
    } finally {
      if (!keepRecording) await unlink(recordingPath).catch(() => undefined)
    }
  }
}

function formatFileTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}
