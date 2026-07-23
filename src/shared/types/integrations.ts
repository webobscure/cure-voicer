import type {
  ActiveApplicationContext,
  InsertionMode
} from './insertion'

export interface InsertionStrategy {
  preferredMode: InsertionMode
  fallbackModes: InsertionMode[]
  blockReason?: string
}

export interface AppIntegration {
  readonly id: string
  supports(context: ActiveApplicationContext): Promise<boolean>
  getInsertionStrategy(
    context: ActiveApplicationContext
  ): Promise<InsertionStrategy>
  getTransformationPreset?(
    context: ActiveApplicationContext
  ): Promise<string | null>
}

export interface AppIntegrationRule {
  id: string
  match: string
  enabled: boolean
  blocked: boolean
  insertionMode?: InsertionMode
  transformationPresetId?: string
  shortcut?: string
}

export interface IntegrationResolution {
  integrationId: string
  strategy: InsertionStrategy
  transformationPresetId: string | null
  shortcut?: string
  matchedRuleId?: string
}
