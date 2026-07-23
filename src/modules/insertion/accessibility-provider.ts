import type {
  InsertionContext,
  TextInsertionProvider
} from '../../shared/types/insertion'
import type { PlatformTextInputPort } from './ports'
import { runInsertionAttempt } from './provider-result'

export class AccessibilityInsertionProvider implements TextInsertionProvider {
  readonly id = 'accessibility'
  readonly mode = 'accessibility' as const

  constructor(private readonly input: PlatformTextInputPort) {}

  isSupported(context: InsertionContext): Promise<boolean> {
    return this.input.supportsAccessibilityInsertion(context.activeApplication)
  }

  insertText(text: string, context: InsertionContext) {
    return runInsertionAttempt(this.id, context, async () => {
      await this.input.insertWithAccessibility(text, context.signal)
      return 'inserted'
    })
  }
}
