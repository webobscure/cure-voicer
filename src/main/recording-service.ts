import { app } from 'electron'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PcmRecordingPayload, RecordingResult } from '../shared/contracts'
import {
  shouldRunContextualCorrection,
  type TranscriptCorrector
} from '../shared/smart-correction'
import { encodeFloat32PcmAsWav, float32FromBytes } from './audio/wav'
import { postProcessTranscript } from '../shared/transcript-postprocessor'
import type { SpeechRecognitionProviderRegistry } from '../modules/transcription/provider-registry'
import type { TextInsertionService } from '../modules/insertion/insertion-service'
import type { ActiveApplicationProvider } from '../modules/insertion/ports'
import type { ActiveApplicationContext, InsertionMode } from '../shared/types/insertion'
import { randomUUID } from 'node:crypto'
import type { TransformationRegistry } from '../modules/transformations/transformation-registry'

export class RecordingService {
  private previousTranscript = ''

  constructor(
    private readonly transcriptionProviders: SpeechRecognitionProviderRegistry,
    private readonly defaultProviderId: string,
    private readonly transcriptCorrector?: TranscriptCorrector,
    private readonly textInserter?: TextInsertionService,
    private readonly activeApplications?: ActiveApplicationProvider,
    private readonly transformations?: TransformationRegistry
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
      operationId?: string
      activeApplication?: ActiveApplicationContext
      insertionMode?: InsertionMode
      blockedApplicationIds?: readonly string[]
      transformationPresetId?: string
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
      let transcript = postProcessTranscript(correctedText, preferredTerms)
      if (
        transcript &&
        options.transformationPresetId &&
        options.transformationPresetId !== 'none' &&
        this.transformations
      ) {
        transcript = await this.transformations
          .transform(transcript, {
            operationId: options.operationId ?? randomUUID(),
            presetId: options.transformationPresetId,
            activeApplication: options.activeApplication,
            previousText: this.previousTranscript,
            preferredTerms,
            allowExternalService: false,
            signal: options.signal
          })
          .then((result) => result.transformedText)
          .catch((error) => {
            console.warn('Default text transformation fallback is being used', error)
            return transcript
          })
      }
      if (transcript) this.previousTranscript = transcript
      const insertion = await this.insertTranscript(transcript, normalizedText, options)

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

  private async insertTranscript(
    transcript: string,
    originalText: string,
    options: {
      autoPaste?: boolean
      signal?: AbortSignal
      operationId?: string
      activeApplication?: ActiveApplicationContext
      insertionMode?: InsertionMode
      blockedApplicationIds?: readonly string[]
    }
  ): Promise<RecordingResult['insertion']> {
    if (!transcript) return 'skipped'
    if (!this.textInserter || !this.activeApplications) return 'skipped'
    const activeApplication =
      options.activeApplication ?? (await this.activeApplications.getActiveApplication())
    const requestedMode = options.autoPaste === false
      ? 'clipboard-only'
      : (options.insertionMode ?? 'keyboard')
    const result = await this.textInserter.insertText(transcript, {
      operationId: options.operationId ?? randomUUID(),
      requestedMode,
      activeApplication,
      originalText,
      blockedApplicationIds: options.blockedApplicationIds,
      allowFallback: options.autoPaste !== false,
      signal: options.signal
    })
    if (result.outcome === 'inserted') return 'pasted'
    if (result.outcome === 'copied') return 'clipboard'
    return 'skipped'
  }
}

function formatFileTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}
