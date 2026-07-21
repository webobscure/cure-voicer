import type { AsrStatus } from './contracts'

export const WINDOWS_PARAKEET_MODEL_NAME = 'Parakeet TDT 0.6B V3 INT8'
export const WINDOWS_PARAKEET_MODEL_REVISION =
  '2bda32ec70b097a55adaa07d9a7173915b43cc78'
export const WINDOWS_PARAKEET_MODEL_REPOSITORY =
  'csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8'

export interface WindowsParakeetModelFile {
  name: 'encoder.int8.onnx' | 'decoder.int8.onnx' | 'joiner.int8.onnx' | 'tokens.txt'
  size: number
  sha256: string
}

export const WINDOWS_PARAKEET_MODEL_FILES: readonly WindowsParakeetModelFile[] = [
  {
    name: 'encoder.int8.onnx',
    size: 652_184_281,
    sha256: 'acfc2b4456377e15d04f0243af540b7fe7c992f8d898d751cf134c3a55fd2247'
  },
  {
    name: 'decoder.int8.onnx',
    size: 11_845_275,
    sha256: '179e50c43d1a9de79c8a24149a2f9bac6eb5981823f2a2ed88d655b24248db4e'
  },
  {
    name: 'joiner.int8.onnx',
    size: 6_355_277,
    sha256: '3164c13fc2821009440d20fcb5fdc78bff28b4db2f8d0f0b329101719c0948b3'
  },
  {
    name: 'tokens.txt',
    size: 93_939,
    sha256: 'd58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d'
  }
] as const

export const WINDOWS_PARAKEET_MODEL_SIZE_BYTES = WINDOWS_PARAKEET_MODEL_FILES.reduce(
  (total, file) => total + file.size,
  0
)

export const WINDOWS_PARAKEET_MANIFEST_FILE = 'verified-model.json'

export function windowsParakeetModelUrl(fileName: string): string {
  return `https://huggingface.co/${WINDOWS_PARAKEET_MODEL_REPOSITORY}/resolve/${WINDOWS_PARAKEET_MODEL_REVISION}/${fileName}?download=true`
}

export function initialAsrStatus(
  state: AsrStatus['state'] = 'not-downloaded',
  engine = WINDOWS_PARAKEET_MODEL_NAME,
  modelName = WINDOWS_PARAKEET_MODEL_NAME,
  modelSizeBytes = WINDOWS_PARAKEET_MODEL_SIZE_BYTES
): AsrStatus {
  return {
    state,
    progress: state === 'ready' || state === 'downloaded' ? 1 : 0,
    engine,
    modelName,
    modelSizeBytes
  }
}

export type WindowsAsrWorkerRequest =
  | { id: string; type: 'prepare'; modelsDirectory: string }
  | { id: string; type: 'transcribe'; wavPath: string }

export type WindowsAsrWorkerMessage =
  | { type: 'status'; status: AsrStatus }
  | { type: 'response'; id: string; text?: string; error?: string }
