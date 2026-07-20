import type { CureVoicerApi } from '../shared/contracts'

declare global {
  interface Window {
    cureVoicer: CureVoicerApi
  }
}

export {}
