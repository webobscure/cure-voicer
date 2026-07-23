import type { CureVoicerApi, CureVoicerOverlayApi } from '../shared/contracts'

declare global {
  interface Window {
    cureVoicer: CureVoicerApi
    cureVoicerOverlay: CureVoicerOverlayApi
  }
}

export {}
