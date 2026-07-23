import { describe, expect, it, vi } from 'vitest'
import { SettingsShellController } from '../src/renderer/app/settings-shell-controller'

describe('SettingsShellController', () => {
  it('accepts known panes and ignores untrusted navigation values', () => {
    const controller = new SettingsShellController()
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.select('history')
    expect(controller.getSnapshot().activePane).toBe('history')
    controller.select('developer-console')
    expect(controller.getSnapshot().activePane).toBe('history')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('publishes the application version without changing navigation', () => {
    const controller = new SettingsShellController()
    controller.select('models')
    controller.setVersion('2.0.0')
    expect(controller.getSnapshot()).toEqual({ activePane: 'models', version: '2.0.0' })
  })
})
