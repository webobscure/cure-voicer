import type {
  InsertionContext,
  TextInsertionProvider
} from '../../shared/types/insertion'
import type { InternalEditorPort } from './ports'
import { runInsertionAttempt } from './provider-result'

export class InternalEditorInsertionProvider implements TextInsertionProvider {
  readonly id = 'internal-editor'
  readonly mode = 'internal-editor' as const

  constructor(private readonly editor: InternalEditorPort) {}

  async isSupported(): Promise<boolean> {
    return true
  }

  insertText(text: string, context: InsertionContext) {
    return runInsertionAttempt(this.id, context, async () => {
      await this.editor.openWithText({
        originalText: context.originalText ?? text,
        text,
        activeApplication: context.activeApplication,
        insertionMode: context.requestedMode
      })
      return 'opened-editor'
    })
  }
}
