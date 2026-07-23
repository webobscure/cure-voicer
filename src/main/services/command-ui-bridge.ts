export type CommandUiEvent = 'open-settings' | 'save-note' | 'clear-editor'

export class CommandUiBridge {
  private listener: ((event: CommandUiEvent, text: string) => Promise<void>) | null = null

  setListener(listener: (event: CommandUiEvent, text: string) => Promise<void>): void {
    this.listener = listener
  }

  async dispatch(event: CommandUiEvent, text: string): Promise<void> {
    if (!this.listener) throw new Error(`Command UI handler is unavailable: ${event}`)
    await this.listener(event, text)
  }
}
