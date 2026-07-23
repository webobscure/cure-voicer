import type { ActiveApplicationContext } from '../../shared/types/insertion'

export interface PlatformTextInputPort {
  supportsKeyboardInsertion(context: ActiveApplicationContext): Promise<boolean>
  supportsAccessibilityInsertion(context: ActiveApplicationContext): Promise<boolean>
  supportsPasteShortcut(context: ActiveApplicationContext): Promise<boolean>
  insertWithKeyboard(text: string, signal?: AbortSignal): Promise<void>
  insertWithAccessibility(text: string, signal?: AbortSignal): Promise<void>
  pasteShortcut(signal?: AbortSignal): Promise<void>
}

export interface ActiveApplicationProvider {
  getActiveApplication(): Promise<ActiveApplicationContext>
}

export interface InternalEditorPort {
  openWithText(text: string): Promise<void>
}
