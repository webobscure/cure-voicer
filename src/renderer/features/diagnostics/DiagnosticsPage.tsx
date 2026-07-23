import { useEffect, useState } from 'react'
import type {
  DesktopClient,
  DiagnosticsViewModel
} from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'

interface DiagnosticsPageProps {
  client: DesktopClient
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; diagnostics: DiagnosticsViewModel }
  | { status: 'error'; message: string }

export function DiagnosticsPage({ client }: DiagnosticsPageProps): React.JSX.Element {
  const { locale } = useI18n()
  const tr = (ru: string, en: string): string => locale === 'ru' ? ru : en
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    void client
      .getDiagnostics()
      .then((diagnostics) => {
        if (active) setState({ status: 'ready', diagnostics })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : tr('Не удалось получить диагностику', 'Could not load diagnostics')
        })
      })
    return () => {
      active = false
    }
  }, [client, locale])

  if (state.status === 'loading') {
    return <p className="react-diagnostics-message">{tr('Собираем безопасный отчёт…', 'Collecting a safe report…')}</p>
  }
  if (state.status === 'error') {
    return <p className="react-diagnostics-message is-error">{state.message}</p>
  }

  const diagnostics = state.diagnostics
  return (
    <div className="react-diagnostics-grid">
      <DiagnosticCard label={tr('Версия', 'Version')} value={diagnostics.appVersion} ok />
      <DiagnosticCard label="Electron / Node" value={`${diagnostics.report.electronVersion} / ${diagnostics.report.nodeVersion}`} ok />
      <DiagnosticCard label={tr('Платформа', 'Platform')} value={diagnostics.platform} ok />
      <DiagnosticCard
        label={tr('Распознавание', 'Recognition')}
        value={`${diagnostics.recognitionEngine} · ${diagnostics.recognitionState}`}
        ok={diagnostics.recognitionState === 'ready'}
      />
      <DiagnosticCard label={tr('Микрофон', 'Microphone')} value={diagnostics.report.permissions.microphone} ok={diagnostics.report.permissions.microphone === 'granted'} />
      <DiagnosticCard label={tr('Стратегии вставки', 'Insertion strategies')} value={diagnostics.report.insertion.available.join(', ') || tr('Недоступны', 'Unavailable')} ok={diagnostics.report.insertion.available.length > 0} />
      <DiagnosticCard label={tr('Активная интеграция', 'Active integration')} value={diagnostics.report.activeIntegrationId} ok />
      <DiagnosticCard label={tr('Защищённое хранилище', 'Protected storage')} value={diagnostics.report.protectedStorageAvailable ? tr('Доступно', 'Available') : tr('Недоступно', 'Unavailable')} ok={diagnostics.report.protectedStorageAvailable} />
      <DiagnosticCard
        label={tr('Глобальный ввод', 'Global input')}
        value={diagnostics.globalInputAvailable ? tr('Доступен', 'Available') : tr('Нужно разрешение', 'Permission required')}
        ok={diagnostics.globalInputAvailable}
      />
      <DiagnosticCard
        label={tr('Первичная настройка', 'Initial setup')}
        value={diagnostics.onboardingCompleted ? tr('Завершена', 'Complete') : tr('Не завершена', 'Incomplete')}
        ok={diagnostics.onboardingCompleted}
      />
      <DiagnosticCard
        label={tr('Вставка текста', 'Text insertion')}
        value={diagnostics.currentInsertion}
        ok={
          diagnostics.currentInsertion === 'keyboard' ||
          diagnostics.currentInsertion === 'accessibility'
        }
      />
      <DiagnosticCard
        label={tr('Конфликты горячих клавиш', 'Shortcut conflicts')}
        value={
          diagnostics.shortcutConflicts.length > 0
            ? diagnostics.shortcutConflicts.join(', ')
            : tr('Не обнаружены', 'None detected')
        }
        ok={diagnostics.shortcutConflicts.length === 0}
      />
      <p className="react-diagnostics-note">
        {tr('Диагностика не включает распознанный текст, содержимое буфера обмена или аудио.', 'Diagnostics never include recognized text, clipboard contents, or audio.')}
      </p>
      <div className="diagnostic-actions">
        <button type="button" onClick={() => void client.copyDiagnosticReport()}>{tr('Копировать обезличенный отчёт', 'Copy anonymized report')}</button>
        <button type="button" className="danger" onClick={() => {
          if (window.confirm(tr('Удалить настройки, историю, записи, модели и защищённые ключи? Приложение перезапустится.', 'Delete settings, history, recordings, models, and protected keys? The app will restart.'))) {
            void client.deleteAllUserData()
          }
        }}>{tr('Удалить все данные', 'Delete all data')}</button>
      </div>
    </div>
  )
}

function DiagnosticCard({
  label,
  value,
  ok
}: {
  label: string
  value: string
  ok: boolean
}): React.JSX.Element {
  return (
    <article className="react-diagnostic-card">
      <i className={ok ? 'is-ok' : 'is-warning'} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}
