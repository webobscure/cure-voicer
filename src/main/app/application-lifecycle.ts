import { app } from 'electron'

export interface ApplicationLifecycle {
  start(): Promise<void>
  beforeQuit(): void
  willQuit(): void
  secondInstance(): void
  windowAllClosed(): void
  fatal(error: unknown): void
}

export function registerApplicationLifecycle(lifecycle: ApplicationLifecycle): void {
  void app.whenReady().then(lifecycle.start).catch(lifecycle.fatal)
  app.on('second-instance', lifecycle.secondInstance)
  app.on('before-quit', lifecycle.beforeQuit)
  app.on('will-quit', lifecycle.willQuit)
  app.on('window-all-closed', lifecycle.windowAllClosed)
}

