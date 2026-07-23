import { describe, expect, it } from 'vitest'
import { createBuiltInIntegrations } from '../src/modules/integrations/built-in-integrations'
import { IntegrationRegistry } from '../src/modules/integrations/integration-registry'
import type { ActiveApplicationContext } from '../src/shared/types/insertion'

const registry = new IntegrationRegistry(createBuiltInIntegrations())

describe('IntegrationRegistry', () => {
  it('uses specific profiles before generic browser matching', async () => {
    await expect(registry.resolve(context({ windowTitle: 'Inbox (3) - Gmail', applicationName: 'Google Chrome' }))).resolves.toMatchObject({
      integrationId: 'gmail',
      transformationPresetId: 'email'
    })
  })

  it('disables prose transformation in IDE profiles', async () => {
    await expect(registry.resolve(context({ applicationId: 'com.microsoft.VSCode' }))).resolves.toMatchObject({
      integrationId: 'vscode',
      transformationPresetId: null
    })
  })

  it('applies a user rule before built-in policy and can block automatic insertion', async () => {
    await expect(registry.resolve(context({ applicationName: 'Telegram' }), [{
      id: 'private-chat',
      match: 'Telegram',
      enabled: true,
      blocked: true,
      transformationPresetId: 'formal'
    }])).resolves.toMatchObject({
      integrationId: 'telegram',
      matchedRuleId: 'private-chat',
      transformationPresetId: 'formal',
      strategy: { preferredMode: 'internal-editor', blockReason: expect.any(String) }
    })
  })
})

function context(patch: Partial<ActiveApplicationContext>): ActiveApplicationContext {
  return {
    platform: 'darwin',
    capturedAt: new Date(0).toISOString(),
    ...patch
  }
}
