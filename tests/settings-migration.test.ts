import { describe, expect, it } from 'vitest'
import {
  defaultSettingsV1,
  mergeSettingsV1,
  parseSettingsV1
} from '../src/shared/validation/settings'
import { migrateLegacySettings } from '../src/modules/settings/migrate-legacy-settings'

describe('settings schema', () => {
  it('uses privacy-preserving defaults', () => {
    expect(defaultSettingsV1.insertionMode).toBe('keyboard')
    expect(defaultSettingsV1.historyEnabled).toBe(false)
    expect(defaultSettingsV1.keepRecordings).toBe(false)
    expect(defaultSettingsV1.clipboardHistoryEnabled).toBe(false)
    expect(defaultSettingsV1.cloudProcessingEnabled).toBe(false)
  })

  it('rejects unknown insertion modes', () => {
    expect(() =>
      parseSettingsV1({ ...defaultSettingsV1, insertionMode: 'unsafe-paste' })
    ).toThrow()
  })

  it('fills missing values without accepting an arbitrary schema version', () => {
    expect(mergeSettingsV1({ locale: 'en', schemaVersion: 99 })).toEqual({
      ...defaultSettingsV1,
      locale: 'en'
    })
  })
})

describe('legacy settings migration', () => {
  it('preserves explicit recording retention but defaults history to off', () => {
    const migrated = migrateLegacySettings({
      preferences: { autoPaste: true, keepRecordings: true }
    })

    expect(migrated.keepRecordings).toBe(true)
    expect(migrated.historyEnabled).toBe(false)
    expect(migrated.insertionMode).toBe('keyboard')
  })

  it('maps disabled auto-paste to explicit copy mode', () => {
    const migrated = migrateLegacySettings({
      preferences: { autoPaste: false, keepRecordings: false }
    })

    expect(migrated.afterDictation).toBe('copy')
    expect(migrated.insertionMode).toBe('clipboard-only')
  })
})

