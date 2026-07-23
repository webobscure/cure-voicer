export type CommandUiEvent = 'open-settings' | 'save-note' | 'clear-editor' | 'undo-editor'

export class CommandUiBridge {
  private listener: ((event: CommandUiEvent, text: string) => Promise<void>) | null = null
  private confirmationListener: ((commandId: string) => Promise<boolean>) | null = null

  setListener(listener: (event: CommandUiEvent, text: string) => Promise<void>): void {
    this.listener = listener
  }

  async dispatch(event: CommandUiEvent, text: string): Promise<void> {
    if (!this.listener) throw new Error(`Command UI handler is unavailable: ${event}`)
    await this.listener(event, text)
  }

  setConfirmationListener(listener: (commandId: string) => Promise<boolean>): void {
    this.confirmationListener = listener
  }

  async confirm(commandId: string): Promise<boolean> {
    if (!this.confirmationListener) return false
    return this.confirmationListener(commandId)
  }
}
