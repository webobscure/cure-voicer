import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RendererPolicy } from '../src/main/security/renderer-policy'

describe('RendererPolicy', () => {
  const rendererDirectory = path.join(path.sep, 'app', 'renderer')
  const policy = new RendererPolicy({
    rendererDirectory,
    allowedFiles: ['index.html', 'overlay.html'],
    developmentUrl: 'http://127.0.0.1:5173'
  })

  it('allows only declared production renderer files', () => {
    expect(
      policy.isTrustedUrl(pathToFileURL(path.join(rendererDirectory, 'index.html')).toString())
    ).toBe(true)
    expect(
      policy.isTrustedUrl(pathToFileURL(path.join(rendererDirectory, 'unknown.html')).toString())
    ).toBe(false)
  })

  it('allows the configured development origin and rejects lookalikes', () => {
    expect(policy.isTrustedUrl('http://127.0.0.1:5173/overlay.html')).toBe(true)
    expect(policy.isTrustedUrl('http://127.0.0.1:5174/overlay.html')).toBe(false)
    expect(policy.isTrustedUrl('https://example.com/?next=http://127.0.0.1:5173')).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(policy.isTrustedUrl('not a url')).toBe(false)
  })
})

