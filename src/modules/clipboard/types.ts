export interface ClipboardFormatSnapshot {
  format: string
  data: Uint8Array
}

export interface ClipboardSnapshot {
  formats: readonly ClipboardFormatSnapshot[]
}

export interface ClipboardPort {
  readSnapshot(): Promise<ClipboardSnapshot>
  writeSnapshot(snapshot: ClipboardSnapshot): Promise<void>
  writeText(text: string): Promise<void>
  readText(): Promise<string>
  clear(): Promise<void>
}

export type ClipboardTransactionOutcome =
  | 'pasted-restored'
  | 'pasted-external-change'
  | 'blocked-external-change'

export interface ClipboardTransactionResult {
  outcome: ClipboardTransactionOutcome
  previousFormatCount: number
  restored: boolean
}
