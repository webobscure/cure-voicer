import type { InternalEditorPort } from '../../modules/insertion/ports'

export type InternalEditorHandler = (text: string) => void

export class DeferredInternalEditorPort implements InternalEditorPort {
  private handler: InternalEditorHandler | null = null

  setHandler(handler: InternalEditorHandler): void {
    this.handler = handler
  }

  async openWithText(text: string): Promise<void> {
    if (!this.handler) throw new Error('Internal editor window is unavailable')
    this.handler(text)
  }
}
