import {
  getLlama,
  LlamaChatSession,
  resolveModelFile,
  type Llama,
  type LlamaContext,
  type LlamaModel
} from 'node-llama-cpp'
import type { SmartCorrectionStatus } from '../shared/contracts'
import {
  buildCorrectionPrompt,
  buildTransformationPrompt,
  initialSmartCorrectionStatus,
  sanitizeModelCorrection,
  sanitizeModelTransformation,
  SMART_CORRECTION_MODEL_FILE,
  SMART_CORRECTION_MODEL_URI,
  type SmartCorrectionWorkerMessage,
  type SmartCorrectionWorkerRequest
} from '../shared/smart-correction'

const systemPrompt = `Normalize one software developer voice transcript.
Return only the normalized transcript, without labels or explanation.
Keep natural Russian words in Russian. Preserve already correct words and identifiers.
Restore phonetically spoken English only when clear from developer context.
Canonical glossary: юзэффект=useEffect; фечт=fetch; локал сторож=localStorage; аборт контроллер=AbortController; аборт сигнал=AbortSignal; танстек квери=TanStack Query; query клиент=QueryClient.
When the entire phrase uses English function words such as юз, виз, энд, restore it as English.
Keep "новая строка" and "new line" unchanged.`

const parentPort = process.parentPort
if (!parentPort) throw new Error('Smart correction worker requires an Electron parent port')

let llama: Llama | null = null
let model: LlamaModel | null = null
let context: LlamaContext | null = null
let session: LlamaChatSession | null = null
let preparePromise: Promise<void> | null = null
let correctionQueue: Promise<void> = Promise.resolve()
const controllers = new Map<string, AbortController>()

parentPort.on('message', (event) => {
  const data = event.data as SmartCorrectionWorkerRequest
  if (data.type === 'cancel') {
    controllers.get(data.id)?.abort(new Error('Smart correction timed out'))
    return
  }

  if (data.type === 'prepare') {
    void prepare(data.modelsDirectory)
      .then(() => respond(data.id, 'ready'))
      .catch((error) => respond(data.id, undefined, error))
    return
  }

  const controller = new AbortController()
  controllers.set(data.id, controller)
  correctionQueue = correctionQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        if (!session) throw new Error('Smart correction model is not ready')
        if (controller.signal.aborted) throw controller.signal.reason
        session.resetChatHistory()
        const startedAt = performance.now()
        const prompt = data.type === 'transform'
          ? buildTransformationPrompt(data.text, data.instruction, data.targetLanguage)
          : buildCorrectionPrompt(data.text, {
              previousText: data.previousText,
              preferredTerms: data.preferredTerms
            })
        const raw = await session.prompt(
          prompt,
          {
            temperature: 0,
            maxTokens: Math.min(768, Math.max(64, Math.ceil(data.text.length * 0.65))),
            budgets: { thoughtTokens: 0 },
            signal: controller.signal,
            trimWhitespaceSuffix: true
          }
        )
        console.info(`Transformed text in ${Math.round(performance.now() - startedAt)} ms`)
        respond(
          data.id,
          data.type === 'transform'
            ? sanitizeModelTransformation(raw, data.text)
            : sanitizeModelCorrection(raw, data.text)
        )
      } catch (error) {
        respond(data.id, undefined, error)
      } finally {
        controllers.delete(data.id)
      }
    })
})

async function prepare(modelsDirectory: string): Promise<void> {
  if (session) return
  if (preparePromise) return preparePromise

  preparePromise = (async () => {
    updateStatus({ state: 'downloading', progress: 0 })
    const modelPath = await resolveModelFile(SMART_CORRECTION_MODEL_URI, {
      directory: modelsDirectory,
      fileName: SMART_CORRECTION_MODEL_FILE,
      cli: false,
      onProgress: ({ downloadedSize, totalSize }) => {
        updateStatus({
          state: 'downloading',
          progress: totalSize > 0 ? downloadedSize / totalSize : 0
        })
      }
    })

    updateStatus({ state: 'loading', progress: 1 })
    llama = await getLlama()
    model = await llama.loadModel({ modelPath })
    context = await model.createContext({ contextSize: 2_048, sequences: 1 })
    session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt
    })
    updateStatus({ state: 'ready', progress: 1 })
  })()

  try {
    await preparePromise
  } catch (error) {
    updateStatus({ state: 'error', progress: 0, error: errorMessage(error) })
    await disposeModel()
    throw error
  } finally {
    preparePromise = null
  }
}

function updateStatus(
  patch: Pick<SmartCorrectionStatus, 'state' | 'progress'> & { error?: string }
): void {
  post({
    type: 'status',
    status: { ...initialSmartCorrectionStatus(patch.state), ...patch }
  })
}

function respond(id: string, result?: string, error?: unknown): void {
  post({
    type: 'response',
    id,
    result,
    ...(error ? { error: errorMessage(error) } : {})
  })
}

function post(message: SmartCorrectionWorkerMessage): void {
  parentPort.postMessage(message)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function disposeModel(): Promise<void> {
  session?.dispose()
  session = null
  await context?.dispose().catch(() => undefined)
  context = null
  await model?.dispose().catch(() => undefined)
  model = null
  await llama?.dispose().catch(() => undefined)
  llama = null
}

process.once('exit', () => {
  session?.dispose()
})
