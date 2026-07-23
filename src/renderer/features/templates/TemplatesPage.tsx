import { useEffect, useMemo, useState } from 'react'
import type { TextTemplate } from '../../../shared/contracts'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'

export function TemplatesPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const { locale } = useI18n()
  const tr = (ru: string, en: string): string => locale === 'ru' ? ru : en
  const [templates, setTemplates] = useState<TextTemplate[]>([])
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [shortcut, setShortcut] = useState('')
  const [pinned, setPinned] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => { void client.getTemplates().then(setTemplates) }, [client])
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query
      ? templates.filter((item) => `${item.name}\n${item.text}`.toLocaleLowerCase().includes(query))
      : templates
  }, [search, templates])

  const save = async (): Promise<void> => {
    if (!name.trim() || !text.trim()) return
    try {
      setTemplates(await client.upsertTemplate({
        id: `template-${Date.now()}`,
        name: name.trim(),
        text,
        pinned,
        ...(shortcut.trim() ? { shortcut: shortcut.trim() } : {})
      }))
      setName(''); setText(''); setShortcut(''); setPinned(false)
      setStatus(tr('Шаблон сохранён локально', 'Template saved locally'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Не удалось сохранить шаблон', 'Could not save template'))
    }
  }

  return (
    <div className="templates-feature">
      <div className="template-form">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr('Название', 'Name')} />
        <input value={shortcut} onChange={(event) => setShortcut(event.target.value)} placeholder={tr('Горячая клавиша, необязательно', 'Optional keyboard shortcut')} />
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={tr('Текст шаблона', 'Template text')} />
        <label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> {tr('Закрепить', 'Pin')}</label>
        <button type="button" onClick={() => void save()}>{tr('Сохранить', 'Save')}</button>
      </div>
      <input className="template-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Поиск по шаблонам', 'Search templates')} />
      <div className="template-list">
        {visible.map((template) => (
          <article className="template-card" key={template.id}>
            <div><strong>{template.pinned ? '◆ ' : ''}{template.name}</strong><span>{template.shortcut ?? tr('Без горячей клавиши', 'No shortcut')}</span></div>
            <p>{template.text}</p>
            <div>
              <button type="button" onClick={() => void client.copyText(template.text).then(() => setStatus(tr('Скопировано', 'Copied')))}>{tr('Копировать', 'Copy')}</button>
              <button type="button" className="danger" onClick={() => void client.removeTemplate(template.id).then(setTemplates)}>{tr('Удалить', 'Remove')}</button>
            </div>
          </article>
        ))}
      </div>
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
