export function isPotentiallySensitiveText(text: string): boolean {
  const value = text.trim()
  if (!value) return true
  if (/\b(?:password|passwd|пароль|secret|секрет)\s*[:=]/iu.test(value)) return true
  if (/\b(?:sk|pk|ghp|github_pat|xox[baprs])-?[A-Za-z0-9_-]{16,}\b/u.test(value)) return true
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(value)) return true
  const cardCandidates = value.match(/(?:\d[ -]?){13,19}/gu) ?? []
  return cardCandidates.some((candidate) => passesLuhn(candidate.replace(/\D/gu, '')))
}

function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let double = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}
