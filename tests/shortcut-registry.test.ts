import { describe, expect, it, vi } from 'vitest'
import { ShortcutRegistry } from '../src/modules/shortcuts/shortcut-registry'

describe('ShortcutRegistry', () => {
  it('reports OS and intra-application conflicts by action ID', () => {
    const register = vi.fn((accelerator: string) => accelerator !== 'Cmd+Taken')
    const registry = new ShortcutRegistry({ register, unregister: vi.fn() })
    const result = registry.register([
      { actionId: 'editor.open', accelerator: 'Cmd+E', execute: vi.fn() },
      { actionId: 'history.open', accelerator: 'Cmd+Taken', execute: vi.fn() },
      { actionId: 'selection.transform', accelerator: 'Cmd+E', execute: vi.fn() }
    ])

    expect(result.registered).toEqual(['editor.open'])
    expect(result.conflicts).toEqual([
      { actionId: 'history.open', accelerator: 'Cmd+Taken' },
      { actionId: 'selection.transform', accelerator: 'Cmd+E' }
    ])
  })

  it('unregisters only accelerators owned by the registry', () => {
    const unregister = vi.fn()
    const registry = new ShortcutRegistry({ register: () => true, unregister })
    registry.register([
      { actionId: 'editor.open', accelerator: 'Cmd+E', execute: vi.fn() },
      { actionId: 'history.open', accelerator: 'Cmd+H', execute: vi.fn() }
    ])
    registry.unregisterAll()
    expect(unregister.mock.calls.flat()).toEqual(['Cmd+E', 'Cmd+H'])
  })
})
