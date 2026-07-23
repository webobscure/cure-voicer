import { useEffect, useState } from 'react'
import type { DesktopClient } from '../../app/services/desktop-client'
import type { AppIntegrationRule } from '../../../shared/types/integrations'
import type { InsertionMode } from '../../../shared/types/insertion'

const profiles = [
  ['gmail', 'Gmail'], ['vscode', 'VS Code'], ['jetbrains', 'JetBrains IDE'],
  ['telegram', 'Telegram'], ['slack', 'Slack'], ['discord', 'Discord'],
  ['teams', 'Microsoft Teams'], ['mail', 'Apple Mail'], ['outlook', 'Outlook'],
  ['notion', 'Notion'], ['obsidian', 'Obsidian'], ['browser', 'Браузеры'],
  ['text-editor', 'Текстовые редакторы']
] as const

const insertionModes: readonly [InsertionMode, string][] = [
  ['keyboard', 'Прямой ввод'],
  ['accessibility', 'Accessibility'],
  ['clipboard-safe', 'Безопасный буфер'],
  ['clipboard-only', 'Только копировать'],
  ['internal-editor', 'В редактор']
]

const presets = [
  ['none', 'Без обработки'], ['message', 'Сообщение'], ['email', 'Email'],
  ['written-style', 'Письменный текст'], ['formal', 'Формально'],
  ['technical-specification', 'Техническое задание']
] as const

export function IntegrationSettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const [rules, setRules] = useState<AppIntegrationRule[]>([])
  const [customMatch, setCustomMatch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    void client.getPreferences().then((value) => setRules(value.integrationRules))
  }, [client])

  const save = async (next: AppIntegrationRule[]): Promise<void> => {
    setRules(next)
    try {
      await client.updatePreferences({ integrationRules: next })
      setStatus('Правила сохранены')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить правило')
    }
  }

  const updateProfile = (profileId: string, patch: Partial<AppIntegrationRule>): void => {
    const existing = rules.find((rule) => rule.match === profileId)
    const rule: AppIntegrationRule = {
      id: existing?.id ?? `profile-${profileId}`,
      match: profileId,
      enabled: true,
      blocked: false,
      ...existing,
      ...patch
    }
    void save([...rules.filter((candidate) => candidate.id !== rule.id), rule])
  }

  const addCustomRule = (): void => {
    const match = customMatch.trim()
    if (!match) return
    void save([
      ...rules,
      {
        id: `custom-${Date.now()}`,
        match,
        enabled: true,
        blocked: false,
        insertionMode: 'keyboard',
        transformationPresetId: 'none'
      }
    ])
    setCustomMatch('')
  }

  return (
    <div className="integration-settings">
      <div className="integration-grid">
        {profiles.map(([id, name]) => {
          const rule = rules.find((candidate) => candidate.match === id)
          return (
            <article className="integration-card" key={id}>
              <div className="command-setting-copy"><strong>{name}</strong><span>{id}</span></div>
              <select aria-label={`Вставка для ${name}`} value={rule?.insertionMode ?? ''} onChange={(event) => updateProfile(id, { insertionMode: event.target.value as InsertionMode })}>
                <option value="">Автоматически</option>
                {insertionModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label={`Обработка для ${name}`} value={rule?.transformationPresetId ?? ''} onChange={(event) => updateProfile(id, { transformationPresetId: event.target.value || undefined })}>
                <option value="">По умолчанию</option>
                {presets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label className="integration-block"><input type="checkbox" checked={rule?.blocked ?? false} onChange={(event) => updateProfile(id, { blocked: event.target.checked })} /> Не вставлять</label>
            </article>
          )
        })}
      </div>
      <div className="custom-rule-form">
        <input value={customMatch} onChange={(event) => setCustomMatch(event.target.value)} placeholder="Bundle ID, имя или путь приложения" />
        <button type="button" onClick={addCustomRule}>Добавить правило</button>
      </div>
      {rules.filter((rule) => rule.id.startsWith('custom-')).map((rule) => (
        <div className="custom-rule-row" key={rule.id}>
          <span>{rule.match}</span>
          <button type="button" onClick={() => void save(rules.filter((candidate) => candidate.id !== rule.id))}>Удалить</button>
        </div>
      ))}
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
