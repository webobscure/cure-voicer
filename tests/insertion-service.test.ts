import { describe, expect, it, vi } from 'vitest'
import { TextInsertionService } from '../src/modules/insertion/insertion-service'
import type { ActiveApplicationProvider } from '../src/modules/insertion/ports'
import type {
  ActiveApplicationContext,
  InsertionContext,
  InsertionMode,
  TextInsertionProvider
} from '../src/shared/types/insertion'

const target: ActiveApplicationContext = {
  platform: 'darwin',
  applicationId: 'com.example.Editor',
  processId: 42,
  capturedAt: '2026-07-23T10:00:00.000Z'
}

const context: InsertionContext = {
  operationId: 'operation-1',
  requestedMode: 'keyboard',
  activeApplication: target,
  allowFallback: true
}

function activeApplication(value = target): ActiveApplicationProvider {
  return { getActiveApplication: vi.fn(async () => value) }
}

function provider(
  mode: InsertionMode,
  outcome: 'inserted' | 'failed' | 'opened-editor',
  supported = true
): TextInsertionProvider {
  return {
    id: mode,
    mode,
    isSupported: vi.fn(async () => supported),
    insertText: vi.fn(async (_text, insertionContext) => ({
      operationId: insertionContext.operationId,
      providerId: mode,
      outcome,
      usedFallback: false,
      attempts: [{ providerId: mode, outcome, durationMs: 1 }]
    }))
  }
}

describe('TextInsertionService', () => {
  it('uses direct keyboard insertion without touching fallback providers', async () => {
    const keyboard = provider('keyboard', 'inserted')
    const clipboard = provider('clipboard-safe', 'inserted')
    const service = new TextInsertionService([keyboard, clipboard], {
      fallbackModes: ['clipboard-safe'],
      activeApplications: activeApplication()
    })

    await expect(service.insertText('Привет 👋', context)).resolves.toMatchObject({
      providerId: 'keyboard',
      outcome: 'inserted',
      usedFallback: false
    })
    expect(clipboard.insertText).not.toHaveBeenCalled()
  })

  it('uses the deterministic fallback order and keeps attempt history', async () => {
    const keyboard = provider('keyboard', 'failed')
    const accessibility = provider('accessibility', 'inserted')
    const service = new TextInsertionService([keyboard, accessibility], {
      fallbackModes: ['accessibility'],
      activeApplications: activeApplication()
    })

    const result = await service.insertText('text', context)
    expect(result).toMatchObject({
      providerId: 'accessibility',
      outcome: 'inserted',
      usedFallback: true
    })
    expect(result.attempts.map((attempt) => attempt.providerId)).toEqual([
      'keyboard',
      'accessibility'
    ])
  })

  it('skips unsupported providers', async () => {
    const keyboard = provider('keyboard', 'inserted', false)
    const editor = provider('internal-editor', 'opened-editor')
    const service = new TextInsertionService([keyboard, editor], {
      fallbackModes: ['internal-editor'],
      activeApplications: activeApplication()
    })

    await expect(service.insertText('text', context)).resolves.toMatchObject({
      providerId: 'internal-editor',
      outcome: 'opened-editor',
      usedFallback: true
    })
    expect(keyboard.insertText).not.toHaveBeenCalled()
  })

  it('blocks secure fields before probing a provider', async () => {
    const keyboard = provider('keyboard', 'inserted')
    const service = new TextInsertionService([keyboard], {
      fallbackModes: [],
      activeApplications: activeApplication()
    })

    await expect(
      service.insertText('secret', {
        ...context,
        activeApplication: { ...target, isSecureField: true }
      })
    ).resolves.toMatchObject({ outcome: 'blocked', providerId: 'security-policy' })
    expect(keyboard.isSupported).not.toHaveBeenCalled()
  })

  it('blocks insertion if the active application changed during recognition', async () => {
    const keyboard = provider('keyboard', 'inserted')
    const service = new TextInsertionService([keyboard], {
      fallbackModes: [],
      activeApplications: activeApplication({ ...target, processId: 99 })
    })

    await expect(service.insertText('text', context)).resolves.toMatchObject({
      outcome: 'blocked',
      providerId: 'focus-policy'
    })
    expect(keyboard.isSupported).not.toHaveBeenCalled()
  })

  it('opens the internal editor when focus changes and fallback is available', async () => {
    const keyboard = provider('keyboard', 'inserted')
    const editor = provider('internal-editor', 'opened-editor')
    const service = new TextInsertionService([keyboard, editor], {
      fallbackModes: ['internal-editor'],
      activeApplications: activeApplication({ ...target, processId: 99 })
    })

    const result = await service.insertText('text', context)
    expect(result).toMatchObject({
      outcome: 'opened-editor',
      providerId: 'internal-editor',
      usedFallback: true
    })
    expect(result.attempts.map((attempt) => attempt.providerId)).toEqual([
      'focus-policy',
      'internal-editor'
    ])
  })

  it('blocks applications from the user blacklist case-insensitively', async () => {
    const keyboard = provider('keyboard', 'inserted')
    const service = new TextInsertionService([keyboard], {
      fallbackModes: [],
      activeApplications: activeApplication()
    })

    await expect(
      service.insertText('text', {
        ...context,
        blockedApplicationIds: ['COM.EXAMPLE.EDITOR']
      })
    ).resolves.toMatchObject({
      outcome: 'blocked',
      providerId: 'application-policy'
    })
    expect(keyboard.isSupported).not.toHaveBeenCalled()
  })
})
