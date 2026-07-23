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

