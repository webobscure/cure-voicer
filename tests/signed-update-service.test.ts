import { describe, expect, it, vi } from 'vitest'
import { StructuredLogger, type DiagnosticSink } from '../src/modules/diagnostics/structured-logger'
import { SignedUpdateService, type UpdatePort } from '../src/main/services/signed-update-service'

describe('SignedUpdateService', () => {
  it('never checks an update feed for an unsigned package', async () => {
    const updater = fakeUpdater()
    const service = new SignedUpdateService(updater, async () => false, logger())
    await expect(service.start(true)).resolves.toBe(false)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('enables downloads without downgrade only after signature verification', async () => {
    const updater = fakeUpdater()
    const service = new SignedUpdateService(updater, async () => true, logger(), 60_000)
    await expect(service.start(true)).resolves.toBe(true)
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.checkForUpdates).toHaveBeenCalledOnce()
    service.stop()
  })
})

function fakeUpdater(): UpdatePort & { checkForUpdates: ReturnType<typeof vi.fn> } {
  return {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowDowngrade: true,
    on: vi.fn(),
    checkForUpdates: vi.fn(async () => undefined)
  }
}

function logger(): StructuredLogger {
  const sink: DiagnosticSink = { write: vi.fn() }
  return new StructuredLogger('updates', sink)
}
