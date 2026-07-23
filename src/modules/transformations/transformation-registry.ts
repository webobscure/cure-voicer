import type {
  TextTransformation,
  TransformationContext,
  TransformationResult
} from '../../shared/types/transformation'
import {
  TransformationCancelledError,
  TransformationUnavailableError
} from './errors'

export class TransformationRegistry {
  private readonly byId = new Map<string, TextTransformation>()

  constructor(transformations: readonly TextTransformation[]) {
    for (const transformation of transformations) {
      if (this.byId.has(transformation.id)) {
        throw new Error(`Duplicate text transformation: ${transformation.id}`)
      }
      this.byId.set(transformation.id, transformation)
    }
  }

  list(): readonly Pick<TextTransformation, 'id' | 'name'>[] {
    return [...this.byId.values()].map(({ id, name }) => ({ id, name }))
  }

  async transform(
    text: string,
    context: TransformationContext
  ): Promise<TransformationResult> {
    if (context.signal?.aborted) throw new TransformationCancelledError()
    const transformation = this.byId.get(context.presetId)
    if (!transformation) throw new TransformationUnavailableError(context.presetId)
    const result = await transformation.transform(text, context)
    if (context.signal?.aborted) throw new TransformationCancelledError()
    return result
  }
}

export class TransformationPipeline {
  constructor(private readonly registry: TransformationRegistry) {}

  async run(
    text: string,
    presetIds: readonly string[],
    context: Omit<TransformationContext, 'presetId'>
  ): Promise<{ text: string; results: readonly TransformationResult[] }> {
    let current = text
    const results: TransformationResult[] = []
    for (const presetId of presetIds) {
      const result = await this.registry.transform(current, { ...context, presetId })
      current = result.transformedText
      results.push(result)
    }
    return { text: current, results }
  }
}
