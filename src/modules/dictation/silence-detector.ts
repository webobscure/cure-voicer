export interface SilenceDetectorOptions {
  silenceMs: number
  threshold?: number
  minimumSpeechMs?: number
  initialGraceMs?: number
}

export class SilenceDetector {
  private startedAt = 0
  private voiceStartedAt: number | null = null
  private silentStartedAt: number | null = null
  private triggered = false
  private options: Required<SilenceDetectorOptions> = {
    silenceMs: 0,
    threshold: 0.04,
    minimumSpeechMs: 250,
    initialGraceMs: 700
  }

  constructor(
    private readonly onSilence: () => void,
    private readonly now: () => number = () => performance.now()
  ) {}

  reset(options: SilenceDetectorOptions): void {
    this.options = {
      threshold: 0.04,
      minimumSpeechMs: 250,
      initialGraceMs: 700,
      ...options
    }
    this.startedAt = this.now()
    this.voiceStartedAt = null
    this.silentStartedAt = null
    this.triggered = false
  }

  observe(level: number): void {
    if (this.triggered || this.options.silenceMs <= 0) return
    const now = this.now()
    if (now - this.startedAt < this.options.initialGraceMs) return

    if (level >= this.options.threshold) {
      this.voiceStartedAt ??= now
      this.silentStartedAt = null
      return
    }

    if (
      this.voiceStartedAt === null ||
      now - this.voiceStartedAt < this.options.minimumSpeechMs
    ) {
      return
    }

    this.silentStartedAt ??= now
    if (now - this.silentStartedAt < this.options.silenceMs) return
    this.triggered = true
    this.onSilence()
  }
}
