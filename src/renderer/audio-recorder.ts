const TARGET_SAMPLE_RATE = 16_000
const MICROPHONE_TIMEOUT_MS = 8_000
const AUDIO_CONTEXT_TIMEOUT_MS = 5_000

export class AudioRecorder {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | null = null
  private silentOutput: GainNode | null = null
  private chunks: Float32Array[] = []
  private sourceSampleRate = TARGET_SAMPLE_RATE

  constructor(private readonly onLevel: (level: number) => void) {}

  async start(deviceId = ''): Promise<void> {
    if (this.context) throw new Error('Recorder is already running')

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
        this.stream = await withTimeout(
          microphoneRequest,
          MICROPHONE_TIMEOUT_MS,
          'Микрофон не ответил. Проверьте разрешение в системных настройках.'
        )
      } catch (error) {
        microphoneRequestTimedOut = true
        throw error
      }

      this.context = new AudioContext({ latencyHint: 'interactive' })
      this.sourceSampleRate = this.context.sampleRate
      if (this.context.state === 'suspended') {
        await withTimeout(
          this.context.resume(),
          AUDIO_CONTEXT_TIMEOUT_MS,
          'Не удалось активировать аудиосистему.'
        )
      }
      await withTimeout(
        this.context.audioWorklet.addModule(
          new URL('./audio-recorder-worklet.js', window.location.href).toString()
        ),
        AUDIO_CONTEXT_TIMEOUT_MS,
        'Не удалось запустить обработку аудио.'
      )

      this.source = this.context.createMediaStreamSource(this.stream)
      this.worklet = new AudioWorkletNode(this.context, 'cure-voicer-recorder')
      this.silentOutput = this.context.createGain()
      this.silentOutput.gain.value = 0
      this.chunks = []

      this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        const samples = new Float32Array(event.data)
        this.chunks.push(samples)
        this.onLevel(calculateRms(samples))
      }

      this.source.connect(this.worklet)
      this.worklet.connect(this.silentOutput)
      this.silentOutput.connect(this.context.destination)
    } catch (error) {
      await this.releaseResources()
      throw error
    }
  }

  async stop(): Promise<Float32Array> {
    if (!this.context) throw new Error('Recorder is not running')

    const sourceSamples = concatenate(this.chunks)
    const result = resampleLinear(
      sourceSamples,
      this.sourceSampleRate,
      TARGET_SAMPLE_RATE
    )

    await this.releaseResources()
    return result
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
    this.chunks = []
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

function concatenate(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Float32Array(length)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
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
