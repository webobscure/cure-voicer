import { useEffect, useMemo, useState } from 'react'
import type { AppPreferences, ClipboardHistoryItem } from '../../../shared/contracts'
import type { DesktopClient } from '../../app/services/desktop-client'

export function ClipboardSettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const [preferences, setPreferences] = useState<AppPreferences | null>(null)
  const [items, setItems] = useState<ClipboardHistoryItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    void Promise.all([client.getPreferences(), client.getClipboardHistory()]).then(([next, history]) => {
      setPreferences(next); setItems(history)
    })
  }, [client])

  const update = async (patch: Partial<AppPreferences>): Promise<void> => {
    try {
      setPreferences(await client.updatePreferences(patch))
      setItems(await client.getClipboardHistory())
      setStatus('Настройки сохранены')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить')
    }
  }

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query ? items.filter((item) => item.text.toLocaleLowerCase().includes(query)) : items
  }, [items, search])

  if (!preferences) return <p>Загрузка…</p>
  return (
    <div className="clipboard-feature">
      <div className="settings-group">
        <label className="setting-row"><span className="setting-copy"><strong>Сохранять историю диктовок</strong><span>По умолчанию выключено</span></span><input type="checkbox" checked={preferences.historyEnabled} onChange={(event) => void update({ historyEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>История буфера обмена</strong><span>Нет фонового мониторинга; сохраняются только операции Cure Voicer</span></span><input type="checkbox" checked={preferences.clipboardHistoryEnabled} onChange={(event) => void update({ clipboardHistoryEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>Облачная обработка</strong><span>Разрешение для будущих явно выбранных провайдеров; сейчас внешние сервисы не подключены</span></span><input type="checkbox" checked={preferences.cloudProcessingEnabled} onChange={(event) => void update({ cloudProcessingEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>Автоматические обновления</strong><span>Применяется после перезапуска и только в подписанной packaged-сборке</span></span><input type="checkbox" checked={preferences.automaticUpdatesEnabled} onChange={(event) => void update({ automaticUpdatesEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>Срок хранения</strong><span>Старые записи удаляются автоматически</span></span><select value={preferences.clipboardRetentionDays} onChange={(event) => void update({ clipboardRetentionDays: Number(event.target.value) })}><option value="1">1 день</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option></select></label>
        <label className="setting-row"><span className="setting-copy"><strong>Тема</strong></span><select value={preferences.theme} onChange={(event) => void update({ theme: event.target.value as AppPreferences['theme'] })}><option value="system">Системная</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>
        <label className="setting-row"><span className="setting-copy"><strong>Язык интерфейса</strong></span><select value={preferences.locale} onChange={(event) => void update({ locale: event.target.value as AppPreferences['locale'] })}><option value="system">Системный</option><option value="ru">Русский</option><option value="en">English</option></select></label>
      </div>
      <div className="data-actions"><button type="button" onClick={() => void client.exportSettings().then((done) => setStatus(done ? 'Настройки экспортированы' : 'Экспорт отменён'))}>Экспорт</button><button type="button" onClick={() => void client.importSettings().then((next) => { if (next) setPreferences(next); setStatus(next ? 'Настройки импортированы' : 'Импорт отменён') })}>Импорт</button><button type="button" className="danger" onClick={() => void client.clearClipboardHistory().then(() => { setItems([]); setStatus('История буфера очищена') })}>Очистить буфер</button></div>
      <input className="template-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск в истории буфера" disabled={!preferences.clipboardHistoryEnabled} />
      <div className="clipboard-list">{visible.map((item) => <button type="button" key={item.id} onClick={() => void client.copyText(item.text)}><span>{item.text}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</div>
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
