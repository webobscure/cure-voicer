import { describe, expect, it, vi } from 'vitest'
import { KeyboardInsertionProvider } from '../src/modules/insertion/keyboard-provider'
import type { PlatformTextInputPort } from '../src/modules/insertion/ports'
import type { InsertionContext } from '../src/shared/types/insertion'

describe('KeyboardInsertionProvider', () => {
  it('passes mixed Unicode, emoji and newlines without layout conversion', async () => {
    const insertWithKeyboard = vi.fn(async () => undefined)
    const input: PlatformTextInputPort = {
      supportsKeyboardInsertion: vi.fn(async () => true),
      supportsAccessibilityInsertion: vi.fn(async () => false),
      supportsPasteShortcut: vi.fn(async () => true),
      insertWithKeyboard,
      insertWithAccessibility: vi.fn(async () => undefined),
      pasteShortcut: vi.fn(async () => undefined)
    }
    const provider = new KeyboardInsertionProvider(input)
    const context: InsertionContext = {
      operationId: 'operation-1',
      requestedMode: 'keyboard',
      activeApplication: {
        platform: 'win32',
        applicationName: 'Editor',
        capturedAt: '2026-07-23T10:00:00.000Z'
      },
      allowFallback: true
    }
    const text = 'Привет, AbortController 👋\n第二行'

    await expect(provider.insertText(text, context)).resolves.toMatchObject({
      outcome: 'inserted'
    })
    expect(insertWithKeyboard).toHaveBeenCalledWith(text, undefined)
  })
})
