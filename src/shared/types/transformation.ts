import type { ActiveApplicationContext } from './insertion'

export type TransformationPresetId =
  | 'none'
  | 'punctuation'
  | 'spelling'
  | 'remove-fillers'
  | 'remove-repetitions'
  | 'written-style'
  | 'shorten'
  | 'expand'
  | 'friendly'
  | 'business'
  | 'formal'
  | 'structured-list'
  | 'email'
  | 'message'
  | 'technical-specification'
  | 'translate'
  | 'custom'

export interface TransformationContext {
  operationId: string
  presetId: TransformationPresetId | string
  targetLanguage?: string
  customInstruction?: string
  activeApplication?: ActiveApplicationContext
  previousText?: string
  preferredTerms: string[]
  allowExternalService: boolean
  signal?: AbortSignal
}

export interface TransformationResult {
  transformationId: string
  originalText: string
  transformedText: string
  changed: boolean
  durationMs: number
}

export interface TextTransformation {
  readonly id: string
  readonly name: string
  transform(
    text: string,
    context: TransformationContext
  ): Promise<TransformationResult>
}

