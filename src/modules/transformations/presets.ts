import type { TextTransformation } from '../../shared/types/transformation'
import {
  noTransformation,
  removeFillersTransformation,
  removeRepetitionsTransformation,
  structuredListTransformation
} from './built-in-transformations'
import {
  InstructionTextTransformation,
  type InstructionTransformationPort
} from './instruction-transformation'

const instructionPresets = [
  ['punctuation', 'Пунктуация', 'Fix punctuation only. Preserve every word and identifier.'],
  ['spelling', 'Орфография', 'Fix spelling and punctuation without changing meaning.'],
  ['written-style', 'Письменный текст', 'Turn spoken language into concise polished written text.'],
  ['shorten', 'Сократить', 'Make the text shorter while preserving all essential facts.'],
  ['expand', 'Расширить', 'Expand the text with clear useful detail without inventing facts.'],
  ['friendly', 'Дружелюбный стиль', 'Rewrite in a warm friendly tone.'],
  ['business', 'Деловой стиль', 'Rewrite in a concise business style.'],
  ['formal', 'Формальный стиль', 'Rewrite in a formal professional tone.'],
  ['email', 'Email', 'Format as a complete email with greeting, body and closing.'],
  ['message', 'Сообщение', 'Format as a concise natural messenger message.'],
  ['technical-specification', 'Техническое задание', 'Format as a structured technical specification.'],
  ['translate', 'Перевод', 'Translate to the target language from context. Preserve identifiers.'],
  ['custom', 'Своя инструкция', '']
] as const

export function createBuiltInTransformations(
  transformer: InstructionTransformationPort
): TextTransformation[] {
  return [
    noTransformation,
    removeFillersTransformation,
    removeRepetitionsTransformation,
    structuredListTransformation,
    ...instructionPresets.map(
      ([id, name, instruction]) =>
        new InstructionTextTransformation(id, name, instruction, transformer)
    )
  ]
}
