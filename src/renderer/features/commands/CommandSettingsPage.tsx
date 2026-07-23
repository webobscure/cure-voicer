import { useEffect, useState } from 'react'
import type { DesktopClient } from '../../app/services/desktop-client'

const commands = [
  ['cancel', 'Отмена', ['отмени', 'cancel']],
  ['insert-text', 'Вставить текст', ['вставь текст', 'insert text']],
  ['copy-text', 'Скопировать текст', ['скопируй текст', 'copy text']],
  ['shorten', 'Сделать короче', ['сделай текст короче', 'make it shorter']],
  ['formal', 'Формальный стиль', ['сделай формально', 'make it formal']],
  ['translate-en', 'Перевести на английский', ['переведи на английский', 'translate to english']],
  ['open-settings', 'Открыть настройки', ['открой настройки', 'open settings']],
  ['repeat-insertion', 'Повторить вставку', ['повтори последнюю вставку', 'repeat last insertion']],
  ['clear-editor', 'Очистить редактор', ['очисти редактор', 'clear editor']],
  ['save-note', 'Сохранить заметку', ['сохрани как заметку', 'save as note']],
  ['undo-editor', 'Отменить изменение', ['отмени изменение', 'undo change']],
  ['delete-last-word', 'Удалить последнее слово', ['удали последнее слово', 'delete last word']]
] as const

type CommandPreferences = Record<string, { enabled: boolean; phrases: string[] }>

export function CommandSettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const [preferences, setPreferences] = useState<CommandPreferences>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')

  useEffect(() => {
    void client.getPreferences().then((value) => {
      setPreferences(value.voiceCommands)
      setDrafts(
        Object.fromEntries(
          commands.map(([id, , defaultPhrases]) => [
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
      setStatus('Сохранено')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить')
    }
  }

  return (
    <div className="command-settings-list">
      {commands.map(([id, name, defaultPhrases]) => {
        const configured = preferences[id]
        const enabled = configured?.enabled ?? true
        const phrases = configured?.phrases ?? [...defaultPhrases]
        const draft = drafts[id] ?? phrases.join('\n')
        return (
          <article className="command-setting-card" key={id}>
            <div className="command-setting-copy"><strong>{name}</strong><span>{id === 'clear-editor' ? 'Требует подтверждения' : 'Точное совпадение фразы'}</span></div>
            <textarea
              aria-label={`Фразы команды ${name}`}
              value={draft}
              onChange={(event) => setDrafts({ ...drafts, [id]: event.target.value })}
              onBlur={() => {
                const nextPhrases = draft
                  .split('\n')
                  .map((value) => value.trim())
                  .filter(Boolean)
                if (nextPhrases.length === 0) {
                  setStatus('У команды должна остаться хотя бы одна фраза')
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
