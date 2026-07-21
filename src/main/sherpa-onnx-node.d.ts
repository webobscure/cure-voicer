declare module 'sherpa-onnx-node' {
  export interface OfflineRecognizerResult {
    text: string
    timestamps?: number[]
    tokens?: string[]
  }

  export interface OfflineStream {
    acceptWaveform(input: { sampleRate: number; samples: Float32Array }): void
  }

  export interface OfflineRecognizerConfig {
    featConfig: { sampleRate: number; featureDim: number }
    modelConfig: {
      transducer: { encoder: string; decoder: string; joiner: string }
      tokens: string
      numThreads: number
      provider: string
      modelType: string
      debug: number
    }
  }

  export class OfflineRecognizer {
    constructor(config: OfflineRecognizerConfig)
    static createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>
    createStream(): OfflineStream
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>
  }

  export function readWave(path: string): {
    sampleRate: number
    samples: Float32Array
  }
}
