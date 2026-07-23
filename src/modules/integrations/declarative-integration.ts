import type { ActiveApplicationContext } from '../../shared/types/insertion'
import type { AppIntegration, InsertionStrategy } from '../../shared/types/integrations'

export interface DeclarativeIntegrationOptions {
  id: string
  identifiers?: readonly string[]
  names?: readonly string[]
  executables?: readonly string[]
  windowTitles?: readonly string[]
  strategy: InsertionStrategy
  transformationPresetId: string | null
}

export class DeclarativeIntegration implements AppIntegration {
  readonly id: string

  constructor(private readonly options: DeclarativeIntegrationOptions) {
    this.id = options.id
  }

  async supports(context: ActiveApplicationContext): Promise<boolean> {
    return (
      matches(context.applicationId, this.options.identifiers) ||
      matches(context.applicationName, this.options.names) ||
      matches(context.executablePath, this.options.executables) ||
      matches(context.windowTitle, this.options.windowTitles)
    )
  }

  async getInsertionStrategy(): Promise<InsertionStrategy> {
    return this.options.strategy
  }

  async getTransformationPreset(): Promise<string | null> {
    return this.options.transformationPresetId
  }
}

function matches(value: string | undefined, patterns: readonly string[] | undefined): boolean {
  if (!value || !patterns?.length) return false
  const normalized = value.toLocaleLowerCase()
  return patterns.some((pattern) => normalized.includes(pattern.toLocaleLowerCase()))
}
