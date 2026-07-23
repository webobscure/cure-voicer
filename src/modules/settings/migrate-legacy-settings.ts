import {
  defaultSettingsV1,
  mergeSettingsV1,
  type SettingsV1
} from '../../shared/validation/settings'

interface LegacyPreferences {
  autoPaste?: unknown
  insertionMode?: unknown
  keepRecordings?: unknown
}

interface LegacyState {
  preferences?: LegacyPreferences
}

export function migrateLegacySettings(input: unknown): SettingsV1 {
  if (!input || typeof input !== 'object') return { ...defaultSettingsV1 }
  const legacy = input as LegacyState
  const preferences = legacy.preferences
  return mergeSettingsV1({
    insertionMode: isInsertionMode(preferences?.insertionMode)
      ? preferences.insertionMode
      : preferences?.autoPaste === false
        ? 'clipboard-only'
        : defaultSettingsV1.insertionMode,
    afterDictation: preferences?.autoPaste === false ? 'copy' : 'insert',
    keepRecordings:
      typeof preferences?.keepRecordings === 'boolean'
        ? preferences.keepRecordings
        : defaultSettingsV1.keepRecordings
  })
}

function isInsertionMode(value: unknown): value is SettingsV1['insertionMode'] {
  return [
    'keyboard',
    'accessibility',
    'clipboard-safe',
    'clipboard-only',
    'internal-editor'
  ].includes(String(value))
}
