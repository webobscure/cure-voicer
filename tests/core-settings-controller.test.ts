import { describe, expect, it, vi } from 'vitest'
import { CoreSettingsController, holdKeyGlyph } from '../src/renderer/app/core-settings-controller'

describe('CoreSettingsController', () => {
  it('publishes renderer service state without exposing IPC to React', () => {
    const controller = new CoreSettingsController()
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.update({ recordingState: 'recording', audioLevel: 0.72 })
    expect(controller.getSnapshot()).toMatchObject({ recordingState: 'recording', audioLevel: 0.72 })
    expect(listener).toHaveBeenCalledOnce()
    controller.update({ recordingState: 'recording', audioLevel: 0.72 })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('delegates only the configured settings actions', async () => {
    const controller = new CoreSettingsController()
    const updatePreferences = vi.fn(async () => true)
    controller.configure({
      toggleRecording: async () => undefined,
      updatePreferences,
      beginHoldKeyCapture: async () => undefined,
      cancelHoldKeyCapture: async () => undefined,
      setOverlayPlacement: async () => undefined,
      restartOnboarding: () => undefined
    })
    await expect(controller.updatePreferences({ autoPaste: false })).resolves.toBe(true)
    expect(updatePreferences).toHaveBeenCalledWith({ autoPaste: false })
  })

  it('formats platform-specific hold-key glyphs', () => {
    expect(holdKeyGlyph('right-option', 'darwin')).toBe('⌥')
    expect(holdKeyGlyph('right-option', 'win32')).toBe('Alt')
    expect(holdKeyGlyph('f8', 'win32')).toBe('F8')
  })
})
