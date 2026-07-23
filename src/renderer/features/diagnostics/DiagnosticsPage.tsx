import { useEffect, useState } from 'react'
import type {
  DesktopClient,
  DiagnosticsViewModel
} from '../../app/services/desktop-client'

interface DiagnosticsPageProps {
  client: DesktopClient
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; diagnostics: DiagnosticsViewModel }
  | { status: 'error'; message: string }

export function DiagnosticsPage({ client }: DiagnosticsPageProps): React.JSX.Element {
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
          message: error instanceof Error ? error.message : 'Не удалось получить диагностику'
        })
      })
    return () => {
      active = false
    }
  }, [client])

  if (state.status === 'loading') {
    return <p className="react-diagnostics-message">Собираем безопасный отчёт…</p>
  }
  if (state.status === 'error') {
    return <p className="react-diagnostics-message is-error">{state.message}</p>
  }

  const diagnostics = state.diagnostics
  return (
    <div className="react-diagnostics-grid">
      <DiagnosticCard label="Версия" value={diagnostics.appVersion} ok />
      <DiagnosticCard label="Платформа" value={diagnostics.platform} ok />
      <DiagnosticCard
        label="Распознавание"
        value={`${diagnostics.recognitionEngine} · ${diagnostics.recognitionState}`}
        ok={diagnostics.recognitionState === 'ready'}
      />
      <DiagnosticCard
        label="Глобальный ввод"
        value={diagnostics.globalInputAvailable ? 'Доступен' : 'Нужно разрешение'}
        ok={diagnostics.globalInputAvailable}
      />
      <DiagnosticCard
        label="Первичная настройка"
        value={diagnostics.onboardingCompleted ? 'Завершена' : 'Не завершена'}
        ok={diagnostics.onboardingCompleted}
      />
      <DiagnosticCard
        label="Вставка текста"
        value={diagnostics.currentInsertion}
        ok={
          diagnostics.currentInsertion === 'keyboard' ||
          diagnostics.currentInsertion === 'accessibility'
        }
      />
      <DiagnosticCard
        label="Конфликты горячих клавиш"
        value={
          diagnostics.shortcutConflicts.length > 0
            ? diagnostics.shortcutConflicts.join(', ')
            : 'Не обнаружены'
        }
        ok={diagnostics.shortcutConflicts.length === 0}
      />
      <p className="react-diagnostics-note">
        Диагностика не включает распознанный текст, содержимое буфера обмена или аудио.
      </p>
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
