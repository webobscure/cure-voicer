import type { StructuredLogger } from '../diagnostics/structured-logger'
import type {
  InsertionContext,
  InsertionMode,
  InsertionResult,
  TextInsertionProvider
} from '../../shared/types/insertion'
import type { ActiveApplicationProvider } from './ports'
import { runWithInsertionActivity } from './insertion-activity'

export interface TextInsertionServiceOptions {
  fallbackModes: readonly InsertionMode[]
  activeApplications: ActiveApplicationProvider
  logger?: StructuredLogger
}

export class TextInsertionService {
  private readonly byMode = new Map<InsertionMode, TextInsertionProvider>()

  constructor(
    providers: readonly TextInsertionProvider[],
    private readonly options: TextInsertionServiceOptions
  ) {
    for (const provider of providers) {
      if (this.byMode.has(provider.mode)) {
        throw new Error(`Duplicate insertion provider for mode ${provider.mode}`)
      }
      this.byMode.set(provider.mode, provider)
    }
  }

  async insertText(text: string, context: InsertionContext): Promise<InsertionResult> {
    return runWithInsertionActivity(() => this.insertExclusive(text, context))
  }

  private async insertExclusive(
    text: string,
    context: InsertionContext
  ): Promise<InsertionResult> {
    if (!text) return terminalResult(context, 'none', 'failed', 'INSERTION_EMPTY_TEXT')
    if (context.signal?.aborted) {
      return terminalResult(context, 'none', 'cancelled', 'INSERTION_CANCELLED')
    }
    if (isBlockedApplication(context)) {
      return this.policyFallback(
        text,
        context,
        'application-policy',
        'INSERTION_APPLICATION_BLOCKED'
      )
    }
    if (
      context.activeApplication.isSecureField &&
      context.requestedMode !== 'internal-editor'
    ) {
      return this.policyFallback(text, context, 'security-policy', 'INSERTION_SECURE_FIELD')
    }

    if (requiresStableTarget(context.requestedMode)) {
      const currentApplication = await this.options.activeApplications.getActiveApplication()
      if (!sameApplication(context.activeApplication, currentApplication)) {
        return this.policyFallback(
          text,
          context,
          'focus-policy',
          'INSERTION_ACTIVE_APPLICATION_CHANGED'
        )
      }
    }

    const modes = deduplicate([
      context.requestedMode,
      ...(context.allowFallback ? this.options.fallbackModes : [])
    ])
    const attempts: InsertionResult['attempts'] = []

    for (const mode of modes) {
      const provider = this.byMode.get(mode)
      if (!provider || !(await provider.isSupported(context).catch(() => false))) continue
      const result = await provider.insertText(text, context)
      attempts.push(...result.attempts)
      this.options.logger?.info('insertion-attempt-complete', {
        operationId: context.operationId,
        provider: provider.id,
        outcome: result.outcome,
        durationMs: result.attempts[0]?.durationMs ?? 0,
        fallback: mode !== context.requestedMode
      })
      if (!['failed', 'blocked'].includes(result.outcome)) {
        return {
          ...result,
          usedFallback: mode !== context.requestedMode,
          attempts
        }
      }
      if (result.outcome === 'cancelled') return { ...result, attempts }
    }

    return {
      operationId: context.operationId,
      providerId: attempts.at(-1)?.providerId ?? 'none',
      outcome: 'failed',
      usedFallback: attempts.length > 1,
      attempts
    }
  }

  private async policyFallback(
    text: string,
    context: InsertionContext,
    providerId: string,
    errorCode: string
  ): Promise<InsertionResult> {
    const policyResult = terminalResult(context, providerId, 'blocked', errorCode)
    if (!context.allowFallback) return policyResult
    const editor = this.byMode.get('internal-editor')
    if (!editor || !(await editor.isSupported(context).catch(() => false))) return policyResult
    const editorResult = await editor.insertText(text, context)
    return {
      ...editorResult,
      usedFallback: true,
      attempts: [...policyResult.attempts, ...editorResult.attempts]
    }
  }
}

function sameApplication(
  expected: InsertionContext['activeApplication'],
  current: InsertionContext['activeApplication']
): boolean {
  if (expected.processId && current.processId) return expected.processId === current.processId
  if (expected.applicationId && current.applicationId) {
    return expected.applicationId === current.applicationId
  }
  return expected.applicationName === current.applicationName
}

function deduplicate(modes: readonly InsertionMode[]): InsertionMode[] {
  return [...new Set(modes)]
}

function requiresStableTarget(mode: InsertionMode): boolean {
  return mode === 'keyboard' || mode === 'accessibility' || mode === 'clipboard-safe'
}

function isBlockedApplication(context: InsertionContext): boolean {
  const blocked = new Set(
    (context.blockedApplicationIds ?? []).map((value) => value.trim().toLocaleLowerCase())
  )
  return [
    context.activeApplication.applicationId,
    context.activeApplication.applicationName,
    context.activeApplication.executablePath
  ].some((value) => Boolean(value && blocked.has(value.toLocaleLowerCase())))
}

function terminalResult(
  context: InsertionContext,
  providerId: string,
  outcome: InsertionResult['outcome'],
  errorCode: string
): InsertionResult {
  return {
    operationId: context.operationId,
    providerId,
    outcome,
    usedFallback: false,
    attempts: [{ providerId, outcome, durationMs: 0, errorCode }]
  }
}
