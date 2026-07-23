import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { registerValidatedHandler } from '../src/main/ipc/validated-handler'

describe('registerValidatedHandler', () => {
  it('validates input, sender and output', async () => {
    let listener:
      | ((event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>)
      | undefined
    const ipc = {
      handle: vi.fn(
        (
          _channel: string,
          next: (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>
        ) => {
          listener = next
        }
      ),
      removeHandler: vi.fn()
    } as unknown as Pick<IpcMain, 'handle' | 'removeHandler'>
    const assertTrusted = vi.fn()

    const dispose = registerValidatedHandler(ipc, { assertTrusted }, {
      channel: 'test:sum',
      input: z.object({ left: z.number(), right: z.number() }),
      output: z.object({ total: z.number() }),
      handle: (_event, input) => ({ total: input.left + input.right })
    })

    const event = {} as IpcMainInvokeEvent
    await expect(listener?.(event, { left: 2, right: 3 })).resolves.toEqual({ total: 5 })
    expect(assertTrusted).toHaveBeenCalledWith(event)
    await expect(listener?.(event, { left: '2', right: 3 })).rejects.toThrow()
    dispose()
    expect(ipc.removeHandler).toHaveBeenCalledWith('test:sum')
  })

  it('rejects invalid handler output', async () => {
    let listener:
      | ((event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>)
      | undefined
    const ipc = {
      handle: (
        _channel: string,
        next: (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>
      ) => {
        listener = next
      },
      removeHandler: () => undefined
    } as unknown as Pick<IpcMain, 'handle' | 'removeHandler'>

    registerValidatedHandler(ipc, { assertTrusted: () => undefined }, {
      channel: 'test:invalid-output',
      input: z.object({}).strict(),
      output: z.object({ ok: z.boolean() }),
      handle: () => ({ ok: 'yes' }) as unknown as { ok: boolean }
    })

    await expect(listener?.({} as IpcMainInvokeEvent, {})).rejects.toThrow()
  })
})

