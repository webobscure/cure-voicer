import type { ActiveApplicationContext, InsertionResult } from './insertion'

export interface VoiceCommandContext {
  operationId: string
  transcript: string
  editorText: string
  activeApplication?: ActiveApplicationContext
  confirmed?: boolean
  signal?: AbortSignal
}

export interface VoiceCommandMatch {
  commandId: string
  phrase: string
  explicitPrefix: boolean
}

export interface VoiceCommandResult {
  commandId: string
  handled: boolean
  requiresConfirmation: boolean
  replacementText?: string
  insertion?: InsertionResult
}

export interface VoiceCommand {
  readonly id: string
  readonly phrases: string[]
  readonly dangerous?: boolean
  execute(context: VoiceCommandContext): Promise<VoiceCommandResult>
}
