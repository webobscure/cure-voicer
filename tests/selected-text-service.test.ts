import { describe, expect, it, vi } from 'vitest'
import { SelectedTextService } from '../src/modules/selection/selected-text-service'
import type { ClipboardPort, ClipboardSnapshot } from '../src/modules/clipboard/types'
import type { PlatformTextInputPort } from '../src/modules/insertion/ports'

const textSnapshot = (text: string): ClipboardSnapshot => ({
  formats: [{ format: 'text/plain', data: new TextEncoder().encode(text) }]
})

class SelectionClipboard implements ClipboardPort {
  current = textSnapshot('clipboard-before')

  async readSnapshot(): Promise<ClipboardSnapshot> {
    return {
      formats: this.current.formats.map((entry) => ({
        format: entry.format,
        data: new Uint8Array(entry.data)
      }))
    }
  }
  async writeSnapshot(snapshot: ClipboardSnapshot): Promise<void> {
    this.current = snapshot
  }
  async writeText(text: string): Promise<void> {
    this.current = textSnapshot(text)
  }
  async readText(): Promise<string> {
    const entry = this.current.formats[0]
    return entry ? new TextDecoder().decode(entry.data) : ''
  }
  async clear(): Promise<void> {
    this.current = { formats: [] }
  }
}

function input(clipboard: SelectionClipboard): PlatformTextInputPort {
  return {
    supportsKeyboardInsertion: vi.fn(async () => true),
    supportsAccessibilityInsertion: vi.fn(async () => false),
    supportsPasteShortcut: vi.fn(async () => true),
    copyShortcut: vi.fn(async () => {
      clipboard.current = textSnapshot('selected source')
    }),
    pasteShortcut: vi.fn(async () => undefined),
    insertWithAccessibility: vi.fn(async () => undefined),
    insertWithKeyboard: vi.fn(async () => undefined)
  }
}

describe('SelectedTextService', () => {
  it('transforms selection and restores the previous clipboard', async () => {
    const clipboard = new SelectionClipboard()
    const platformInput = input(clipboard)
    const service = new SelectedTextService(clipboard, platformInput, async () => undefined)

    await expect(
      service.process(
        {
          operationId: 'operation-1',
          activeApplication: {
            platform: 'darwin',
            processId: 42,
            capturedAt: '2026-07-23T10:00:00.000Z'
          }
        },
        async (text) => text.toUpperCase()
      )
    ).resolves.toEqual({
      originalText: 'selected source',
      replacementText: 'SELECTED SOURCE',
      clipboardRestored: true
    })
    expect(platformInput.insertWithKeyboard).toHaveBeenCalledWith(
      'SELECTED SOURCE',
      undefined
    )
    expect(await clipboard.readText()).toBe('clipboard-before')
  })

  it('does not replace the source text when transformation fails', async () => {
    const clipboard = new SelectionClipboard()
    const platformInput = input(clipboard)
    const service = new SelectedTextService(clipboard, platformInput, async () => undefined)

    await expect(
      service.process(
        {
          operationId: 'operation-1',
          activeApplication: {
            platform: 'win32',
            processId: 42,
            capturedAt: '2026-07-23T10:00:00.000Z'
          }
        },
        async () => { throw new Error('model failed') }
      )
    ).rejects.toThrow('model failed')
    expect(platformInput.insertWithKeyboard).not.toHaveBeenCalled()
    expect(await clipboard.readText()).toBe('clipboard-before')
  })
})
