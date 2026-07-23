import { describe, expect, it, vi } from 'vitest'
import {
  ClipboardTransactionManager,
  fingerprint
} from '../src/modules/clipboard/clipboard-transaction'
import type {
  ClipboardPort,
  ClipboardSnapshot
} from '../src/modules/clipboard/types'

function snapshot(entries: Record<string, string>): ClipboardSnapshot {
  return {
    formats: Object.entries(entries).map(([format, value]) => ({
      format,
      data: new TextEncoder().encode(value)
    }))
  }
}

class MemoryClipboard implements ClipboardPort {
  current: ClipboardSnapshot
  readonly writes: string[] = []

  constructor(initial: ClipboardSnapshot) {
    this.current = clone(initial)
  }

  async readSnapshot(): Promise<ClipboardSnapshot> {
    return clone(this.current)
  }

  async writeSnapshot(value: ClipboardSnapshot): Promise<void> {
    this.writes.push('snapshot')
    this.current = clone(value)
  }

  async writeText(text: string): Promise<void> {
    this.writes.push(`text:${text}`)
    this.current = snapshot({ 'text/plain': text })
  }

  async clear(): Promise<void> {
    this.writes.push('clear')
    this.current = { formats: [] }
  }
}

describe('ClipboardTransactionManager', () => {
  it('restores every previous clipboard format after paste', async () => {
    const previous = snapshot({
      'text/plain': 'old',
      'text/html': '<b>old</b>',
      'image/png': 'binary-image'
    })
    const clipboard = new MemoryClipboard(previous)
    const paste = vi.fn(async () => undefined)
    const manager = new ClipboardTransactionManager(clipboard, {
      wait: async () => undefined
    })

    await expect(manager.run('operation-1', 'new', paste)).resolves.toEqual({
      outcome: 'pasted-restored',
      previousFormatCount: 3,
      restored: true
    })
    expect(fingerprint(clipboard.current)).toBe(fingerprint(previous))
    expect(paste).toHaveBeenCalledOnce()
  })

  it('does not paste or overwrite a manager change before paste', async () => {
    const clipboard = new MemoryClipboard(snapshot({ 'text/plain': 'old' }))
    const managerValue = snapshot({ 'text/plain': 'changed by Punto' })
    const paste = vi.fn(async () => undefined)
    const manager = new ClipboardTransactionManager(clipboard, {
      wait: async () => {
        clipboard.current = managerValue
      }
    })

    await expect(manager.run('operation-1', 'new', paste)).resolves.toMatchObject({
      outcome: 'blocked-external-change',
      restored: false
    })
    expect(fingerprint(clipboard.current)).toBe(fingerprint(managerValue))
    expect(paste).not.toHaveBeenCalled()
  })

  it('does not overwrite a user copy made while paste is completing', async () => {
    const clipboard = new MemoryClipboard(snapshot({ 'text/plain': 'old' }))
    const userCopy = snapshot({ 'text/plain': 'new user copy' })
    let waitCount = 0
    const manager = new ClipboardTransactionManager(clipboard, {
      wait: async () => {
        waitCount += 1
        if (waitCount === 2) clipboard.current = userCopy
      }
    })

    await expect(
      manager.run('operation-1', 'dictation', async () => undefined)
    ).resolves.toMatchObject({
      outcome: 'pasted-external-change',
      restored: false
    })
    expect(fingerprint(clipboard.current)).toBe(fingerprint(userCopy))
  })

  it('restores owned clipboard contents when paste fails', async () => {
    const previous = snapshot({ 'text/plain': 'old', 'text/rtf': '{old}' })
    const clipboard = new MemoryClipboard(previous)
    const manager = new ClipboardTransactionManager(clipboard, {
      wait: async () => undefined
    })

    await expect(
      manager.run('operation-1', 'dictation', async () => {
        throw new Error('target rejected paste')
      })
    ).rejects.toThrow('target rejected paste')
    expect(fingerprint(clipboard.current)).toBe(fingerprint(previous))
  })

  it('serializes two insertion transactions', async () => {
    const clipboard = new MemoryClipboard(snapshot({ 'text/plain': 'old' }))
    const order: string[] = []
    let releaseFirst: (() => void) | undefined
    const firstPaste = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          order.push('first-start')
          releaseFirst = () => {
            order.push('first-end')
            resolve()
          }
        })
    )
    const manager = new ClipboardTransactionManager(clipboard, {
      wait: async () => undefined
    })

    const first = manager.run('operation-1', 'one', firstPaste)
    const second = manager.run('operation-2', 'two', async () => {
      order.push('second')
    })
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf('function'))
    expect(order).toEqual(['first-start'])
    releaseFirst?.()
    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-end', 'second'])
  })
})

function clone(value: ClipboardSnapshot): ClipboardSnapshot {
  return {
    formats: value.formats.map((entry) => ({
      format: entry.format,
      data: new Uint8Array(entry.data)
    }))
  }
}
