import { useEffect, useRef, useState } from 'react'
import { EditorDocument, type EditorDocumentSnapshot } from '../../../modules/editor/editor-document'
import type { DesktopClient } from '../../app/services/desktop-client'

const presets = [
  ['none', 'Без обработки'],
  ['punctuation', 'Пунктуация'],
  ['spelling', 'Орфография'],
  ['remove-fillers', 'Без слов-паразитов'],
  ['remove-repetitions', 'Без повторов'],
  ['written-style', 'Письменный текст'],
  ['shorten', 'Сократить'],
  ['expand', 'Расширить'],
  ['friendly', 'Дружелюбно'],
  ['business', 'Деловой стиль'],
  ['formal', 'Формально'],
  ['structured-list', 'Список'],
  ['email', 'Email'],
  ['message', 'Сообщение'],
  ['technical-specification', 'Техническое задание'],
  ['translate', 'Перевод'],
  ['custom', 'Своя инструкция']
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
  const documentRef = useRef(new EditorDocument())
  const [document, setDocument] = useState(emptySnapshot)
  const [draft, setDraft] = useState('')
  const [presetId, setPresetId] = useState('written-style')
  const [customInstruction, setCustomInstruction] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [search, setSearch] = useState('')
  const [replacement, setReplacement] = useState('')
  const [status, setStatus] = useState('Ожидает результат диктовки')
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
          `Текст готов · ${payload.applicationName ?? 'приложение не определено'} · ${payload.insertionMode}`
        )
      }),
    [client]
  )

  useEffect(() => {
    void client.getDefaultTransformationPreset().then(setPresetId)
  }, [client])

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
    setStatus('Обрабатываю локально…')
    try {
      const result = await client.transformText({
        text: source,
        presetId,
        ...(presetId === 'translate' ? { targetLanguage } : {}),
        ...(presetId === 'custom' ? { customInstruction } : {})
      })
      applySnapshot(documentRef.current.update(result.transformedText, 'transformed'))
      setStatus(result.changed ? `Готово · ${result.durationMs} мс` : 'Текст не изменился')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось обработать текст')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (): Promise<void> => {
    const text = commitDraft().currentText
    if (!text) return
    await client.copyText(text)
    setStatus('Скопировано')
  }

  const insert = async (): Promise<void> => {
    const text = commitDraft().currentText
    if (!text) return
    setBusy(true)
    try {
      const result = await client.insertEditorText(text)
      setStatus(result.outcome === 'inserted' ? 'Вставлено' : `Результат: ${result.outcome}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось вставить текст')
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
          {presets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        {presetId === 'translate' && (
          <input value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} placeholder="Язык" />
        )}
        {presetId === 'custom' && (
          <input value={customInstruction} onChange={(event) => setCustomInstruction(event.target.value)} placeholder="Инструкция" />
        )}
        <button type="button" disabled={busy || !draft.trim()} onClick={() => void transform()}>Обработать</button>
        <button type="button" disabled={!document.canUndo} onClick={() => applySnapshot(documentRef.current.undo())}>Отменить</button>
        <button type="button" disabled={!document.canRedo} onClick={() => applySnapshot(documentRef.current.redo())}>Повторить</button>
        <button type="button" disabled={!draft.trim()} onClick={() => void copy()}>Копировать</button>
        <button type="button" disabled={busy || !draft.trim()} onClick={() => void insert()}>Вставить</button>
      </div>
      <div className="editor-compare">
        <label><span>Исходный текст</span><textarea readOnly value={document.originalText} /></label>
        <label><span>Результат</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} /></label>
      </div>
      <div className="editor-find">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти" />
        <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="Заменить на" />
        <button type="button" disabled={!search} onClick={() => applySnapshot(documentRef.current.replaceAll(search, replacement))}>Заменить всё</button>
        <span>{status} · версий: {document.revisions.length}</span>
      </div>
    </div>
  )
}
