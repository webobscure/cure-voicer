import type {
  InsertionContext,
  TextInsertionProvider
} from '../../shared/types/insertion'
import type { ClipboardPort } from '../clipboard/types'
import { runInsertionAttempt } from './provider-result'

export class ClipboardOnlyInsertionProvider implements TextInsertionProvider {
  readonly id = 'clipboard-only'
  readonly mode = 'clipboard-only' as const

  constructor(private readonly clipboard: ClipboardPort) {}

  async isSupported(): Promise<boolean> {
    return true
  }

  insertText(text: string, context: InsertionContext) {
    return runInsertionAttempt(this.id, context, async () => {
      await this.clipboard.writeText(text)
      return 'copied'
    })
  }
}
