import type { DictationHistoryItem } from '../../shared/contracts'

export interface SettingsDataSnapshot {
  vocabulary: readonly string[]
  history: readonly DictationHistoryItem[]
}

const emptySnapshot: SettingsDataSnapshot = {
  vocabulary: [],
  history: []
}

export class SettingsDataStore {
  private snapshot: SettingsDataSnapshot = emptySnapshot
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): SettingsDataSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  update(patch: Partial<SettingsDataSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if (next.vocabulary === this.snapshot.vocabulary && next.history === this.snapshot.history) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}

export const settingsDataStore = new SettingsDataStore()
