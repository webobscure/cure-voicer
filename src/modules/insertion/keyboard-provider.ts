import type {
  InsertionContext,
  TextInsertionProvider
} from '../../shared/types/insertion'
import type { PlatformTextInputPort } from './ports'
import { runInsertionAttempt } from './provider-result'

export class KeyboardInsertionProvider implements TextInsertionProvider {
  readonly id = 'keyboard'
  readonly mode = 'keyboard' as const

  constructor(private readonly input: PlatformTextInputPort) {}

  isSupported(context: InsertionContext): Promise<boolean> {
    return this.input.supportsKeyboardInsertion(context.activeApplication)
  }

  insertText(text: string, context: InsertionContext) {
    return runInsertionAttempt(this.id, context, async () => {
      await this.input.insertWithKeyboard(text, context.signal)
      return 'inserted'
    })
  }
}
