import { utilityProcess, type UtilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { AsrStatus } from '../../shared/contracts'
import {
  initialAsrStatus,
  WINDOWS_PARAKEET_MANIFEST_FILE,
  WINDOWS_PARAKEET_MODEL_FILES,
  WINDOWS_PARAKEET_MODEL_REVISION,
  type WindowsAsrWorkerMessage,
  type WindowsAsrWorkerRequest
} from '../../shared/asr'
import type { AsrEngine, TranscriptionResult } from './types'

interface PendingRequest {
  resolve: (text: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export class SherpaOnnxEngine implements AsrEngine {
  readonly id = 'Parakeet V3 · ONNX Runtime'

  private worker: UtilityProcess | null = null
  private currentStatus = initialAsrStatus()
  private statusListener: ((status: AsrStatus) => void) | null = null
  private preparePromise: Promise<void> | null = null
  private readonly pending = new Map<string, PendingRequest>()

  constructor(
    private readonly workerPath: string,
    private readonly modelsDirectory: string
  ) {}

  get status(): AsrStatus {
    return { ...this.currentStatus, engine: this.id }
  }

  onStatusChanged(listener: (status: AsrStatus) => void): void {
    this.statusListener = listener
  }

  async isAvailable(): Promise<boolean> {
    return process.platform === 'win32' && process.arch === 'x64'
  }

  async refreshStatus(): Promise<AsrStatus> {
    if (this.currentStatus.state === 'ready') return this.status
    this.setStatus(
      (await hasVerifiedModel(this.modelsDirectory))
        ? initialAsrStatus('downloaded', this.id)
        : initialAsrStatus('not-downloaded', this.id)
    )
    return this.status
  }

  async prepare(): Promise<void> {
    if (this.currentStatus.state === 'ready') return
    if (this.preparePromise) return this.preparePromise

    this.preparePromise = this.request(
      {
        id: randomUUID(),
        type: 'prepare',
        modelsDirectory: this.modelsDirectory
      },
      30 * 60_000
    )
      .then(() => undefined)
      .finally(() => {
        this.preparePromise = null
      })
    return this.preparePromise
  }

  async transcribe(wavPath: string): Promise<TranscriptionResult> {
    await this.prepare()
    const text = await this.request(
      { id: randomUUID(), type: 'transcribe', wavPath },
      120_000
    )
    return { text }
  }

  dispose(): void {
    this.failAll(new Error('Windows Parakeet worker stopped'))
    const worker = this.worker
    this.worker = null
    worker?.kill()
    this.preparePromise = null
  }

  private request(message: WindowsAsrWorkerRequest, timeoutMs: number): Promise<string> {
    const worker = this.ensureWorker()
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(message.id)
        reject(new Error(`${message.type === 'prepare' ? 'Подготовка модели' : 'Распознавание'} превысило лимит времени`))
      }, timeoutMs)
      this.pending.set(message.id, { resolve, reject, timeout })
      worker.postMessage(message)
    })
  }

  private ensureWorker(): UtilityProcess {
    if (this.worker?.pid) return this.worker

    const worker = utilityProcess.fork(this.workerPath, [], {
      serviceName: 'Cure Voicer Windows ASR',
      stdio: 'pipe'
    })
    this.worker = worker
    worker.on('message', (message: WindowsAsrWorkerMessage) => this.handleMessage(message))
    worker.on('exit', (code) => {
      if (this.worker !== worker) return
      this.worker = null
      this.preparePromise = null
      this.failAll(new Error(`Windows Parakeet worker exited with code ${code}`))
      this.setStatus({
        ...initialAsrStatus('error', this.id),
        error: 'Локальный движок распознавания неожиданно завершил работу'
      })
    })
    worker.stdout?.on('data', (chunk) => console.info(`[Windows ASR] ${String(chunk).trim()}`))
    worker.stderr?.on('data', (chunk) => console.warn(`[Windows ASR] ${String(chunk).trim()}`))
    return worker
  }

  private handleMessage(message: WindowsAsrWorkerMessage): void {
    if (message.type === 'status') {
      this.setStatus(message.status)
      return
    }

    const request = this.pending.get(message.id)
    if (!request) return
    this.pending.delete(message.id)
    clearTimeout(request.timeout)
    if (message.error) request.reject(new Error(message.error))
    else request.resolve(message.text ?? '')
  }

  private setStatus(status: AsrStatus): void {
    this.currentStatus = {
      ...status,
      engine: this.id,
      progress: Math.max(0, Math.min(1, status.progress))
    }
    this.statusListener?.(this.status)
  }

  private failAll(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout)
      request.reject(error)
    }
    this.pending.clear()
  }
}

async function hasVerifiedModel(modelsDirectory: string): Promise<boolean> {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(modelsDirectory, WINDOWS_PARAKEET_MANIFEST_FILE), 'utf8')
    ) as { revision?: string }
    if (manifest.revision !== WINDOWS_PARAKEET_MODEL_REVISION) return false

    const sizes = await Promise.all(
      WINDOWS_PARAKEET_MODEL_FILES.map(async (file) =>
        (await stat(path.join(modelsDirectory, file.name))).size
      )
    )
    return sizes.every((size, index) => size === WINDOWS_PARAKEET_MODEL_FILES[index]?.size)
  } catch {
    return false
  }
}
