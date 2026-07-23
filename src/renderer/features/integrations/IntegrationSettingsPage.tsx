import { useEffect, useState } from 'react'
import type { DesktopClient } from '../../app/services/desktop-client'
import type { AppIntegrationRule } from '../../../shared/types/integrations'
import type { InsertionMode } from '../../../shared/types/insertion'
import { useI18n } from '../../app/i18n/i18n-context'

const profiles = [
  ['gmail', 'Gmail'], ['vscode', 'VS Code'], ['jetbrains', 'JetBrains IDE'],
  ['telegram', 'Telegram'], ['slack', 'Slack'], ['discord', 'Discord'],
  ['teams', 'Microsoft Teams'], ['mail', 'Apple Mail'], ['outlook', 'Outlook'],
  ['notion', 'Notion', 'Notion'], ['obsidian', 'Obsidian', 'Obsidian'], ['browser', 'Браузеры', 'Browsers'],
  ['text-editor', 'Текстовые редакторы', 'Text editors']
] as const

const insertionModes: readonly [InsertionMode, string, string][] = [
  ['keyboard', 'Прямой ввод', 'Direct typing'], ['accessibility', 'Accessibility', 'Accessibility'],
  ['clipboard-safe', 'Безопасный буфер', 'Safe clipboard'], ['clipboard-only', 'Только копировать', 'Copy only'],
  ['internal-editor', 'В редактор', 'Open in editor']
]

const presets = [
  ['none', 'Без обработки', 'No processing'], ['message', 'Сообщение', 'Message'], ['email', 'Email', 'Email'],
  ['written-style', 'Письменный текст', 'Written style'], ['formal', 'Формально', 'Formal'],
  ['technical-specification', 'Техническое задание', 'Technical specification']
] as const

export function IntegrationSettingsPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const { locale } = useI18n()
  const tr = (ru: string, en: string): string => locale === 'ru' ? ru : en
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
      setStatus(tr('Правила сохранены', 'Rules saved'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Не удалось сохранить правило', 'Could not save rule'))
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
        {profiles.map(([id, ruName, enName = ruName]) => {
          const name = tr(ruName, enName)
          const rule = rules.find((candidate) => candidate.match === id)
          return (
            <article className="integration-card" key={id}>
              <div className="command-setting-copy"><strong>{name}</strong><span>{id}</span></div>
              <select aria-label={`${tr('Вставка для', 'Insertion for')} ${name}`} value={rule?.insertionMode ?? ''} onChange={(event) => updateProfile(id, { insertionMode: event.target.value as InsertionMode })}>
                <option value="">{tr('Автоматически', 'Automatic')}</option>
                {insertionModes.map(([value, ru, en]) => <option key={value} value={value}>{tr(ru, en)}</option>)}
              </select>
              <select aria-label={`${tr('Обработка для', 'Processing for')} ${name}`} value={rule?.transformationPresetId ?? ''} onChange={(event) => updateProfile(id, { transformationPresetId: event.target.value || undefined })}>
                <option value="">{tr('По умолчанию', 'Default')}</option>
                {presets.map(([value, ru, en]) => <option key={value} value={value}>{tr(ru, en)}</option>)}
              </select>
              <label className="integration-block"><input type="checkbox" checked={rule?.blocked ?? false} onChange={(event) => updateProfile(id, { blocked: event.target.checked })} /> {tr('Не вставлять', 'Do not insert')}</label>
            </article>
          )
        })}
      </div>
      <div className="custom-rule-form">
        <input value={customMatch} onChange={(event) => setCustomMatch(event.target.value)} placeholder={tr('Bundle ID, имя или путь приложения', 'Bundle ID, application name, or path')} />
        <button type="button" onClick={addCustomRule}>{tr('Добавить правило', 'Add rule')}</button>
      </div>
      {rules.filter((rule) => rule.id.startsWith('custom-')).map((rule) => (
        <div className="custom-rule-row" key={rule.id}>
          <span>{rule.match}</span>
          <button type="button" onClick={() => void save(rules.filter((candidate) => candidate.id !== rule.id))}>{tr('Удалить', 'Remove')}</button>
        </div>
      ))}
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
