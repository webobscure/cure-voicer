import { utilityProcess, type UtilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import path from 'node:path'
import type { SmartCorrectionStatus } from '../shared/contracts'
import {
  initialSmartCorrectionStatus,
  SMART_CORRECTION_MODEL_FILE,
  SMART_CORRECTION_TIMEOUT_MS,
  type SmartCorrectionContext,
  type SmartCorrectionWorkerMessage,
  type SmartCorrectionWorkerRequest,
  type TranscriptCorrector,
  type InstructionTextTransformer
} from '../shared/smart-correction'
import type { TransformationContext } from '../shared/types/transformation'

interface PendingRequest {
  resolve: (value: string) => void
  reject: (error: Error) => void
  timeout?: ReturnType<typeof setTimeout>
}

export class SmartCorrectionService implements TranscriptCorrector, InstructionTextTransformer {
  private worker: UtilityProcess | null = null
  private currentStatus = initialSmartCorrectionStatus()
  private readonly pending = new Map<string, PendingRequest>()
  private preparePromise: Promise<SmartCorrectionStatus> | null = null
  private statusListener: ((status: SmartCorrectionStatus) => void) | null = null

  constructor(
    private readonly workerPath: string,
    private readonly modelsDirectory: string
  ) {}

  get status(): SmartCorrectionStatus {
    return { ...this.currentStatus }
  }

  onStatusChanged(listener: (status: SmartCorrectionStatus) => void): void {
    this.statusListener = listener
  }

  async refreshStatus(): Promise<SmartCorrectionStatus> {
    if (this.currentStatus.state === 'ready') return this.status
    try {
      await access(path.join(this.modelsDirectory, SMART_CORRECTION_MODEL_FILE))
      this.setStatus(initialSmartCorrectionStatus('downloaded'))
    } catch {
      this.setStatus(initialSmartCorrectionStatus())
    }
    return this.status
  }

  async prepare(): Promise<SmartCorrectionStatus> {
    if (this.currentStatus.state === 'ready') return this.status
    if (this.preparePromise) return this.preparePromise

    this.preparePromise = this.request(
      { id: randomUUID(), type: 'prepare', modelsDirectory: this.modelsDirectory }
    )
      .then(() => this.status)
      .finally(() => {
        this.preparePromise = null
      })
    return this.preparePromise
  }

  async correct(text: string, context: SmartCorrectionContext = {}): Promise<string> {
    if (this.currentStatus.state !== 'ready' || !text.trim() || text.length > 8_000) {
      return text
    }

    const id = randomUUID()
    return this.request(
      {
        id,
        type: 'correct',
        text,
        previousText: context.previousText,
        preferredTerms: context.preferredTerms
      },
      SMART_CORRECTION_TIMEOUT_MS
    )
  }

  async transformText(
    text: string,
    instruction: string,
    context: TransformationContext
  ): Promise<string> {
    if (this.currentStatus.state !== 'ready') {
      throw new Error('Local transformation model is not ready')
    }
    if (context.signal?.aborted) throw new Error('Text transformation was cancelled')
    const id = randomUUID()
    return this.request(
      {
        id,
        type: 'transform',
        text,
        instruction,
        targetLanguage: context.targetLanguage
      },
      SMART_CORRECTION_TIMEOUT_MS * 4
    )
  }

  dispose(): void {
    this.failAll(new Error('Smart correction worker stopped'))
    this.worker?.kill()
    this.worker = null
    this.preparePromise = null
  }

  private request(
    message: Exclude<SmartCorrectionWorkerRequest, { type: 'cancel' }>,
    timeoutMs?: number
  ): Promise<string> {
    const worker = this.ensureWorker()
    return new Promise<string>((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject }
      if (timeoutMs) {
        pending.timeout = setTimeout(() => {
          this.pending.delete(message.id)
          worker.postMessage({ id: message.id, type: 'cancel' } satisfies SmartCorrectionWorkerRequest)
          reject(new Error('Smart correction timed out'))
        }, timeoutMs)
      }
      this.pending.set(message.id, pending)
      worker.postMessage(message)
    })
  }

  private ensureWorker(): UtilityProcess {
    if (this.worker?.pid) return this.worker

    const worker = utilityProcess.fork(this.workerPath, [], {
      serviceName: 'Cure Voicer Smart Correction',
      stdio: 'pipe'
    })
    this.worker = worker
    worker.on('message', (message: SmartCorrectionWorkerMessage) => {
      this.handleMessage(message)
    })
    worker.on('exit', (code) => {
      if (this.worker !== worker) return
      this.worker = null
      this.preparePromise = null
      this.failAll(new Error(`Smart correction worker exited with code ${code}`))
      if (this.currentStatus.state !== 'not-downloaded') {
        this.setStatus({
          ...initialSmartCorrectionStatus('error'),
          error: 'Локальная модель неожиданно завершила работу'
        })
      }
    })
    worker.stdout?.on('data', (chunk) => console.info(`[Qwen] ${String(chunk).trim()}`))
    worker.stderr?.on('data', (chunk) => console.warn(`[Qwen] ${String(chunk).trim()}`))
    return worker
  }

  private handleMessage(message: SmartCorrectionWorkerMessage): void {
    if (message.type === 'status') {
      this.setStatus(message.status)
      return
    }

    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (pending.timeout) clearTimeout(pending.timeout)
    if (message.error) pending.reject(new Error(message.error))
    else pending.resolve(message.result ?? '')
  }

  private setStatus(status: SmartCorrectionStatus): void {
    this.currentStatus = {
      ...status,
      progress: Math.max(0, Math.min(1, status.progress))
    }
    this.statusListener?.(this.status)
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      if (pending.timeout) clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pending.clear()
  }
}
