import { useEffect, useMemo, useState } from 'react'
import type { TextTemplate } from '../../../shared/contracts'
import type { DesktopClient } from '../../app/services/desktop-client'

export function TemplatesPage({ client }: { client: DesktopClient }): React.JSX.Element {
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
      setStatus('Шаблон сохранён локально')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить шаблон')
    }
  }

  return (
    <div className="templates-feature">
      <div className="template-form">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название" />
        <input value={shortcut} onChange={(event) => setShortcut(event.target.value)} placeholder="Горячая клавиша, необязательно" />
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Текст шаблона" />
        <label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Закрепить</label>
        <button type="button" onClick={() => void save()}>Сохранить</button>
      </div>
      <input className="template-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по шаблонам" />
      <div className="template-list">
        {visible.map((template) => (
          <article className="template-card" key={template.id}>
            <div><strong>{template.pinned ? '◆ ' : ''}{template.name}</strong><span>{template.shortcut ?? 'Без горячей клавиши'}</span></div>
            <p>{template.text}</p>
            <div>
              <button type="button" onClick={() => void client.copyText(template.text).then(() => setStatus('Скопировано'))}>Копировать</button>
              <button type="button" className="danger" onClick={() => void client.removeTemplate(template.id).then(setTemplates)}>Удалить</button>
            </div>
          </article>
        ))}
      </div>
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}
