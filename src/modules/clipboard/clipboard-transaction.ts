import { createHash } from 'node:crypto'
import type { StructuredLogger } from '../diagnostics/structured-logger'
import type {
  ClipboardPort,
  ClipboardSnapshot,
  ClipboardTransactionResult
} from './types'

export interface ClipboardTransactionOptions {
  settleDelayMs?: number
  restoreDelayMs?: number
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  logger?: StructuredLogger
}

export class ClipboardTransactionManager {
  private tail: Promise<void> = Promise.resolve()
  private readonly settleDelayMs: number
  private readonly restoreDelayMs: number
  private readonly wait: (milliseconds: number, signal?: AbortSignal) => Promise<void>

  constructor(
    private readonly clipboard: ClipboardPort,
    private readonly options: ClipboardTransactionOptions = {}
  ) {
    this.settleDelayMs = options.settleDelayMs ?? 40
    this.restoreDelayMs = options.restoreDelayMs ?? 220
    this.wait = options.wait ?? abortableWait
  }

  run(
    operationId: string,
    text: string,
    paste: () => Promise<void>,
    signal?: AbortSignal
  ): Promise<ClipboardTransactionResult> {
    const operation = this.tail.then(() =>
      this.runExclusive(operationId, text, paste, signal)
    )
    this.tail = operation.then(
      () => undefined,
      () => undefined
    )
    return operation
  }

  private async runExclusive(
    operationId: string,
    text: string,
    paste: () => Promise<void>,
    signal?: AbortSignal
  ): Promise<ClipboardTransactionResult> {
    throwIfAborted(signal)
    const previous = await this.clipboard.readSnapshot()
    await this.clipboard.writeText(text)
    const temporary = await this.clipboard.readSnapshot()
    const temporaryFingerprint = fingerprint(temporary)
    let pasteSent = false
    this.log('clipboard-temporary-written', operationId, {
      previousFormatCount: previous.formats.length
    })

    try {
      await this.wait(this.settleDelayMs, signal)
      const beforePaste = await this.clipboard.readSnapshot()
      if (fingerprint(beforePaste) !== temporaryFingerprint) {
        this.log('clipboard-external-change-before-paste', operationId)
        return {
          outcome: 'blocked-external-change',
          previousFormatCount: previous.formats.length,
          restored: false
        }
      }

      await paste()
      pasteSent = true
      await this.wait(this.restoreDelayMs, signal)
      const afterPaste = await this.clipboard.readSnapshot()
      if (fingerprint(afterPaste) !== temporaryFingerprint) {
        this.log('clipboard-external-change-after-paste', operationId)
        return {
          outcome: 'pasted-external-change',
          previousFormatCount: previous.formats.length,
          restored: false
        }
      }

      await this.restore(previous)
      this.log('clipboard-restored', operationId, {
        restoredFormatCount: previous.formats.length
      })
      return {
        outcome: 'pasted-restored',
        previousFormatCount: previous.formats.length,
        restored: true
      }
    } catch (error) {
      if (pasteSent && signal?.aborted) {
        await this.wait(this.restoreDelayMs).catch(() => undefined)
      }
      const current = await this.clipboard.readSnapshot().catch(() => null)
      if (current && fingerprint(current) === temporaryFingerprint) {
        await this.restore(previous).catch(() => undefined)
      }
      throw error
    }
  }

  private async restore(snapshot: ClipboardSnapshot): Promise<void> {
    if (snapshot.formats.length === 0) await this.clipboard.clear()
    else await this.clipboard.writeSnapshot(snapshot)
  }

  private log(
    stage: string,
    operationId: string,
    fields: Record<string, string | number | boolean> = {}
  ): void {
    this.options.logger?.info(stage, { operationId, ...fields })
  }
}

export function fingerprint(snapshot: ClipboardSnapshot): string {
  const hash = createHash('sha256')
  const ordered = [...snapshot.formats].sort((left, right) =>
    left.format.localeCompare(right.format)
  )
  for (const entry of ordered) {
    hash.update(entry.format)
    hash.update(String(entry.data.byteLength))
    hash.update(entry.data)
  }
  return hash.digest('hex')
}

async function abortableWait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('Insertion operation was cancelled'))
      },
      { once: true }
    )
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Insertion operation was cancelled')
}
