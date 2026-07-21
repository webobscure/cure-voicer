export function applyPreferredTerms(text: string, terms: string[]): string {
  let result = text
  for (const term of terms) {
    const normalized = term.trim()
    if (!normalized) continue
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(
      new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu'),
      normalized
    )
  }
  return result
}
