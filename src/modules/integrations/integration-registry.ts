import type { ActiveApplicationContext } from '../../shared/types/insertion'
import type {
  AppIntegration,
  AppIntegrationRule,
  InsertionStrategy,
  IntegrationResolution
} from '../../shared/types/integrations'

const defaultStrategy: InsertionStrategy = {
  preferredMode: 'keyboard',
  fallbackModes: ['accessibility', 'clipboard-safe', 'internal-editor']
}

export class IntegrationRegistry {
  constructor(private readonly integrations: readonly AppIntegration[]) {}

  async resolve(
    context: ActiveApplicationContext,
    rules: readonly AppIntegrationRule[] = []
  ): Promise<IntegrationResolution> {
    const integration = await this.findIntegration(context)
    const integrationId = integration?.id ?? 'generic'
    const matchingRule = rules.find(
      (rule) => rule.enabled && (rule.match === integrationId || contextValues(context).some((value) => includes(value, rule.match)))
    )
    const baseStrategy = integration
      ? await integration.getInsertionStrategy(context)
      : defaultStrategy
    const preset = integration?.getTransformationPreset
      ? await integration.getTransformationPreset(context)
      : null

    return {
      integrationId,
      strategy: matchingRule?.blocked
        ? {
            preferredMode: 'internal-editor',
            fallbackModes: [],
            blockReason: `Blocked by integration rule ${matchingRule.id}`
          }
        : {
            ...baseStrategy,
            preferredMode: matchingRule?.insertionMode ?? baseStrategy.preferredMode
          },
      transformationPresetId:
        matchingRule?.transformationPresetId === 'none'
          ? null
          : matchingRule?.transformationPresetId ?? preset,
      shortcut: matchingRule?.shortcut,
      matchedRuleId: matchingRule?.id
    }
  }

  private async findIntegration(context: ActiveApplicationContext): Promise<AppIntegration | null> {
    for (const integration of this.integrations) {
      if (await integration.supports(context)) return integration
    }
    return null
  }
}

function contextValues(context: ActiveApplicationContext): string[] {
  return [context.applicationId, context.applicationName, context.executablePath, context.windowTitle]
    .filter((value): value is string => Boolean(value))
}

function includes(value: string, pattern: string): boolean {
  return value.toLocaleLowerCase().includes(pattern.toLocaleLowerCase())
}
