import { performance } from 'node:perf_hooks'
import type {
  TextTransformation,
  TransformationContext,
  TransformationResult
} from '../../shared/types/transformation'

export interface InstructionTransformationPort {
  transformText(
    text: string,
    instruction: string,
    context: TransformationContext
  ): Promise<string>
}

export class InstructionTextTransformation implements TextTransformation {
  constructor(
    readonly id: string,
    readonly name: string,
    private readonly instruction: string,
    private readonly transformer: InstructionTransformationPort
  ) {}

  async transform(
    text: string,
    context: TransformationContext
  ): Promise<TransformationResult> {
    const startedAt = performance.now()
    const instruction =
      this.id === 'custom' ? context.customInstruction?.trim() : this.instruction
    if (!instruction) throw new Error('A custom transformation instruction is required')
    const transformedText = await this.transformer.transformText(text, instruction, context)
    return {
      transformationId: this.id,
      originalText: text,
      transformedText,
      changed: transformedText !== text,
      durationMs: Math.round(performance.now() - startedAt)
    }
  }
}
