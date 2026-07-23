import { PcmCaptureSession } from '../modules/dictation/audio-capture-port'
import type {
  AudioCapturePort,
  MicrophoneCaptureOptions
} from '../modules/dictation/audio-capture-port'

const TARGET_SAMPLE_RATE = 16_000
const MICROPHONE_TIMEOUT_MS = 8_000
const AUDIO_CONTEXT_TIMEOUT_MS = 5_000

export class AudioRecorder implements AudioCapturePort {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private silentOutput: GainNode | null = null
  private sourceSampleRate = TARGET_SAMPLE_RATE
  private captureSession: PcmCaptureSession | null = null
  private recordingError: Error | null = null
  private generation = 0
  private starting = false

  constructor(private readonly onLevel: (level: number) => void) {}

  async start(options: MicrophoneCaptureOptions): Promise<void> {
    if (this.context || this.starting) throw new Error('Recorder is already running')
    this.starting = true
    const generation = ++this.generation
    const { deviceId, maxDurationMs, sessionId } = options

    try {
      let microphoneRequestTimedOut = false
      const microphoneRequest = navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      void microphoneRequest.then(
        (stream) => {
          if (microphoneRequestTimedOut) {
            stream.getTracks().forEach((track) => track.stop())
          }
        },
        () => undefined
      )
      try {
        const stream = await withTimeout(
          microphoneRequest,
          MICROPHONE_TIMEOUT_MS,
          'Микрофон не ответил. Проверьте разрешение в системных настройках.'
        )
        this.stream = stream
        this.assertGeneration(generation)
      } catch (error) {
        microphoneRequestTimedOut = true
        throw error
      }

      this.context = new AudioContext({ latencyHint: 'interactive' })
      this.sourceSampleRate = this.context.sampleRate
      this.captureSession = new PcmCaptureSession(
        sessionId,
        Math.ceil(this.sourceSampleRate * (maxDurationMs / 1_000))
      )
      this.recordingError = null
      if (this.context.state === 'suspended') {
        await withTimeout(
          this.context.resume(),
          AUDIO_CONTEXT_TIMEOUT_MS,
          'Не удалось активировать аудиосистему.'
        )
      }
      this.assertGeneration(generation)
      await withTimeout(
        this.context.audioWorklet.addModule(
          new URL('./audio-recorder-worklet.js', window.location.href).toString()
        ),
        AUDIO_CONTEXT_TIMEOUT_MS,
        'Не удалось запустить обработку аудио.'
      )
      this.assertGeneration(generation)

      this.source = this.context.createMediaStreamSource(this.stream)
      this.worklet = new AudioWorkletNode(this.context, 'cure-voicer-recorder')
      this.silentOutput = this.context.createGain()
      this.silentOutput.gain.value = 0
      this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        const samples = new Float32Array(event.data)
        try {
          this.captureSession?.append(samples)
        } catch (error) {
          this.recordingError =
            error instanceof Error ? error : new Error('Audio capture failed')
          return
        }
        this.onLevel(calculateRms(samples))
      }

      this.source.connect(this.worklet)
      this.worklet.connect(this.silentOutput)
      this.silentOutput.connect(this.context.destination)
    } catch (error) {
      await this.releaseResources()
      throw error
    } finally {
      this.starting = false
    }
  }

  async stop(): Promise<Float32Array> {
    if (!this.context) throw new Error('Recorder is not running')

    const recordingError = this.recordingError

    const sourceSamples = this.captureSession?.finish() ?? new Float32Array()
    const result = resampleLinear(
      sourceSamples,
      this.sourceSampleRate,
      TARGET_SAMPLE_RATE
    )

    await this.releaseResources()
    if (recordingError) throw recordingError
    return result
  }

  async pause(): Promise<void> {
    if (!this.context) throw new Error('Recorder is not running')
    if (this.context.state === 'running') await this.context.suspend()
  }

  async resume(): Promise<void> {
    if (!this.context) throw new Error('Recorder is not running')
    if (this.context.state === 'suspended') await this.context.resume()
  }

  async cancel(): Promise<void> {
    this.generation += 1
    await this.releaseResources()
  }

  private assertGeneration(generation: number): void {
    if (generation !== this.generation) throw new Error('Audio capture was cancelled')
  }

  private async releaseResources(): Promise<void> {
    this.source?.disconnect()
    this.worklet?.disconnect()
    this.silentOutput?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    if (this.context && this.context.state !== 'closed') await this.context.close()

    this.context = null
    this.stream = null
    this.source = null
    this.worklet = null
    this.silentOutput = null
    this.captureSession?.cancel()
    this.captureSession = null
    this.recordingError = null
    this.onLevel(0)
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function resampleLinear(
  input: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate) return input
  if (input.length === 0) return input

  const ratio = sourceRate / targetRate
  const outputLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outputLength)

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio
    const leftIndex = Math.floor(sourcePosition)
    const rightIndex = Math.min(leftIndex + 1, input.length - 1)
    const fraction = sourcePosition - leftIndex
    const left = input[leftIndex] ?? 0
    const right = input[rightIndex] ?? left
    output[index] = left + (right - left) * fraction
  }

  return output
}

function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.min(1, Math.sqrt(sum / samples.length) * 4)
}
