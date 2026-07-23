import { useEffect, useRef, useState } from 'react'
import { EditorDocument, type EditorDocumentSnapshot } from '../../../modules/editor/editor-document'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'

const presets = [
  ['none', 'Без обработки', 'No processing'], ['punctuation', 'Пунктуация', 'Punctuation'],
  ['spelling', 'Орфография', 'Spelling'], ['remove-fillers', 'Без слов-паразитов', 'Remove filler words'],
  ['remove-repetitions', 'Без повторов', 'Remove repetitions'], ['written-style', 'Письменный текст', 'Written style'],
  ['shorten', 'Сократить', 'Shorten'], ['expand', 'Расширить', 'Expand'],
  ['friendly', 'Дружелюбно', 'Friendly'], ['business', 'Деловой стиль', 'Business'],
  ['formal', 'Формально', 'Formal'], ['structured-list', 'Список', 'Structured list'],
  ['email', 'Email', 'Email'], ['message', 'Сообщение', 'Message'],
  ['technical-specification', 'Техническое задание', 'Technical specification'],
  ['translate', 'Перевод', 'Translate'], ['custom', 'Своя инструкция', 'Custom instruction']
] as const

const emptySnapshot: EditorDocumentSnapshot = {
  originalText: '',
  currentText: '',
  revisions: [],
  revisionIndex: -1,
  canUndo: false,
  canRedo: false
}

export function EditorPage({ client }: { client: DesktopClient }): React.JSX.Element {
  const { locale } = useI18n()
  const tr = (ru: string, en: string): string => locale === 'ru' ? ru : en
  const documentRef = useRef(new EditorDocument())
  const [document, setDocument] = useState(emptySnapshot)
  const [draft, setDraft] = useState('')
  const [presetId, setPresetId] = useState('written-style')
  const [customInstruction, setCustomInstruction] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [search, setSearch] = useState('')
  const [replacement, setReplacement] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      client.onInternalEditorText((payload) => {
        let snapshot = documentRef.current.open(payload.originalText)
        if (payload.text !== payload.originalText) {
          snapshot = documentRef.current.update(payload.text, 'transformed')
        }
        setDocument(snapshot)
        setDraft(snapshot.currentText)
        setStatus(
          `${tr('Текст готов', 'Text ready')} · ${payload.applicationName ?? tr('приложение не определено', 'unknown application')} · ${payload.insertionMode}`
        )
      }),
    [client, locale]
  )

  useEffect(() => {
    void client.getDefaultTransformationPreset().then(setPresetId)
  }, [client])

  useEffect(
    () =>
      client.onEditorCommand((command) => {
        if (command === 'undo') {
          applySnapshot(documentRef.current.undo())
          setStatus(tr('Последнее изменение отменено голосовой командой', 'Last change was undone by voice command'))
        }
      }),
    [client, locale]
  )

  const applySnapshot = (snapshot: EditorDocumentSnapshot): void => {
    setDocument(snapshot)
    setDraft(snapshot.currentText)
  }

  const commitDraft = (): EditorDocumentSnapshot => {
    const snapshot = documentRef.current.update(draft, 'manual')
    setDocument(snapshot)
    return snapshot
  }

  const transform = async (): Promise<void> => {
    const source = commitDraft().currentText
    if (!source.trim()) return
    setBusy(true)
    setStatus(tr('Обрабатываю локально…', 'Processing locally…'))
    try {
      const result = await client.transformText({
        text: source,
        presetId,
        ...(presetId === 'translate' ? { targetLanguage } : {}),
        ...(presetId === 'custom' ? { customInstruction } : {})
      })
      applySnapshot(documentRef.current.update(result.transformedText, 'transformed'))
      setStatus(result.changed ? `${tr('Готово', 'Done')} · ${result.durationMs} ms` : tr('Текст не изменился', 'Text was not changed'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Не удалось обработать текст', 'Could not process text'))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (): Promise<void> => {
    const text = commitDraft().currentText
    if (!text) return
    await client.copyText(text)
    setStatus(tr('Скопировано', 'Copied'))
  }

  const insert = async (): Promise<void> => {
    const text = commitDraft().currentText
    if (!text) return
    setBusy(true)
    try {
      const result = await client.insertEditorText(text)
      setStatus(result.outcome === 'inserted' ? tr('Вставлено', 'Inserted') : `${tr('Результат', 'Result')}: ${result.outcome}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr('Не удалось вставить текст', 'Could not insert text'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="editor-feature">
      <div className="editor-toolbar">
        <select value={presetId} onChange={(event) => {
          setPresetId(event.target.value)
          void client.setDefaultTransformationPreset(event.target.value)
        }}>
          {presets.map(([id, ru, en]) => <option key={id} value={id}>{tr(ru, en)}</option>)}
        </select>
        {presetId === 'translate' && (
          <input value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} placeholder={tr('Язык', 'Language')} />
        )}
        {presetId === 'custom' && (
          <input value={customInstruction} onChange={(event) => setCustomInstruction(event.target.value)} placeholder={tr('Инструкция', 'Instruction')} />
        )}
        <button type="button" disabled={busy || !draft.trim()} onClick={() => void transform()}>{tr('Обработать', 'Process')}</button>
        <button type="button" disabled={!document.canUndo} onClick={() => applySnapshot(documentRef.current.undo())}>{tr('Отменить', 'Undo')}</button>
        <button type="button" disabled={!document.canRedo} onClick={() => applySnapshot(documentRef.current.redo())}>{tr('Повторить', 'Redo')}</button>
        <button type="button" disabled={!draft.trim()} onClick={() => void copy()}>{tr('Копировать', 'Copy')}</button>
        <button type="button" disabled={busy || !draft.trim()} onClick={() => void insert()}>{tr('Вставить', 'Insert')}</button>
      </div>
      <div className="editor-compare">
        <label><span>{tr('Исходный текст', 'Original text')}</span><textarea readOnly value={document.originalText} /></label>
        <label><span>{tr('Результат', 'Result')}</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} /></label>
      </div>
      <div className="editor-find">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Найти', 'Find')} />
        <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder={tr('Заменить на', 'Replace with')} />
        <button type="button" disabled={!search} onClick={() => applySnapshot(documentRef.current.replaceAll(search, replacement))}>{tr('Заменить всё', 'Replace all')}</button>
        <span>{status || tr('Ожидает результат диктовки', 'Waiting for a dictation result')} · {tr('версий', 'revisions')}: {document.revisions.length}</span>
      </div>
    </div>
  )
}
