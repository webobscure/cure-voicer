import { z } from 'zod'

export const operationIdSchema = z.string().uuid()

export const ipcErrorSchema = z.object({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  recoverable: z.boolean()
})

export type IpcErrorDto = z.infer<typeof ipcErrorSchema>

export const emptyRequestSchema = z.object({}).strict()

export const textRequestSchema = z.object({
  text: z.string().max(100_000)
})

export const booleanRequestSchema = z.object({ value: z.boolean() })

