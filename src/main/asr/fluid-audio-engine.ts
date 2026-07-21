import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import type { AsrEngine, TranscriptionResult } from './types'
import type { AsrStatus } from '../../shared/contracts'
import { initialAsrStatus } from '../../shared/asr'

const protocolPrefix = 'CVJSON:'

interface HelperMessage {
  id?: string
  event?: 'ready'
  text?: string
  error?: string
}

interface PendingRequest {
  resolve: (result: TranscriptionResult) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export class FluidAudioEngine implements AsrEngine {
  readonly id = 'Parakeet V3 · Core ML'

  private currentStatus: AsrStatus = fluidAsrStatus('downloaded')
  private statusListener: ((status: AsrStatus) => void) | null = null

  private helper: ChildProcessWithoutNullStreams | null = null
  private readyPromise: Promise<void> | null = null
  private resolveReady: (() => void) | null = null
  private rejectReady: ((error: Error) => void) | null = null
  private readonly pending = new Map<string, PendingRequest>()

  constructor(private readonly helperPath = resolveHelperPath()) {}

  get helperExecutablePath(): string {
    return this.helperPath
  }

  get status(): AsrStatus {
    return { ...this.currentStatus }
  }

  onStatusChanged(listener: (status: AsrStatus) => void): void {
    this.statusListener = listener
  }

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'darwin' || process.arch !== 'arm64') return false

    try {
      await access(this.helperPath)
      return true
    } catch {
      return false
    }
  }

  async prepare(): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new Error('Parakeet helper is not available on this computer')
    }
    this.setStatus(fluidAsrStatus('loading'))
    try {
      await this.ensureReady()
      this.setStatus(fluidAsrStatus('ready'))
    } catch (error) {
      this.setStatus({
        ...fluidAsrStatus('error'),
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async transcribe(wavPath: string): Promise<TranscriptionResult> {
    if (!(await this.isAvailable())) {
      throw new Error('Parakeet helper is not available on this computer')
    }

    await this.prepare()
    const helper = this.helper
    if (!helper?.stdin.writable) throw new Error('Parakeet helper is not running')

    const id = randomUUID()
    const result = new Promise<TranscriptionResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('Parakeet transcription timed out'))
      }, 120_000)
      this.pending.set(id, { resolve, reject, timeout })
    })

    helper.stdin.write(`${JSON.stringify({ id, type: 'transcribe', audioPath: wavPath })}\n`)
    return result
  }

  dispose(): void {
    this.failAll(new Error('Parakeet helper stopped'))
    this.helper?.kill()
    this.helper = null
    this.readyPromise = null
  }

  private setStatus(status: AsrStatus): void {
    this.currentStatus = status
    this.statusListener?.(this.status)
  }

  private ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })

    const helper = spawn(this.helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.helper = helper

    createInterface({ input: helper.stdout }).on('line', (line) => {
      if (!line.startsWith(protocolPrefix)) return

      try {
        this.handleMessage(JSON.parse(line.slice(protocolPrefix.length)) as HelperMessage)
      } catch (error) {
        console.warn('Ignored malformed Parakeet helper message', error)
      }
    })

    createInterface({ input: helper.stderr }).on('line', (line) => {
      console.info(`[Parakeet] ${line}`)
    })

    helper.once('error', (error) => this.handleExit(error))
    helper.once('exit', (code, signal) => {
      this.handleExit(
        new Error(`Parakeet helper exited (${signal ?? `code ${String(code)}`})`)
      )
    })

    return this.readyPromise
  }

  private handleMessage(message: HelperMessage): void {
    if (message.event === 'ready') {
      this.resolveReady?.()
      this.resolveReady = null
      this.rejectReady = null
      return
    }

    if (!message.id) {
      if (message.error) this.handleExit(new Error(message.error))
      return
    }

    const request = this.pending.get(message.id)
    if (!request) return
    clearTimeout(request.timeout)
    this.pending.delete(message.id)

    if (message.error) request.reject(new Error(message.error))
    else request.resolve({ text: message.text ?? '' })
  }

  private handleExit(error: Error): void {
    this.rejectReady?.(error)
    this.resolveReady = null
    this.rejectReady = null
    this.failAll(error)
    this.helper = null
    this.readyPromise = null
  }

  private failAll(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout)
      request.reject(error)
    }
    this.pending.clear()
  }
}

function resolveHelperPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'cure-voicer-asr')
  }
  return path.join(
    app.getAppPath(),
    'native',
    'macos-asr',
    '.build',
    'release',
    'cure-voicer-asr'
  )
}

function fluidAsrStatus(state: AsrStatus['state']): AsrStatus {
  return initialAsrStatus(state, 'Parakeet V3 · Core ML', 'Parakeet TDT 0.6B V3', 0)
}
