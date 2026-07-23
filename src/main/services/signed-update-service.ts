import type { StructuredLogger } from '../../modules/diagnostics/structured-logger'

export interface UpdatePort {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowDowngrade: boolean
  on(event: 'error' | 'update-available' | 'update-downloaded', listener: (value: unknown) => void): void
  checkForUpdates(): Promise<unknown>
}

export class SignedUpdateService {
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly updater: UpdatePort,
    private readonly verifyCurrentPackage: () => Promise<boolean>,
    private readonly logger: StructuredLogger,
    private readonly intervalMs = 6 * 60 * 60 * 1_000
  ) {}

  async start(enabled: boolean): Promise<boolean> {
    if (!enabled || !(await this.verifyCurrentPackage())) {
      this.logger.info('updater-disabled', { signedPackage: false })
      return false
    }
    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = true
    this.updater.allowDowngrade = false
    this.updater.on('error', () => this.logger.warn('update-error'))
    this.updater.on('update-available', () => this.logger.info('update-available'))
    this.updater.on('update-downloaded', () => this.logger.info('update-downloaded'))
    await this.updater.checkForUpdates().catch(() => undefined)
    this.interval = setInterval(() => {
      void this.updater.checkForUpdates().catch(() => undefined)
    }, this.intervalMs)
    this.interval.unref()
    return true
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
  }
}
