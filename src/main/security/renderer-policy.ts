import type { BrowserWindow, WebContents } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export interface RendererPolicyOptions {
  rendererDirectory: string
  allowedFiles: string[]
  developmentUrl?: string
}

export class RendererPolicy {
  private readonly allowedUrls: ReadonlySet<string>
  private readonly developmentOrigin?: string

  constructor(options: RendererPolicyOptions) {
    this.allowedUrls = new Set(
      options.allowedFiles.map((file) =>
        pathToFileURL(path.join(options.rendererDirectory, file)).toString()
      )
    )
    this.developmentOrigin = options.developmentUrl
      ? new URL(options.developmentUrl).origin
      : undefined
  }

  isTrustedUrl(value: string): boolean {
    try {
      const url = new URL(value)
      if (this.developmentOrigin && url.origin === this.developmentOrigin) return true
      return this.allowedUrls.has(url.toString())
    } catch {
      return false
    }
  }

  assertTrustedUrl(value: string): void {
    if (!this.isTrustedUrl(value)) {
      throw new Error('Rejected request from an untrusted renderer')
    }
  }
}

export function hardenWindow(window: BrowserWindow, policy: RendererPolicy): void {
  hardenWebContents(window.webContents, policy)
}

export function hardenWebContents(
  webContents: WebContents,
  policy: RendererPolicy
): void {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  webContents.on('will-navigate', (event, targetUrl) => {
    if (!policy.isTrustedUrl(targetUrl)) event.preventDefault()
  })
  webContents.on('will-attach-webview', (event) => event.preventDefault())
}

