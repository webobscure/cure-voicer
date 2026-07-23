export interface MicrophoneCaptureOptions {
  sessionId: string
  deviceId: string
  maxDurationMs: number
}

export class AudioCaptureLimitError extends Error {
  readonly code = 'AUDIO_CAPTURE_LIMIT_EXCEEDED'

  constructor(readonly maximumSamples: number) {
    super(`Audio capture exceeds the ${maximumSamples} sample limit`)
    this.name = 'AudioCaptureLimitError'
  }
}

export class PcmCaptureSession {
  private readonly chunks: Float32Array[] = []
  private sampleCount = 0
  private closed = false

  constructor(
    readonly id: string,
    private readonly maximumSamples: number
  ) {
    if (!id) throw new Error('Audio capture session ID is required')
    if (!Number.isSafeInteger(maximumSamples) || maximumSamples <= 0) {
      throw new Error('Audio capture sample limit must be a positive safe integer')
    }
  }

  append(chunk: Float32Array): void {
    if (this.closed) throw new Error('Audio capture session is closed')
    if (this.sampleCount + chunk.length > this.maximumSamples) {
      throw new AudioCaptureLimitError(this.maximumSamples)
    }
    this.chunks.push(chunk)
    this.sampleCount += chunk.length
  }

  finish(): Float32Array {
    if (this.closed) throw new Error('Audio capture session is closed')
    this.closed = true
    const result = new Float32Array(this.sampleCount)
    let offset = 0
    for (const chunk of this.chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    this.chunks.length = 0
    return result
  }

  cancel(): void {
    this.closed = true
    this.chunks.length = 0
    this.sampleCount = 0
  }
}

export interface AudioCapturePort {
  start(options: MicrophoneCaptureOptions): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<Float32Array>
  cancel(): Promise<void>
}
