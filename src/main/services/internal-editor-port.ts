import type {
  InternalEditorDocumentInput,
  InternalEditorPort
} from '../../modules/insertion/ports'

export type InternalEditorHandler = (input: InternalEditorDocumentInput) => void

export class DeferredInternalEditorPort implements InternalEditorPort {
  private handler: InternalEditorHandler | null = null

  setHandler(handler: InternalEditorHandler): void {
    this.handler = handler
  }

  async openWithText(input: InternalEditorDocumentInput): Promise<void> {
    if (!this.handler) throw new Error('Internal editor window is unavailable')
    this.handler(input)
  }
}
