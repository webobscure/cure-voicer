import type {
  VoiceCommand,
  VoiceCommandContext,
  VoiceCommandResult
} from '../../shared/types/commands'
import { CallbackVoiceCommand } from './voice-command-registry'

export interface VoiceCommandActions {
  cancel(context: VoiceCommandContext): Promise<void>
  insertEditorText(context: VoiceCommandContext): Promise<string>
  copyEditorText(context: VoiceCommandContext): Promise<void>
  openSettings(context: VoiceCommandContext): Promise<void>
  repeatLastInsertion(context: VoiceCommandContext): Promise<string>
  clearEditor(context: VoiceCommandContext): Promise<void>
  saveNote(context: VoiceCommandContext): Promise<void>
  undoEditor(context: VoiceCommandContext): Promise<void>
  transformEditor(
    context: VoiceCommandContext,
    presetId: string,
    targetLanguage?: string
  ): Promise<string>
}

export function createBuiltInVoiceCommands(actions: VoiceCommandActions): VoiceCommand[] {
  return [
    action('cancel', ['отмени', 'cancel'], (context) => actions.cancel(context)),
    replacement('insert-text', ['вставь текст', 'insert text'], (context) => actions.insertEditorText(context)),
    action('copy-text', ['скопируй текст', 'copy text'], (context) => actions.copyEditorText(context)),
    action('open-settings', ['открой настройки', 'open settings'], (context) => actions.openSettings(context)),
    replacement('repeat-insertion', ['повтори последнюю вставку', 'repeat last insertion'], (context) => actions.repeatLastInsertion(context)),
    action('clear-editor', ['очисти редактор', 'clear editor'], (context) => actions.clearEditor(context), true),
    action('save-note', ['сохрани как заметку', 'save as note'], (context) => actions.saveNote(context)),
    action('undo-editor', ['отмени изменение', 'undo change'], (context) => actions.undoEditor(context)),
    replacement('delete-last-word', ['удали последнее слово', 'delete last word'], async (context) =>
      context.editorText.replace(/(?:\s+)?\S+\s*$/u, '')
    ),
    transform('shorten', ['сделай текст короче', 'make it shorter'], 'shorten', actions),
    transform('formal', ['сделай формально', 'make it formal'], 'formal', actions),
    transform('translate-en', ['переведи на английский', 'translate to english'], 'translate', actions, 'English')
  ]
}

function action(
  id: string,
  phrases: string[],
  callback: (context: VoiceCommandContext) => Promise<void>,
  dangerous = false
): VoiceCommand {
  return new CallbackVoiceCommand(
    id,
    phrases,
    async (context) => {
      await callback(context)
      return handled(id)
    },
    dangerous
  )
}

function replacement(
  id: string,
  phrases: string[],
  callback: (context: VoiceCommandContext) => Promise<string>
): VoiceCommand {
  return new CallbackVoiceCommand(id, phrases, async (context) => ({
    ...handled(id),
    replacementText: await callback(context)
  }))
}

function transform(
  id: string,
  phrases: string[],
  presetId: string,
  actions: VoiceCommandActions,
  targetLanguage?: string
): VoiceCommand {
  return new CallbackVoiceCommand(id, phrases, async (context) => ({
    ...handled(id),
    replacementText: await actions.transformEditor(context, presetId, targetLanguage)
  }))
}

function handled(commandId: string): VoiceCommandResult {
  return { commandId, handled: true, requiresConfirmation: false }
}
