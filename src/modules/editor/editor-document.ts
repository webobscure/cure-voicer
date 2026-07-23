export type EditorRevisionSource = 'recognized' | 'transformed' | 'manual'

export interface EditorRevision {
  id: number
  source: EditorRevisionSource
  text: string
  createdAt: string
}

export interface EditorDocumentSnapshot {
  originalText: string
  currentText: string
  revisions: readonly EditorRevision[]
  revisionIndex: number
  canUndo: boolean
  canRedo: boolean
}

export class EditorDocument {
  private originalText = ''
  private revisions: EditorRevision[] = []
  private revisionIndex = -1
  private nextId = 1

  constructor(private readonly now: () => Date = () => new Date()) {}

  open(text: string): EditorDocumentSnapshot {
    this.originalText = text
    this.revisions = []
    this.revisionIndex = -1
    this.nextId = 1
    this.push(text, 'recognized')
    return this.snapshot
  }

  update(text: string, source: Exclude<EditorRevisionSource, 'recognized'>): EditorDocumentSnapshot {
    if (this.revisions[this.revisionIndex]?.text === text) return this.snapshot
    this.push(text, source)
    return this.snapshot
  }

  undo(): EditorDocumentSnapshot {
    if (this.revisionIndex > 0) this.revisionIndex -= 1
    return this.snapshot
  }

  redo(): EditorDocumentSnapshot {
    if (this.revisionIndex < this.revisions.length - 1) this.revisionIndex += 1
    return this.snapshot
  }

  replaceAll(search: string, replacement: string, matchCase = false): EditorDocumentSnapshot {
    if (!search) return this.snapshot
    const flags = matchCase ? 'gu' : 'giu'
    const pattern = new RegExp(escapeRegExp(search), flags)
    return this.update(this.currentText.replace(pattern, replacement), 'manual')
  }

  get snapshot(): EditorDocumentSnapshot {
    return {
      originalText: this.originalText,
      currentText: this.currentText,
      revisions: this.revisions.map((revision) => ({ ...revision })),
      revisionIndex: this.revisionIndex,
      canUndo: this.revisionIndex > 0,
      canRedo: this.revisionIndex < this.revisions.length - 1
    }
  }

  private get currentText(): string {
    return this.revisions[this.revisionIndex]?.text ?? ''
  }

  private push(text: string, source: EditorRevisionSource): void {
    this.revisions = this.revisions.slice(0, this.revisionIndex + 1)
    this.revisions.push({
      id: this.nextId,
      source,
      text,
      createdAt: this.now().toISOString()
    })
    this.nextId += 1
    this.revisionIndex = this.revisions.length - 1
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
