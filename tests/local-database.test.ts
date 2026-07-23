import { describe, expect, it } from 'vitest'
import { LocalDatabase, type StoredApplicationState } from '../src/main/storage/local-database'
import type { AppPreferences } from '../src/shared/contracts'

describe('LocalDatabase', () => {
  it('persists state with idempotent legacy import', () => {
    const database = new LocalDatabase(':memory:')
    const state = applicationState()
    expect(database.importLegacyOnce(state)).toBe(true)
    expect(database.importLegacyOnce({ ...state, vocabulary: ['should-not-win'] })).toBe(false)
    expect(database.loadApplicationState()).toEqual(state)
    database.close()
  })

  it('stores templates and applies clipboard retention', () => {
    const database = new LocalDatabase(':memory:')
    database.upsertTemplate({
      id: 'template-1',
      name: 'Greeting',
      text: 'Hello',
      pinned: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(database.listTemplates()).toMatchObject([{ id: 'template-1', pinned: true }])
    database.addClipboardItem({
      id: 'old', text: 'old', createdAt: '2020-01-01T00:00:00.000Z'
    })
    database.addClipboardItem({
      id: 'new', text: 'new', createdAt: new Date().toISOString()
    })
    expect(database.listClipboardHistory(7).map((item) => item.id)).toEqual(['new'])
    database.removeTemplate('template-1')
    expect(database.listTemplates()).toEqual([])
    database.close()
  })
})

function applicationState(): StoredApplicationState {
  return {
    overlayPlacement: { mode: 'bottom-center' },
    preferences: preferences(),
    vocabulary: ['AbortController'],
    history: [{
      id: 'history-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      text: 'Hello',
      durationMs: 1000,
      latencyMs: 100,
      insertion: 'pasted'
    }]
  }
}

function preferences(): AppPreferences {
  return {
    launchAtLogin: false,
    activationMode: 'hold',
    accelerator: 'CommandOrControl+Shift+Space',
    holdKey: 'right-option',
    microphoneId: '',
    autoPaste: true,
    insertionMode: 'keyboard',
    blockedApplicationIds: [],
    transformationPresetId: 'none',
    shortcutBindings: {},
    voiceCommands: {},
    integrationRules: [],
    historyEnabled: false,
    clipboardHistoryEnabled: false,
    clipboardRetentionDays: 7,
    theme: 'system',
    locale: 'system',
    keepRecordings: false,
    showOverlayWhenIdle: true,
    overlayMotion: 'balanced',
    smartCorrectionEnabled: false,
    autoStopSilenceMs: 0,
    onboardingCompleted: true
  }
}
