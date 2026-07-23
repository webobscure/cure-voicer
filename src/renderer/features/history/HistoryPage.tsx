import { useState, useSyncExternalStore } from 'react'
import type { DictationHistoryItem } from '../../../shared/contracts'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'
import type { SettingsDataStore } from '../../app/settings-data-store'

export function HistoryPage({
  client,
  store
}: {
  client: DesktopClient
  store: SettingsDataStore
}): React.JSX.Element {
  const { locale, t } = useI18n()
  const { history } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const count = history.length === 0
    ? t('history.noEntries')
    : formatHistoryCount(history.length, locale, t)

  const clear = async (): Promise<void> => {
    if (history.length === 0 || busy || !window.confirm(t('history.clearConfirm'))) return
    setBusy(true)
    try {
      await client.clearHistory()
      store.update({ history: [] })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      store.update({ history: await client.removeHistoryEntry(id) })
    } finally {
      setBusy(false)
    }
  }

  const copy = async (item: DictationHistoryItem): Promise<void> => {
    await client.copyText(item.text)
    setCopiedId(item.id)
    window.setTimeout(() => setCopiedId((current) => current === item.id ? null : current), 1_200)
  }

  return (
    <div className="history-feature">
      <div className="history-toolbar">
        <div><strong>{t('history.localHistory')}</strong><span>{count}</span></div>
        <button className="danger-button" type="button" disabled={busy || history.length === 0} onClick={() => void clear()}>{t('history.clear')}</button>
      </div>
      {history.length === 0 ? (
        <div className="history-empty">
          <div className="empty-pane-icon blue" aria-hidden="true">⌚</div>
          <h2>{t('history.emptyTitle')}</h2>
          <p>{t('history.emptyDetail')}</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <article className="history-entry" key={item.id}>
              <div className="history-entry-meta">
                <span>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt))}</span>
                <span>{formatDuration(item.durationMs, locale)} · {item.latencyMs} {t('history.milliseconds')}</span>
              </div>
              <p>{item.text}</p>
              <div className="history-entry-actions">
                <button type="button" onClick={() => void copy(item)}>{copiedId === item.id ? t('history.copied') : t('history.copy')}</button>
                <button type="button" disabled={busy} onClick={() => void remove(item.id)}>{t('history.remove')}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDuration(durationMs: number, locale: 'ru' | 'en'): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  if (seconds >= 60) return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return locale === 'ru' ? `${seconds} сек` : `${seconds} sec`
}

function formatHistoryCount(
  count: number,
  locale: 'ru' | 'en',
  translate: ReturnType<typeof useI18n>['t']
): string {
  const category = new Intl.PluralRules(locale).select(count)
  if (locale === 'ru') {
    if (category === 'one') return translate('history.countOne', { count })
    if (category === 'few') return translate('history.countFew', { count })
    return translate('history.countMany', { count })
  }
  return translate(category === 'one' ? 'history.countOne' : 'history.countOther', { count })
}
