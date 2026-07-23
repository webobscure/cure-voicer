import { useEffect, useMemo, useState } from 'react'
import type { AppPreferences, ClipboardHistoryItem } from '../../../shared/contracts'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'

export function ClipboardSettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const { locale } = useI18n()
  const tr = (ru: string, en: string): string => locale === 'ru' ? ru : en
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
      setStatus(tr('Настройки сохранены', 'Settings saved'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Не удалось сохранить', 'Could not save settings'))
    }
  }

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query ? items.filter((item) => item.text.toLocaleLowerCase().includes(query)) : items
  }, [items, search])

  if (!preferences) return <p>{tr('Загрузка…', 'Loading…')}</p>
  return (
    <div className="clipboard-feature">
      <div className="settings-group">
        <label className="setting-row"><span className="setting-copy"><strong>{tr('Сохранять историю диктовок', 'Save dictation history')}</strong><span>{tr('По умолчанию выключено', 'Off by default')}</span></span><input type="checkbox" checked={preferences.historyEnabled} onChange={(event) => void update({ historyEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>{tr('История буфера обмена', 'Clipboard history')}</strong><span>{tr('Нет фонового мониторинга; сохраняются только операции Cure Voicer', 'No background monitoring; only Cure Voicer operations are saved')}</span></span><input type="checkbox" checked={preferences.clipboardHistoryEnabled} onChange={(event) => void update({ clipboardHistoryEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>{tr('Облачная обработка', 'Cloud processing')}</strong><span>{tr('Только для явно выбранных будущих провайдеров; сейчас внешние сервисы не подключены', 'Consent for explicitly selected future providers; no external service is currently connected')}</span></span><input type="checkbox" checked={preferences.cloudProcessingEnabled} onChange={(event) => void update({ cloudProcessingEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>{tr('Автоматические обновления', 'Automatic updates')}</strong><span>{tr('После перезапуска и только в подписанной сборке', 'Applied after restart and only in a signed packaged build')}</span></span><input type="checkbox" checked={preferences.automaticUpdatesEnabled} onChange={(event) => void update({ automaticUpdatesEnabled: event.target.checked })} /></label>
        <label className="setting-row"><span className="setting-copy"><strong>{tr('Срок хранения', 'Retention')}</strong><span>{tr('Старые записи удаляются автоматически', 'Old entries are removed automatically')}</span></span><select value={preferences.clipboardRetentionDays} onChange={(event) => void update({ clipboardRetentionDays: Number(event.target.value) })}>{[1, 7, 30, 90].map((days) => <option key={days} value={days}>{days} {tr('дн.', 'days')}</option>)}</select></label>
        <label className="setting-row"><span className="setting-copy"><strong>{tr('Тема', 'Theme')}</strong></span><select value={preferences.theme} onChange={(event) => void update({ theme: event.target.value as AppPreferences['theme'] })}><option value="system">{tr('Системная', 'System')}</option><option value="light">{tr('Светлая', 'Light')}</option><option value="dark">{tr('Тёмная', 'Dark')}</option></select></label>
        <label className="setting-row"><span className="setting-copy"><strong>{tr('Язык интерфейса', 'Interface language')}</strong></span><select value={preferences.locale} onChange={(event) => void update({ locale: event.target.value as AppPreferences['locale'] })}><option value="system">{tr('Системный', 'System')}</option><option value="ru">Русский</option><option value="en">English</option></select></label>
      </div>
      <div className="data-actions"><button type="button" onClick={() => void client.exportSettings().then((done) => setStatus(done ? tr('Настройки экспортированы', 'Settings exported') : tr('Экспорт отменён', 'Export canceled')))}>{tr('Экспорт', 'Export')}</button><button type="button" onClick={() => void client.importSettings().then((next) => { if (next) setPreferences(next); setStatus(next ? tr('Настройки импортированы', 'Settings imported') : tr('Импорт отменён', 'Import canceled')) })}>{tr('Импорт', 'Import')}</button><button type="button" className="danger" onClick={() => void client.clearClipboardHistory().then(() => { setItems([]); setStatus(tr('История буфера очищена', 'Clipboard history cleared')) })}>{tr('Очистить буфер', 'Clear clipboard')}</button></div>
      <input className="template-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Поиск в истории буфера', 'Search clipboard history')} disabled={!preferences.clipboardHistoryEnabled} />
      <div className="clipboard-list">{visible.map((item) => <button type="button" key={item.id} onClick={() => void client.copyText(item.text)}><span>{item.text}</span><small>{new Date(item.createdAt).toLocaleString(locale)}</small></button>)}</div>
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
