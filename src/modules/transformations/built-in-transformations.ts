import { performance } from 'node:perf_hooks'
import type {
  TextTransformation,
  TransformationContext,
  TransformationResult
} from '../../shared/types/transformation'

export type TextTransformFunction = (
  text: string,
  context: TransformationContext
) => string | Promise<string>

export class FunctionalTextTransformation implements TextTransformation {
  constructor(
    readonly id: string,
    readonly name: string,
    private readonly apply: TextTransformFunction
  ) {}

  async transform(
    text: string,
    context: TransformationContext
  ): Promise<TransformationResult> {
    const startedAt = performance.now()
    const transformedText = await this.apply(text, context)
    return {
      transformationId: this.id,
      originalText: text,
      transformedText,
      changed: transformedText !== text,
      durationMs: Math.round(performance.now() - startedAt)
    }
  }
}

const russianFillers = /(?<![\p{L}\p{N}_])(?:ээ+|эм+|ну|как бы|короче|в общем|типа|значит)(?![\p{L}\p{N}_])[,.]?\s*/giu
const englishFillers = /\b(?:uh+|um+|you know|like|basically)\b[,.]?\s*/giu

export const noTransformation = new FunctionalTextTransformation(
  'none',
  'Без обработки',
  (text) => text
)

export const removeFillersTransformation = new FunctionalTextTransformation(
  'remove-fillers',
  'Удалить слова-паразиты',
  (text) => normalizeWhitespace(text.replace(russianFillers, '').replace(englishFillers, ''))
)

export const removeRepetitionsTransformation = new FunctionalTextTransformation(
  'remove-repetitions',
  'Удалить повторы',
  (text) =>
    normalizeWhitespace(
      text.replace(
        /(?<![\p{L}\p{N}_-])([\p{L}\p{N}_-]+)(?:[\s,]+\1)+(?![\p{L}\p{N}_-])/giu,
        '$1'
      )
    )
)

export const structuredListTransformation = new FunctionalTextTransformation(
  'structured-list',
  'Структурированный список',
  (text) => {
    const items = text
      .split(/(?:\n+|;\s+|(?<=[.!?])\s+)/u)
      .map((item) => item.trim().replace(/[.!?]+$/u, ''))
      .filter(Boolean)
    return items.length <= 1 ? text : items.map((item) => `- ${item}`).join('\n')
  }
)

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\s+([,.!?;:])/gu, '$1')
    .trim()
}
