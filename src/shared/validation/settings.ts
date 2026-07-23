import { z } from 'zod'

export const insertionModeSchema = z.enum([
  'keyboard',
  'accessibility',
  'clipboard-safe',
  'clipboard-only',
  'internal-editor'
])

export const themeSchema = z.enum(['system', 'light', 'dark'])
export const localeSchema = z.enum(['ru', 'en'])
export const afterDictationActionSchema = z.enum([
  'insert',
  'preview',
  'copy',
  'history-only',
  'command'
])

export const settingsV1Schema = z.object({
  schemaVersion: z.literal(1),
  locale: localeSchema,
  theme: themeSchema,
  insertionMode: insertionModeSchema,
  fallbackInsertionModes: z.array(insertionModeSchema).max(5),
  afterDictation: afterDictationActionSchema,
  historyEnabled: z.boolean(),
  keepRecordings: z.boolean(),
  clipboardHistoryEnabled: z.boolean(),
  cloudProcessingEnabled: z.boolean(),
  transformationPresetId: z.string().trim().min(1).max(100),
  autoStopSilenceMs: z.number().int().min(0).max(30_000),
  sensitiveApplicationIds: z.array(z.string().trim().min(1).max(512)).max(500)
})

export type SettingsV1 = z.infer<typeof settingsV1Schema>

export const defaultSettingsV1: SettingsV1 = {
  schemaVersion: 1,
  locale: 'ru',
  theme: 'system',
  insertionMode: 'keyboard',
  fallbackInsertionModes: [
    'accessibility',
    'clipboard-safe',
    'internal-editor'
  ],
  afterDictation: 'insert',
  historyEnabled: false,
  keepRecordings: false,
  clipboardHistoryEnabled: false,
  cloudProcessingEnabled: false,
  transformationPresetId: 'none',
  autoStopSilenceMs: 0,
  sensitiveApplicationIds: []
}

export function parseSettingsV1(input: unknown): SettingsV1 {
  return settingsV1Schema.parse(input)
}

export function mergeSettingsV1(input: unknown): SettingsV1 {
  if (!input || typeof input !== 'object') return { ...defaultSettingsV1 }
  return settingsV1Schema.parse({ ...defaultSettingsV1, ...input, schemaVersion: 1 })
}

