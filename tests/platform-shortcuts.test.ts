import { describe, expect, it } from 'vitest'
import { MACOS_PASTE_SCRIPT } from '../src/shared/platform-shortcuts'

describe('platform paste shortcuts', () => {
  it('uses the physical V key on macOS instead of a layout-dependent character', () => {
    expect(MACOS_PASTE_SCRIPT).toContain('key code 9')
    expect(MACOS_PASTE_SCRIPT).not.toContain('keystroke "v"')
  })
})
