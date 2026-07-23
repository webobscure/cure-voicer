import { DatabaseSync } from 'node:sqlite'
import type {
  AppPreferences,
  ClipboardHistoryItem,
  DictationHistoryItem,
  OverlayPlacement,
  TextTemplate
} from '../../shared/contracts'

export interface StoredApplicationState {
  overlayPlacement: OverlayPlacement
  preferences: AppPreferences
  vocabulary: string[]
  history: DictationHistoryItem[]
}

export class LocalDatabase {
  private readonly database: DatabaseSync

  constructor(path: string) {
    this.database = new DatabaseSync(path)
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    this.migrate()
  }

  close(): void {
    this.database.close()
  }

  loadApplicationState(): StoredApplicationState | null {
    const preferences = this.readSetting('preferences')
    const overlayPlacement = this.readSetting('overlay-placement')
    const vocabulary = this.readSetting('vocabulary')
    if (!preferences || !overlayPlacement || !vocabulary) return null
    return {
      preferences: JSON.parse(preferences) as AppPreferences,
      overlayPlacement: JSON.parse(overlayPlacement) as OverlayPlacement,
      vocabulary: JSON.parse(vocabulary) as string[],
      history: this.listHistory()
    }
  }

  saveApplicationState(state: StoredApplicationState): void {
    this.transaction(() => {
      this.writeSetting('preferences', JSON.stringify(state.preferences))
      this.writeSetting('overlay-placement', JSON.stringify(state.overlayPlacement))
      this.writeSetting('vocabulary', JSON.stringify(state.vocabulary))
      this.database.exec('DELETE FROM dictation_history')
      const insert = this.database.prepare(`
        INSERT INTO dictation_history
          (id, created_at, text, duration_ms, latency_ms, insertion)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const item of state.history) {
        insert.run(item.id, item.createdAt, item.text, item.durationMs, item.latencyMs, item.insertion)
      }
    })
  }

  importLegacyOnce(state: StoredApplicationState): boolean {
    if (this.readSetting('legacy-imported') === '1' || this.loadApplicationState()) return false
    this.saveApplicationState(state)
    this.writeSetting('legacy-imported', '1')
    return true
  }

  listTemplates(): TextTemplate[] {
    return this.database.prepare(`
      SELECT id, name, text, pinned, shortcut, created_at, updated_at
      FROM templates ORDER BY pinned DESC, updated_at DESC
    `).all().map((row) => ({
      id: stringColumn(row, 'id'),
      name: stringColumn(row, 'name'),
      text: stringColumn(row, 'text'),
      pinned: numberColumn(row, 'pinned') === 1,
      shortcut: nullableStringColumn(row, 'shortcut'),
      createdAt: stringColumn(row, 'created_at'),
      updatedAt: stringColumn(row, 'updated_at')
    }))
  }

  upsertTemplate(template: TextTemplate): void {
    this.database.prepare(`
      INSERT INTO templates (id, name, text, pinned, shortcut, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        text = excluded.text,
        pinned = excluded.pinned,
        shortcut = excluded.shortcut,
        updated_at = excluded.updated_at
    `).run(template.id, template.name, template.text, template.pinned ? 1 : 0, template.shortcut ?? null, template.createdAt, template.updatedAt)
  }

  removeTemplate(id: string): void {
    this.database.prepare('DELETE FROM templates WHERE id = ?').run(id)
  }

  addClipboardItem(item: ClipboardHistoryItem): void {
    this.database.prepare(`
      INSERT INTO clipboard_history (id, text, created_at, application_id)
      VALUES (?, ?, ?, ?)
    `).run(item.id, item.text, item.createdAt, item.applicationId ?? null)
  }

  listClipboardHistory(retentionDays: number, limit = 100): ClipboardHistoryItem[] {
    this.pruneClipboardHistory(retentionDays)
    return this.database.prepare(`
      SELECT id, text, created_at, application_id
      FROM clipboard_history ORDER BY created_at DESC LIMIT ?
    `).all(limit).map((row) => ({
      id: stringColumn(row, 'id'),
      text: stringColumn(row, 'text'),
      createdAt: stringColumn(row, 'created_at'),
      applicationId: nullableStringColumn(row, 'application_id')
    }))
  }

  clearClipboardHistory(): void {
    this.database.exec('DELETE FROM clipboard_history')
  }

  private listHistory(): DictationHistoryItem[] {
    return this.database.prepare(`
      SELECT id, created_at, text, duration_ms, latency_ms, insertion
      FROM dictation_history ORDER BY created_at DESC LIMIT 100
    `).all().map((row) => ({
      id: stringColumn(row, 'id'),
      createdAt: stringColumn(row, 'created_at'),
      text: stringColumn(row, 'text'),
      durationMs: numberColumn(row, 'duration_ms'),
      latencyMs: numberColumn(row, 'latency_ms'),
      insertion: stringColumn(row, 'insertion') as DictationHistoryItem['insertion']
    }))
  }

  private pruneClipboardHistory(retentionDays: number): void {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString()
    this.database.prepare('DELETE FROM clipboard_history WHERE created_at < ?').run(cutoff)
  }

  private readSetting(key: string): string | null {
    const row = this.database.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? stringColumn(row, 'value') : null
  }

  private writeSetting(key: string, value: string): void {
    this.database.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value)
  }

  private transaction(callback: () => void): void {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      callback()
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dictation_history (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        text TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        insertion TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        shortcut TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS clipboard_history (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        application_id TEXT
      );
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (1, datetime('now'));
    `)
    const columns = this.database.prepare('PRAGMA table_info(templates)').all()
    if (!columns.some((row) => stringColumn(row, 'name') === 'shortcut')) {
      this.database.exec('ALTER TABLE templates ADD COLUMN shortcut TEXT')
    }
  }
}

function stringColumn(row: object, key: string): string {
  const value = Reflect.get(row, key)
  if (typeof value !== 'string') throw new Error(`Invalid SQLite string column: ${key}`)
  return value
}

function nullableStringColumn(row: object, key: string): string | undefined {
  const value = Reflect.get(row, key)
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`Invalid SQLite string column: ${key}`)
  return value
}

function numberColumn(row: object, key: string): number {
  const value = Reflect.get(row, key)
  if (typeof value !== 'number') throw new Error(`Invalid SQLite number column: ${key}`)
  return value
}
