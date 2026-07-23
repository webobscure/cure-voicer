import { useEffect, useState } from 'react'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'

const actions = [
  ['selection.transform', 'Обработать выделенный текст', 'Process selected text'],
  ['editor.open', 'Открыть редактор', 'Open editor'],
  ['history.open', 'Открыть историю', 'Open history'],
  ['dictation.cancel', 'Отменить операцию', 'Cancel operation'],
  ['insertion.repeat', 'Повторить последнюю вставку', 'Repeat last insertion'],
  ['dictation.preset', 'Диктовка с выбранным пресетом', 'Dictate with selected preset']
] as const

export function HotkeySettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const { locale } = useI18n()
  const tr = (ru: string, en: string): string => locale === 'ru' ? ru : en
  const [bindings, setBindings] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  useEffect(() => {
    void client.getPreferences().then((value) => setBindings(value.shortcutBindings))
  }, [client])

  const save = async (actionId: string, accelerator: string): Promise<void> => {
    const next = { ...bindings, [actionId]: accelerator.trim() }
    setBindings(next)
    try {
      await client.updatePreferences({ shortcutBindings: next })
      setStatus(tr('Сохранено. Конфликты отображаются в диагностике.', 'Saved. Conflicts are shown in Diagnostics.'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Сочетание недоступно', 'Shortcut is unavailable'))
    }
  }

  return (
    <div className="command-settings-list">
      {actions.map(([id, ru, en]) => (
        <label className="command-setting-card" key={id}>
          <div className="command-setting-copy"><strong>{tr(ru, en)}</strong><span>{id}</span></div>
          <input value={bindings[id] ?? ''} onChange={(event) => setBindings({ ...bindings, [id]: event.target.value })} onBlur={(event) => void save(id, event.target.value)} placeholder="CommandOrControl+Shift+…" />
        </label>
      ))}
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
