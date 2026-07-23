export type ShortcutActionId =
  | 'dictation.toggle'
  | 'dictation.hold'
  | 'dictation.cancel'
  | 'dictation.preset'
  | 'selection.transform'
  | 'insertion.repeat'
  | 'editor.open'
  | 'history.open'
  | 'template.insert'

export interface ShortcutBinding {
  actionId: ShortcutActionId
  accelerator: string
  execute(): void
}

export interface ShortcutRegistrationPort {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
}

export interface ShortcutRegistrationResult {
  registered: readonly ShortcutActionId[]
  conflicts: readonly { actionId: ShortcutActionId; accelerator: string }[]
}

export class ShortcutRegistry {
  private readonly registered = new Map<ShortcutActionId, string>()

  constructor(private readonly port: ShortcutRegistrationPort) {}

  register(bindings: readonly ShortcutBinding[]): ShortcutRegistrationResult {
    const registered: ShortcutActionId[] = []
    const conflicts: { actionId: ShortcutActionId; accelerator: string }[] = []
    const seen = new Set<string>()

    for (const binding of bindings) {
      const accelerator = binding.accelerator.trim()
      if (!accelerator || seen.has(accelerator) || !this.port.register(accelerator, binding.execute)) {
        conflicts.push({ actionId: binding.actionId, accelerator })
        continue
      }
      seen.add(accelerator)
      this.registered.set(binding.actionId, accelerator)
      registered.push(binding.actionId)
    }
    return { registered, conflicts }
  }

  unregister(actionId: ShortcutActionId): void {
    const accelerator = this.registered.get(actionId)
    if (!accelerator) return
    this.port.unregister(accelerator)
    this.registered.delete(actionId)
  }

  unregisterAll(): void {
    for (const actionId of this.registered.keys()) this.unregister(actionId)
  }
}
