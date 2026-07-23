import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'

export interface ValidatedIpcProcedure<TInput, TOutput> {
  channel: string
  input: z.ZodType<TInput>
  output: z.ZodType<TOutput>
  handle(event: IpcMainInvokeEvent, input: TInput): Promise<TOutput> | TOutput
}

export interface IpcSenderPolicy {
  assertTrusted(event: IpcMainInvokeEvent): void
}

export function registerValidatedHandler<TInput, TOutput>(
  ipc: Pick<IpcMain, 'handle' | 'removeHandler'>,
  senderPolicy: IpcSenderPolicy,
  procedure: ValidatedIpcProcedure<TInput, TOutput>
): () => void {
  ipc.handle(procedure.channel, async (event, rawInput: unknown) => {
    senderPolicy.assertTrusted(event)
    const input = procedure.input.parse(rawInput)
    const output = await procedure.handle(event, input)
    return procedure.output.parse(output)
  })

  return () => ipc.removeHandler(procedure.channel)
}
