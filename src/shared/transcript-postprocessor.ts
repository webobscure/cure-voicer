import { applyPreferredTerms } from './vocabulary'

interface DeveloperTermRule {
  canonical: string
  aliases: string[]
}

const developerTerms: DeveloperTermRule[] = [
  {
    canonical: 'AbortController',
    aliases: [
      'abort controller',
      'abortcontroller',
      'аборт контроллер',
      'аборт контроллера',
      'аборт контроллеру',
      'аборт контроллером',
      'эборт контроллер',
      'аборт-контроллер'
    ]
  },
  {
    canonical: 'AbortSignal',
    aliases: ['abort signal', 'abortsignal', 'аборт сигнал', 'эборт сигнал']
  },
  {
    canonical: 'JavaScript',
    aliases: ['java script', 'javascript', 'джава скрипт', 'жава скрипт']
  },
  {
    canonical: 'TypeScript',
    aliases: ['type script', 'typescript', 'тайп скрипт']
  },
  {
    canonical: 'Node.js',
    aliases: ['node js', 'node.js', 'ноуд джей эс', 'нод джей эс', 'ноуд джээс']
  },
  {
    canonical: 'Next.js',
    aliases: ['next js', 'next.js', 'некст джей эс', 'некст джээс']
  },
  { canonical: 'React', aliases: ['react', 'реакт'] },
  { canonical: 'Electron', aliases: ['electron', 'электрон'] },
  { canonical: 'GitHub', aliases: ['git hub', 'github', 'гит хаб', 'гитхаб'] },
  { canonical: 'API', aliases: ['a p i', 'эй пи ай', 'апи'] },
  { canonical: 'JSON', aliases: ['json', 'джейсон', 'джей эс о эн'] },
  { canonical: 'HTML', aliases: ['h t m l', 'эйч ти эм эл', 'хтмл'] },
  { canonical: 'CSS', aliases: ['c s s', 'си эс эс', 'цсс'] },
  { canonical: 'HTTP', aliases: ['h t t p', 'эйч ти ти пи', 'хттп'] },
  { canonical: 'WebSocket', aliases: ['web socket', 'веб сокет', 'вебсокет'] },
  {
    canonical: 'localStorage',
    aliases: ['local storage', 'локал сторадж', 'локал сторож', 'локал стораж']
  },
  { canonical: 'sessionStorage', aliases: ['session storage', 'сешн сторадж'] },
  { canonical: 'querySelector', aliases: ['query selector', 'квери селектор'] },
  {
    canonical: 'addEventListener',
    aliases: ['add event listener', 'эдд ивент листенер', 'адд ивент листенер']
  },
  { canonical: 'useState', aliases: ['use state', 'юз стейт'] },
  { canonical: 'useEffect', aliases: ['use effect', 'юз эффект', 'юзэффект'] },
  { canonical: 'Promise', aliases: ['promise', 'промис'] },
  { canonical: 'async/await', aliases: ['async await', 'асинк эвейт'] },
  { canonical: 'fetch', aliases: ['fetch', 'фетч', 'фечт', 'фечь'] },
  {
    canonical: 'TanStack Query',
    aliases: [
      'tanstack query',
      'ten stack query',
      'тен стак query',
      'тен стек query',
      'танстек query',
      'тенстек query',
      'тенстек верри',
      'тен стек верри',
      'тенстек вери',
      'танстек квери',
      'тенстек квери'
    ]
  },
  {
    canonical: 'QueryClient',
    aliases: ['query client', 'query клиент', 'квери клиент', 'кьюри клиент']
  },
  {
    canonical: 'endpoint',
    aliases: [
      'endpoint',
      'эндпоинт',
      'эндпоинта',
      'эндпоинту',
      'эндпоинтом',
      'эндпоинты',
      'эндпоинтов',
      'эндпоинтами'
    ]
  },
  { canonical: 'props', aliases: ['props', 'пропсы'] }
]

const newlineCommand = /[ \t]*[,.;:!?]?[ \t]*(?:новая строка|new line)[ \t]*[,.;:!?]?[ \t]*/giu

export function postProcessTranscript(text: string, preferredTerms: string[] = []): string {
  let result = text.trim()

  // Parakeet can merge short English function words with a neighboring library name.
  // Restrict this rewrite to clearly English developer phrases to avoid translating Russian prose.
  result = result
    .split('\n')
    .map((line) => normalizePhoneticEnglishLine(line))
    .join('\n')

  // "Tan" may be dropped by ASR, but QueryClient later in the same phrase makes the intent clear.
  result = result.replace(
    /((?<![\p{L}\p{N}_])добав(?:ь|ьте)\s+)стек(?=\s+и\s+настрой(?:те)?\s+(?:query|квери)\s+клиент)/giu,
    '$1TanStack Query'
  )

  for (const rule of developerTerms) {
    for (const alias of [...rule.aliases].sort((left, right) => right.length - left.length)) {
      result = result.replace(phrasePattern(alias), rule.canonical)
    }
  }

  result = result
    .replace(/fetch[.,]?\s+[dд]\s+endpoint/giu, 'fetch для endpoint')
    .replace(
      /(TanStack Query\s+и\s+)на(?:стройку|стойку)\s+клиент(?:а)?(?:[.,]?\s*QueryClient)?/giu,
      '$1настрой QueryClient'
    )

  result = applyPreferredTerms(result, preferredTerms)
  result = result.replace(newlineCommand, '\n')
  return result.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
}

function normalizePhoneticEnglishLine(line: string): string {
  if (
    !/^юз(?![\p{L}\p{N}_])/iu.test(line) ||
    !/(?:виз\s*ракт|(?<![\p{L}\p{N}_])энд(?![\p{L}\p{N}_]))/iu.test(line)
  ) {
    return line
  }

  return line
    .replace(/^юз(?![\p{L}\p{N}_])/iu, 'Use')
    .replace(/(?<![\p{L}\p{N}_])виз\s*ракт(?![\p{L}\p{N}_])/giu, 'with React')
    .replace(/(?<![\p{L}\p{N}_])в(?=\s+React(?![\p{L}\p{N}_]))/giu, 'with')
    .replace(/(?<![\p{L}\p{N}_])энд(?![\p{L}\p{N}_])/giu, 'and')
}

function phrasePattern(phrase: string): RegExp {
  const escaped = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[\s-]+/g, '[\\s-]+')
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu')
}
