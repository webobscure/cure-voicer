import type {
  InsertionContext,
  TextInsertionProvider
} from '../../shared/types/insertion'
import type { ClipboardTransactionManager } from '../clipboard/clipboard-transaction'
import type { PlatformTextInputPort } from './ports'
import { runInsertionAttempt } from './provider-result'

export class ClipboardSafeInsertionProvider implements TextInsertionProvider {
  readonly id = 'clipboard-safe'
  readonly mode = 'clipboard-safe' as const

  constructor(
    private readonly transactions: ClipboardTransactionManager,
    private readonly input: PlatformTextInputPort
  ) {}

  async isSupported(context: InsertionContext): Promise<boolean> {
    return this.input.supportsPasteShortcut(context.activeApplication)
  }

  insertText(text: string, context: InsertionContext) {
    return runInsertionAttempt(this.id, context, async () => {
      const transaction = await this.transactions.run(
        context.operationId,
        text,
        () => this.input.pasteShortcut(context.signal),
        context.signal
      )
      return transaction.outcome === 'blocked-external-change' ? 'blocked' : 'inserted'
    })
  }
}
