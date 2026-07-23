import { describe, expect, it, vi } from 'vitest'
import { OnboardingController } from '../src/renderer/features/onboarding/onboarding-controller'

describe('OnboardingController', () => {
  it('owns visibility and clamps navigation to the four product steps', () => {
    const controller = new OnboardingController()
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.show(true)
    controller.setStep(20)
    expect(controller.getSnapshot()).toMatchObject({ visible: true, firstRun: true, step: 3 })
    controller.setStep(-5)
    expect(controller.getSnapshot().step).toBe(0)
    controller.hide()
    expect(controller.getSnapshot().visible).toBe(false)
    expect(listener).toHaveBeenCalled()
  })

  it('delegates privileged actions through configured callbacks', async () => {
    const controller = new OnboardingController()
    const requestMicrophone = vi.fn(async () => undefined)
    const requestAccessibility = vi.fn(async () => undefined)
    const toggleRecording = vi.fn(async () => undefined)
    const finish = vi.fn(async () => undefined)
    controller.configure({ requestMicrophone, requestAccessibility, toggleRecording, finish })
    await controller.requestMicrophone()
    await controller.requestAccessibility()
    await controller.toggleRecording()
    await controller.finish()
    expect(requestMicrophone).toHaveBeenCalledOnce()
    expect(requestAccessibility).toHaveBeenCalledOnce()
    expect(toggleRecording).toHaveBeenCalledOnce()
    expect(finish).toHaveBeenCalledOnce()
  })
})
