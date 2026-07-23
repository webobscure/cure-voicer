import type { ActiveApplicationContext } from '../shared/types/insertion'

export function canUseKeyboardInsertion(
  platform: NodeJS.Platform,
  context: ActiveApplicationContext,
  macRequirementsMet: boolean
): boolean {
  if (context.isElevated) return false
  if (platform === 'darwin') return macRequirementsMet
  return platform === 'win32'
}

export function canUseAccessibilityInsertion(
  platform: NodeJS.Platform,
  context: ActiveApplicationContext,
  macRequirementsMet: boolean
): boolean {
  return (
    platform === 'darwin' &&
    !context.isSecureField &&
    !context.isElevated &&
    macRequirementsMet
  )
}

export function canUsePasteShortcut(
  platform: NodeJS.Platform,
  context: ActiveApplicationContext,
  macAccessibilityGranted: boolean
): boolean {
  if (context.isElevated) return false
  if (platform === 'darwin') return macAccessibilityGranted
  return platform === 'win32'
}
