export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type DiagnosticValue = string | number | boolean | null

export interface DiagnosticEvent {
  timestamp: string
  level: LogLevel
  scope: string
  stage: string
  operationId?: string
  platform: NodeJS.Platform
  details: Record<string, DiagnosticValue>
}

export interface DiagnosticSink {
  write(event: DiagnosticEvent): void
}

const sensitiveKeyPattern =
  /(?:text|transcript|clipboard|audio|password|secret|token|key|email|content)/iu

export class StructuredLogger {
  constructor(
    private readonly scope: string,
    private readonly sink: DiagnosticSink,
    private readonly platform: NodeJS.Platform = process.platform
  ) {}

  debug(stage: string, details: Record<string, DiagnosticValue> = {}): void {
    this.write('debug', stage, details)
  }

  info(stage: string, details: Record<string, DiagnosticValue> = {}): void {
    this.write('info', stage, details)
  }

  warn(stage: string, details: Record<string, DiagnosticValue> = {}): void {
    this.write('warn', stage, details)
  }

  error(stage: string, details: Record<string, DiagnosticValue> = {}): void {
    this.write('error', stage, details)
  }

  private write(
    level: LogLevel,
    stage: string,
    details: Record<string, DiagnosticValue>
  ): void {
    const operationId =
      typeof details.operationId === 'string' ? details.operationId : undefined
    const sanitized = Object.fromEntries(
      Object.entries(details)
        .filter(([key]) => key !== 'operationId')
        .map(([key, value]) => [
          key,
          sensitiveKeyPattern.test(key) ? '[REDACTED]' : value
        ])
    )
    this.sink.write({
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      stage,
      ...(operationId ? { operationId } : {}),
      platform: this.platform,
      details: sanitized
    })
  }
}

export class ConsoleDiagnosticSink implements DiagnosticSink {
  write(event: DiagnosticEvent): void {
    const line = JSON.stringify(event)
    if (event.level === 'error') console.error(line)
    else if (event.level === 'warn') console.warn(line)
    else if (event.level === 'debug') console.debug(line)
    else console.info(line)
  }
}

