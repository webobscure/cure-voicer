import { useState, useSyncExternalStore } from 'react'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'
import type { SettingsDataStore } from '../../app/settings-data-store'

export function VocabularyPage({
  client,
  store
}: {
  client: DesktopClient
  store: SettingsDataStore
}): React.JSX.Element {
  const { t } = useI18n()
  const { vocabulary } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async (): Promise<void> => {
    if (!term.trim() || busy) return
    setBusy(true)
    try {
      store.update({ vocabulary: await client.addVocabularyTerm(term) })
      setTerm('')
      setStatus(t('vocabulary.saved'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('vocabulary.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (value: string): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      store.update({ vocabulary: await client.removeVocabularyTerm(value) })
      setStatus(t('vocabulary.removed'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('vocabulary.removeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vocabulary-feature">
      <form className="vocabulary-form" onSubmit={(event) => { event.preventDefault(); void add() }}>
        <input
          value={term}
          maxLength={80}
          autoComplete="off"
          placeholder={t('vocabulary.placeholder')}
          aria-label={t('vocabulary.inputLabel')}
          onChange={(event) => setTerm(event.target.value)}
        />
        <button type="submit" disabled={busy || !term.trim()}>{t('vocabulary.add')}</button>
      </form>
      <div className="inline-message" role="status">{status}</div>
      <div className="group-label vocabulary-label">
        {t('vocabulary.savedTerms')} <span>{vocabulary.length}</span>
      </div>
      <div className="vocabulary-list settings-group">
        {vocabulary.length === 0 ? (
          <div className="list-empty-row">{t('vocabulary.empty')}</div>
        ) : vocabulary.map((value) => (
          <div className="vocabulary-row" key={value}>
            <div className="setting-copy"><strong>{value}</strong><span>{t('vocabulary.preferredSpelling')}</span></div>
            <button
              type="button"
              className="icon-button"
              disabled={busy}
              aria-label={t('vocabulary.removeLabel', { term: value })}
              onClick={() => void remove(value)}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
