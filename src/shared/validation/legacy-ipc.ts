import { z } from 'zod'

export const recordingStateSchema = z.enum([
  'idle',
  'starting',
  'recording',
  'transcribing',
  'error'
])

export const overlayPlacementModeSchema = z.enum([
  'bottom-left',
  'bottom-center',
  'bottom-right'
])

export const permissionSettingsKindSchema = z.enum([
  'microphone',
  'accessibility'
])

export const holdKeySchema = z.enum([
  'left-control',
  'right-control',
  'left-option',
  'right-option',
  'left-command',
  'right-command',
  'left-shift',
  'right-shift',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12'
])

export const legacyPreferencesPatchSchema = z
  .object({
    launchAtLogin: z.boolean(),
    activationMode: z.enum(['toggle', 'hold']),
    accelerator: z.string().max(100),
    holdKey: holdKeySchema,
    microphoneId: z.string().max(512),
    autoPaste: z.boolean(),
    keepRecordings: z.boolean(),
    showOverlayWhenIdle: z.boolean(),
    overlayMotion: z.enum(['calm', 'balanced', 'expressive']),
    smartCorrectionEnabled: z.boolean(),
    onboardingCompleted: z.boolean()
  })
  .strict()
  .partial()

const maximumRecordingBytes = 16_000 * Float32Array.BYTES_PER_ELEMENT * 60 * 15

export const pcmRecordingPayloadSchema = z.object({
  samples: z
    .custom<Uint8Array>((value) => value instanceof Uint8Array)
    .refine((samples) => samples.byteLength > 0, 'Recording is empty')
    .refine(
      (samples) => samples.byteLength <= maximumRecordingBytes,
      'Recording exceeds the 15 minute limit'
    ),
  sampleRate: z.literal(16_000),
  durationMs: z.number().finite().nonnegative().max(15 * 60_000)
})

export const audioLevelSchema = z.number().finite().min(0).max(1)
export const booleanValueSchema = z.boolean()
export const vocabularyTermSchema = z.string().max(200)
export const historyIdSchema = z.string().min(1).max(100)
export const copyTextSchema = z.string().max(100_000)
