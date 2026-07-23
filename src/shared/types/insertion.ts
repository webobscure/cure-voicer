export type InsertionMode =
  | 'keyboard'
  | 'accessibility'
  | 'clipboard-safe'
  | 'clipboard-only'
  | 'internal-editor'

export interface ActiveApplicationContext {
  platform: 'darwin' | 'win32' | 'linux' | 'unknown'
  applicationId?: string
  applicationName?: string
  windowTitle?: string
  processId?: number
  executablePath?: string
  isElevated?: boolean
  isSecureField?: boolean
  capturedAt: string
}

export interface InsertionContext {
  operationId: string
  requestedMode: InsertionMode
  activeApplication: ActiveApplicationContext
  blockedApplicationIds?: readonly string[]
  originalText?: string
  allowFallback: boolean
  signal?: AbortSignal
}

export type InsertionOutcome =
  | 'inserted'
  | 'copied'
  | 'opened-editor'
  | 'blocked'
  | 'cancelled'
  | 'failed'

export interface InsertionAttempt {
  providerId: string
  outcome: InsertionOutcome
  durationMs: number
  errorCode?: string
}

export interface InsertionResult {
  operationId: string
  providerId: string
  outcome: InsertionOutcome
  usedFallback: boolean
  attempts: InsertionAttempt[]
}

export interface TextInsertionProvider {
  readonly id: string
  readonly mode: InsertionMode
  isSupported(context: InsertionContext): Promise<boolean>
  insertText(text: string, context: InsertionContext): Promise<InsertionResult>
}
