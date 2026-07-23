import type {
  VoiceCommand,
  VoiceCommandContext,
  VoiceCommandMatch,
  VoiceCommandResult
} from '../../shared/types/commands'

export interface VoiceCommandConfiguration {
  enabled?: boolean
  phrases?: readonly string[]
}

export class VoiceCommandRegistry {
  private readonly byId = new Map<string, VoiceCommand>()
  private readonly configuration = new Map<string, VoiceCommandConfiguration>()

  constructor(commands: readonly VoiceCommand[]) {
    for (const command of commands) {
      if (this.byId.has(command.id)) throw new Error(`Duplicate voice command: ${command.id}`)
      this.byId.set(command.id, command)
    }
  }

  configure(commandId: string, configuration: VoiceCommandConfiguration): void {
    if (!this.byId.has(commandId)) throw new Error(`Unknown voice command: ${commandId}`)
    this.configuration.set(commandId, configuration)
  }

  detect(transcript: string): VoiceCommandMatch | null {
    const raw = normalize(transcript)
    const prefix = raw.match(/^(?:команда|command)\s+(.+)$/u)
    const candidate = prefix?.[1] ?? raw
    if (!candidate) return null

    for (const command of this.byId.values()) {
      const configuration = this.configuration.get(command.id)
      if (configuration?.enabled === false) continue
      const phrases = configuration?.phrases ?? command.phrases
      const phrase = phrases.find((value) => normalize(value) === candidate)
      if (phrase) {
        return {
          commandId: command.id,
          phrase,
          explicitPrefix: Boolean(prefix)
        }
      }
    }
    return null
  }

  async execute(
    match: VoiceCommandMatch,
    context: VoiceCommandContext
  ): Promise<VoiceCommandResult> {
    const command = this.byId.get(match.commandId)
    if (!command) throw new Error(`Unknown voice command: ${match.commandId}`)
    if (command.dangerous && !context.confirmed) {
      return {
        commandId: command.id,
        handled: false,
        requiresConfirmation: true
      }
    }
    return command.execute(context)
  }
}

export class CallbackVoiceCommand implements VoiceCommand {
  constructor(
    readonly id: string,
    readonly phrases: string[],
    private readonly callback: (context: VoiceCommandContext) => Promise<VoiceCommandResult>,
    readonly dangerous = false
  ) {}

  execute(context: VoiceCommandContext): Promise<VoiceCommandResult> {
    return this.callback(context)
  }
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[.,!?;:]+$/gu, '')
    .replace(/\s+/gu, ' ')
}
