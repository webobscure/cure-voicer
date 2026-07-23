import { describe, expect, it, vi } from 'vitest'
import { SettingsDataStore } from '../src/renderer/app/settings-data-store'

describe('SettingsDataStore', () => {
  it('publishes vocabulary and history snapshots without renderer globals', () => {
    const store = new SettingsDataStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const vocabulary = ['AbortController', 'TanStack Query']
    store.update({ vocabulary })
    expect(store.getSnapshot()).toMatchObject({ vocabulary, history: [] })
    expect(listener).toHaveBeenCalledOnce()
    store.update({ vocabulary })
    expect(listener).toHaveBeenCalledOnce()
    const history = [{
      id: 'history-1',
      createdAt: '2026-07-23T00:00:00.000Z',
      text: 'Use TypeScript with React.',
      durationMs: 900,
      latencyMs: 120,
      insertion: 'pasted' as const
    }]
    store.update({ history })
    expect(store.getSnapshot().history).toEqual(history)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
