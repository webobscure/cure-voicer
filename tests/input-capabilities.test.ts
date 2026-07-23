import { describe, expect, it } from 'vitest'
import {
  canUseAccessibilityInsertion,
  canUseKeyboardInsertion,
  canUsePasteShortcut
} from '../src/platform/input-capabilities'
import type { ActiveApplicationContext } from '../src/shared/types/insertion'

const target: ActiveApplicationContext = {
  platform: 'win32',
  processId: 42,
  capturedAt: '2026-07-23T10:00:00.000Z'
}

describe('platform input capabilities', () => {
  it('supports Windows Unicode input for a normal target', () => {
    expect(canUseKeyboardInsertion('win32', target, false)).toBe(true)
    expect(canUsePasteShortcut('win32', target, false)).toBe(true)
  })

  it('blocks a higher-integrity Windows target instead of requesting elevation', () => {
    const elevated = { ...target, isElevated: true }
    expect(canUseKeyboardInsertion('win32', elevated, false)).toBe(false)
    expect(canUsePasteShortcut('win32', elevated, false)).toBe(false)
  })

  it('requires macOS Accessibility and rejects secure accessibility fields', () => {
    const mac = { ...target, platform: 'darwin' as const, isElevated: false }
    expect(canUseKeyboardInsertion('darwin', mac, false)).toBe(false)
    expect(canUseKeyboardInsertion('darwin', mac, true)).toBe(true)
    expect(canUseAccessibilityInsertion('darwin', { ...mac, isSecureField: true }, true)).toBe(
      false
    )
  })
})
