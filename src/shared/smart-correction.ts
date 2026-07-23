import type { SmartCorrectionStatus } from './contracts'

export const SMART_CORRECTION_MODEL_NAME = 'Qwen3.5-0.8B Q8_0'
export const SMART_CORRECTION_MODEL_FILE = 'Qwen3.5-0.8B-Q8_0.gguf'
export const SMART_CORRECTION_MODEL_URI = 'hf:ggml-org/Qwen3.5-0.8B-GGUF:Q8_0'
export const SMART_CORRECTION_MODEL_SIZE_BYTES = 834_000_000
export const SMART_CORRECTION_TIMEOUT_MS = 2_500
export const SMART_CORRECTION_MAX_CONTEXTUAL_CHARS = 160

export interface SmartCorrectionContext {
  previousText?: string
  preferredTerms?: string[]
}

export interface TranscriptCorrector {
  correct(text: string, context?: SmartCorrectionContext): Promise<string>
}

export type SmartCorrectionWorkerRequest =
  | {
      id: string
      type: 'prepare'
      modelsDirectory: string
    }
  | {
      id: string
      type: 'correct'
      text: string
      previousText?: string
      preferredTerms?: string[]
    }
  | {
      id: string
      type: 'cancel'
    }

export type SmartCorrectionWorkerMessage =
  | {
      type: 'status'
      status: SmartCorrectionStatus
    }
  | {
      type: 'response'
      id: string
      result?: string
      error?: string
    }

export function initialSmartCorrectionStatus(
  state: SmartCorrectionStatus['state'] = 'not-downloaded'
): SmartCorrectionStatus {
  return {
    state,
    progress: state === 'ready' || state === 'downloaded' ? 1 : 0,
    modelName: SMART_CORRECTION_MODEL_NAME,
    modelSizeBytes: SMART_CORRECTION_MODEL_SIZE_BYTES
  }
}

export function shouldRunContextualCorrection(raw: string, normalized: string): boolean {
  const trimmedRaw = raw.trim()
  return (
    Boolean(trimmedRaw) &&
    trimmedRaw === normalized &&
    normalized.length <= SMART_CORRECTION_MAX_CONTEXTUAL_CHARS
  )
}

export function buildCorrectionPrompt(
  text: string,
  context: SmartCorrectionContext = {}
): string {
  const previousText = cleanPromptValue(context.previousText ?? '').slice(-1_000)
  const preferredTerms = (context.preferredTerms ?? [])
    .map(cleanPromptValue)
    .filter(Boolean)
    .slice(0, 100)
    .join(', ')

  return [
    previousText ? `Previous transcript for context only:\n${previousText}` : '',
    preferredTerms ? `Preferred spellings:\n${preferredTerms}` : '',
    `Current raw transcript:\n${cleanPromptValue(text)}`,
    'Return only the corrected current transcript.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function sanitizeModelCorrection(output: string, original: string): string {
  let result = output
    .replace(/<think>[\s\S]*?<\/think>/giu, '')
    .replace(/^```(?:text)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim()

  if (
    /(?:return only the corrected|current raw transcript|previous transcript for context)/iu.test(
      result
    )
  ) {
    return original
  }

  const labeled = result.match(
    /^(?:corrected (?:current )?transcript|corrected text|исправленн(?:ая транскрипция|ый текст))\s*:\s*([\s\S]+)$/iu
  )
  if (labeled?.[1]) result = labeled[1].trim()

  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith('«') && result.endsWith('»'))
  ) {
    result = result.slice(1, -1).trim()
  }

  if (!result) return original
  const maximumLength = Math.max(original.length * 3, original.length + 240)
  if (result.length > maximumLength) return original
  return result
}

function cleanPromptValue(value: string): string {
  return value.split('\0').join('').trim()
}
