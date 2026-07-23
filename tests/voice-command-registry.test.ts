import { describe, expect, it, vi } from 'vitest'
import { CallbackVoiceCommand, VoiceCommandRegistry } from '../src/modules/commands/voice-command-registry'
import { createBuiltInVoiceCommands, type VoiceCommandActions } from '../src/modules/commands/built-in-commands'

const context = {
  operationId: 'operation-1',
  transcript: 'открой настройки',
  editorText: '',
  confirmed: false
}

describe('VoiceCommandRegistry', () => {
  it('detects only a complete command phrase or explicit command prefix', () => {
    const registry = registryWith('settings', ['открой настройки'])
    expect(registry.detect('Открой настройки.')).toMatchObject({ commandId: 'settings' })
    expect(registry.detect('Команда открой настройки')).toMatchObject({
      commandId: 'settings',
      explicitPrefix: true
    })
    expect(registry.detect('Напиши, что нужно открыть настройки завтра')).toBeNull()
  })

  it('supports custom phrases and disabling commands', () => {
    const registry = registryWith('settings', ['открой настройки'])
    registry.configure('settings', { phrases: ['покажи параметры'] })
    expect(registry.detect('покажи параметры')).toMatchObject({ commandId: 'settings' })
    expect(registry.detect('открой настройки')).toBeNull()
    registry.configure('settings', { enabled: false })
    expect(registry.detect('покажи параметры')).toBeNull()
  })

  it('requires confirmation before dangerous command execution', async () => {
    const execute = vi.fn(async () => ({
      commandId: 'clear', handled: true, requiresConfirmation: false
    }))
    const registry = new VoiceCommandRegistry([
      new CallbackVoiceCommand('clear', ['очисти редактор'], execute, true)
    ])
    const match = registry.detect('очисти редактор')
    expect(match).not.toBeNull()
    await expect(registry.execute(match!, context)).resolves.toMatchObject({
      handled: false,
      requiresConfirmation: true
    })
    expect(execute).not.toHaveBeenCalled()
    await registry.execute(match!, { ...context, confirmed: true })
    expect(execute).toHaveBeenCalledOnce()
  })

  it('edits the current editor text without treating the command phrase as dictation', async () => {
    const actions: VoiceCommandActions = {
      cancel: async () => undefined,
      insertEditorText: async (value) => value.editorText,
      copyEditorText: async () => undefined,
      openSettings: async () => undefined,
      repeatLastInsertion: async (value) => value.editorText,
      clearEditor: async () => undefined,
      saveNote: async () => undefined,
      undoEditor: async () => undefined,
      transformEditor: async (value) => value.editorText
    }
    const registry = new VoiceCommandRegistry(createBuiltInVoiceCommands(actions))
    const match = registry.detect('удали последнее слово')
    expect(match).not.toBeNull()
    await expect(
      registry.execute(match!, { ...context, editorText: 'один два три' })
    ).resolves.toMatchObject({ replacementText: 'один два' })
  })
})

function registryWith(id: string, phrases: string[]): VoiceCommandRegistry {
  return new VoiceCommandRegistry([
    new CallbackVoiceCommand(id, phrases, async () => ({
      commandId: id,
      handled: true,
      requiresConfirmation: false
    }))
  ])
}
