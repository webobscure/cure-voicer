import { fingerprint } from '../clipboard/clipboard-transaction'
import type { ClipboardPort } from '../clipboard/types'
import type { PlatformTextInputPort } from '../insertion/ports'
import type { ActiveApplicationContext } from '../../shared/types/insertion'

export interface SelectedTextContext {
  operationId: string
  activeApplication: ActiveApplicationContext
  signal?: AbortSignal
}

export interface SelectedTextResult {
  originalText: string
  replacementText: string
  clipboardRestored: boolean
}

export class SelectedTextService {
  private tail: Promise<void> = Promise.resolve()

  constructor(
    private readonly clipboard: ClipboardPort,
    private readonly input: PlatformTextInputPort,
    private readonly wait: (milliseconds: number) => Promise<void> = defaultWait
  ) {}

  process(
    context: SelectedTextContext,
    transform: (text: string, signal?: AbortSignal) => Promise<string>
  ): Promise<SelectedTextResult> {
    const operation = this.tail.then(() => this.processExclusive(context, transform))
    this.tail = operation.then(() => undefined, () => undefined)
    return operation
  }

  private async processExclusive(
    context: SelectedTextContext,
    transform: (text: string, signal?: AbortSignal) => Promise<string>
  ): Promise<SelectedTextResult> {
    if (context.activeApplication.isSecureField) {
      throw new Error('Selected text cannot be read from a secure field')
    }
    const previous = await this.clipboard.readSnapshot()
    await this.input.copyShortcut(context.signal)
    await this.wait(120)
    const selectedSnapshot = await this.clipboard.readSnapshot()
    const selectedFingerprint = fingerprint(selectedSnapshot)
    const originalText = await this.clipboard.readText()
    if (!originalText) {
      await this.restoreIfOwned(previous, selectedFingerprint)
      throw new Error('No selected text was copied')
    }

    try {
      const replacementText = await transform(originalText, context.signal)
      if (context.signal?.aborted) throw new Error('Selected text operation was cancelled')
      await this.input.insertWithKeyboard(replacementText, context.signal)
      const clipboardRestored = await this.restoreIfOwned(previous, selectedFingerprint)
      return { originalText, replacementText, clipboardRestored }
    } catch (error) {
      await this.restoreIfOwned(previous, selectedFingerprint)
      throw error
    }
  }

  private async restoreIfOwned(
    previous: Awaited<ReturnType<ClipboardPort['readSnapshot']>>,
    ownedFingerprint: string
  ): Promise<boolean> {
    const current = await this.clipboard.readSnapshot()
    if (fingerprint(current) !== ownedFingerprint) return false
    if (previous.formats.length === 0) await this.clipboard.clear()
    else await this.clipboard.writeSnapshot(previous)
    return true
  }
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
