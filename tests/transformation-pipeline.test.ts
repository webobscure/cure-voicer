import { describe, expect, it, vi } from 'vitest'
import {
  removeFillersTransformation,
  removeRepetitionsTransformation,
  structuredListTransformation
} from '../src/modules/transformations/built-in-transformations'
import { createBuiltInTransformations } from '../src/modules/transformations/presets'
import {
  TransformationPipeline,
  TransformationRegistry
} from '../src/modules/transformations/transformation-registry'
import { TransformationCancelledError } from '../src/modules/transformations/errors'
import type { TransformationContext } from '../src/shared/types/transformation'

const baseContext: TransformationContext = {
  operationId: 'operation-1',
  presetId: 'none',
  preferredTerms: [],
  allowExternalService: false
}

describe('text transformation pipeline', () => {
  it('removes filler words and adjacent repeated words deterministically', async () => {
    const registry = new TransformationRegistry([
      removeFillersTransformation,
      removeRepetitionsTransformation
    ])
    const pipeline = new TransformationPipeline(registry)

    await expect(
      pipeline.run('Ну, создай создай AbortController, эм, пожалуйста.', [
        'remove-fillers',
        'remove-repetitions'
      ], baseContext)
    ).resolves.toMatchObject({
      text: 'создай AbortController, пожалуйста.',
      results: [{ transformationId: 'remove-fillers' }, { transformationId: 'remove-repetitions' }]
    })
  })

  it('creates a list without inventing items', async () => {
    const result = await structuredListTransformation.transform(
      'Первый пункт. Второй пункт! Третий пункт?',
      { ...baseContext, presetId: 'structured-list' }
    )
    expect(result.transformedText).toBe('- Первый пункт\n- Второй пункт\n- Третий пункт')
  })

  it('routes instruction presets through the local transformation port', async () => {
    const transformText = vi.fn(async (text: string) => text.toUpperCase())
    const registry = new TransformationRegistry(
      createBuiltInTransformations({ transformText })
    )

    await expect(
      registry.transform('hello', { ...baseContext, presetId: 'formal' })
    ).resolves.toMatchObject({ transformedText: 'HELLO', changed: true })
    expect(transformText).toHaveBeenCalledWith(
      'hello',
      'Rewrite in a formal professional tone.',
      expect.objectContaining({ presetId: 'formal', allowExternalService: false })
    )
  })

  it('requires a custom instruction and honours cancellation', async () => {
    const registry = new TransformationRegistry(
      createBuiltInTransformations({ transformText: vi.fn(async (text) => text) })
    )
    await expect(
      registry.transform('hello', { ...baseContext, presetId: 'custom' })
    ).rejects.toThrow('custom transformation instruction')

    const controller = new AbortController()
    controller.abort()
    await expect(
      registry.transform('hello', {
        ...baseContext,
        presetId: 'none',
        signal: controller.signal
      })
    ).rejects.toBeInstanceOf(TransformationCancelledError)
  })
})
