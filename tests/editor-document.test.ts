import { describe, expect, it } from 'vitest'
import { EditorDocument } from '../src/modules/editor/editor-document'

describe('EditorDocument', () => {
  it('keeps original, transformed and manual revision history', () => {
    const document = new EditorDocument(() => new Date('2026-07-23T10:00:00.000Z'))
    document.open('исходный текст')
    document.update('Обработанный текст.', 'transformed')
    const snapshot = document.update('Обработанный текст!', 'manual')

    expect(snapshot.originalText).toBe('исходный текст')
    expect(snapshot.currentText).toBe('Обработанный текст!')
    expect(snapshot.revisions.map((revision) => revision.source)).toEqual([
      'recognized',
      'transformed',
      'manual'
    ])
  })

  it('supports undo, redo and truncates redo after a new edit', () => {
    const document = new EditorDocument()
    document.open('one')
    document.update('two', 'manual')
    document.update('three', 'manual')
    expect(document.undo().currentText).toBe('two')
    expect(document.undo().currentText).toBe('one')
    expect(document.redo().currentText).toBe('two')
    document.update('replacement', 'manual')
    expect(document.snapshot.canRedo).toBe(false)
    expect(document.snapshot.revisions.map((revision) => revision.text)).toEqual([
      'one',
      'two',
      'replacement'
    ])
  })

  it('supports literal search and replace', () => {
    const document = new EditorDocument()
    document.open('useEffect + useEffect (test)')
    const snapshot = document.replaceAll('useEffect', 'useMemo')
    expect(snapshot.currentText).toBe('useMemo + useMemo (test)')
  })
})
