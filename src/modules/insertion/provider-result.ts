import { performance } from 'node:perf_hooks'
import type {
  InsertionContext,
  InsertionOutcome,
  InsertionResult
} from '../../shared/types/insertion'

export async function runInsertionAttempt(
  providerId: string,
  context: InsertionContext,
  action: () => Promise<InsertionOutcome>
): Promise<InsertionResult> {
  const startedAt = performance.now()
  try {
    const outcome = await action()
    return result(
      context,
      providerId,
      outcome,
      Math.round(performance.now() - startedAt)
    )
  } catch (error) {
    return result(
      context,
      providerId,
      context.signal?.aborted ? 'cancelled' : 'failed',
      Math.round(performance.now() - startedAt),
      errorCode(error)
    )
  }
}

function result(
  context: InsertionContext,
  providerId: string,
  outcome: InsertionOutcome,
  durationMs: number,
  errorCode?: string
): InsertionResult {
  return {
    operationId: context.operationId,
    providerId,
    outcome,
    usedFallback: false,
    attempts: [
      {
        providerId,
        outcome,
        durationMs,
        ...(errorCode ? { errorCode } : {})
      }
    ]
  }
}

function errorCode(error: unknown): string {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return 'INSERTION_PROVIDER_FAILED'
}
