import { useEffect, useState } from 'react'
import type { DesktopClient } from '../../app/services/desktop-client'

const actions = [
  ['selection.transform', 'Обработать выделенный текст'],
  ['editor.open', 'Открыть редактор'],
  ['history.open', 'Открыть историю'],
  ['dictation.cancel', 'Отменить операцию'],
  ['insertion.repeat', 'Повторить последнюю вставку'],
  ['dictation.preset', 'Диктовка с выбранным пресетом']
] as const

export function HotkeySettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
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
      setStatus('Сохранено. Конфликты отображаются в диагностике.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Сочетание недоступно')
    }
  }

  return (
    <div className="command-settings-list">
      {actions.map(([id, name]) => (
        <label className="command-setting-card" key={id}>
          <div className="command-setting-copy"><strong>{name}</strong><span>{id}</span></div>
          <input value={bindings[id] ?? ''} onChange={(event) => setBindings({ ...bindings, [id]: event.target.value })} onBlur={(event) => void save(id, event.target.value)} placeholder="CommandOrControl+Shift+…" />
        </label>
      ))}
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
