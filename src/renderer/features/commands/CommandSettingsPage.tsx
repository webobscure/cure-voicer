import { useEffect, useState } from 'react'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'

const commands = [
  ['cancel', 'Отмена', 'Cancel', ['отмени', 'cancel']],
  ['insert-text', 'Вставить текст', 'Insert text', ['вставь текст', 'insert text']],
  ['copy-text', 'Скопировать текст', 'Copy text', ['скопируй текст', 'copy text']],
  ['shorten', 'Сделать короче', 'Shorten', ['сделай текст короче', 'make it shorter']],
  ['formal', 'Формальный стиль', 'Formal style', ['сделай формально', 'make it formal']],
  ['translate-en', 'Перевести на английский', 'Translate to English', ['переведи на английский', 'translate to english']],
  ['open-settings', 'Открыть настройки', 'Open settings', ['открой настройки', 'open settings']],
  ['repeat-insertion', 'Повторить вставку', 'Repeat insertion', ['повтори последнюю вставку', 'repeat last insertion']],
  ['clear-editor', 'Очистить редактор', 'Clear editor', ['очисти редактор', 'clear editor']],
  ['save-note', 'Сохранить заметку', 'Save note', ['сохрани как заметку', 'save as note']],
  ['undo-editor', 'Отменить изменение', 'Undo change', ['отмени изменение', 'undo change']],
  ['delete-last-word', 'Удалить последнее слово', 'Delete last word', ['удали последнее слово', 'delete last word']]
] as const

type CommandPreferences = Record<string, { enabled: boolean; phrases: string[] }>

export function CommandSettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const { locale } = useI18n()
  const tr = (ru: string, en: string): string => locale === 'ru' ? ru : en
  const [preferences, setPreferences] = useState<CommandPreferences>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')

  useEffect(() => {
    void client.getPreferences().then((value) => {
      setPreferences(value.voiceCommands)
      setDrafts(
        Object.fromEntries(
          commands.map(([id, , , defaultPhrases]) => [
            id,
            (value.voiceCommands[id]?.phrases ?? defaultPhrases).join('\n')
          ])
        )
      )
    })
  }, [client])

  const save = async (next: CommandPreferences): Promise<void> => {
    setPreferences(next)
    try {
      await client.updatePreferences({ voiceCommands: next })
      setStatus(tr('Сохранено', 'Saved'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Не удалось сохранить', 'Could not save'))
    }
  }

  return (
    <div className="command-settings-list">
      {commands.map(([id, ruName, enName, defaultPhrases]) => {
        const name = tr(ruName, enName)
        const configured = preferences[id]
        const enabled = configured?.enabled ?? true
        const phrases = configured?.phrases ?? [...defaultPhrases]
        const draft = drafts[id] ?? phrases.join('\n')
        return (
          <article className="command-setting-card" key={id}>
            <div className="command-setting-copy"><strong>{name}</strong><span>{id === 'clear-editor' ? tr('Требует подтверждения', 'Requires confirmation') : tr('Точное совпадение фразы', 'Exact phrase match')}</span></div>
            <textarea
              aria-label={`${tr('Фразы команды', 'Command phrases')} ${name}`}
              value={draft}
              onChange={(event) => setDrafts({ ...drafts, [id]: event.target.value })}
              onBlur={() => {
                const nextPhrases = draft
                  .split('\n')
                  .map((value) => value.trim())
                  .filter(Boolean)
                if (nextPhrases.length === 0) {
                  setStatus(tr('У команды должна остаться хотя бы одна фраза', 'A command must keep at least one phrase'))
                  setDrafts({ ...drafts, [id]: phrases.join('\n') })
                  return
                }
                void save({ ...preferences, [id]: { enabled, phrases: nextPhrases } })
              }}
            />
            <label className="toggle-control"><input type="checkbox" checked={enabled} onChange={(event) => void save({ ...preferences, [id]: { enabled: event.target.checked, phrases } })} /><span></span></label>
          </article>
        )
      })}
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
