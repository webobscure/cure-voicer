export const settingsPaneIds = [
  'general', 'dictation', 'models', 'vocabulary', 'history', 'editor',
  'commands', 'hotkeys', 'integrations', 'templates', 'clipboard', 'diagnostics'
] as const

export type SettingsPaneId = (typeof settingsPaneIds)[number]

export interface SettingsShellSnapshot {
  activePane: SettingsPaneId
  version: string
}

export class SettingsShellController {
  private snapshot: SettingsShellSnapshot = { activePane: 'general', version: '0.1.0' }
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): SettingsShellSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  select(pane: string): void {
    if (!isSettingsPaneId(pane) || pane === this.snapshot.activePane) return
    this.update({ activePane: pane })
  }

  setVersion(version: string): void {
    this.update({ version })
  }

  private update(patch: Partial<SettingsShellSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if (next.activePane === this.snapshot.activePane && next.version === this.snapshot.version) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}

export function isSettingsPaneId(value: string): value is SettingsPaneId {
  return (settingsPaneIds as readonly string[]).includes(value)
}

export const settingsShellController = new SettingsShellController()
