import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sherpaOnnx, {
  type OfflineRecognizer,
  type OfflineRecognizerConfig
} from 'sherpa-onnx-node'
import type { AsrStatus } from '../shared/contracts'
import {
  initialAsrStatus,
  WINDOWS_PARAKEET_MANIFEST_FILE,
  WINDOWS_PARAKEET_MODEL_FILES,
  WINDOWS_PARAKEET_MODEL_REVISION,
  WINDOWS_PARAKEET_MODEL_SIZE_BYTES,
  windowsParakeetModelUrl,
  type WindowsAsrWorkerMessage,
  type WindowsAsrWorkerRequest,
  type WindowsParakeetModelFile
} from '../shared/asr'

const parentPort = process.parentPort
if (!parentPort) throw new Error('Windows ASR worker requires an Electron parent port')

let recognizer: OfflineRecognizer | null = null
let modelsDirectory = ''
let preparePromise: Promise<void> | null = null

parentPort.on('message', (event) => {
  const message = event.data as WindowsAsrWorkerRequest
  if (message.type === 'prepare') {
    void prepare(message.modelsDirectory)
      .then(() => respond(message.id))
      .catch((error) => respond(message.id, undefined, error))
    return
  }

  void transcribe(message.wavPath)
    .then((text) => respond(message.id, text))
    .catch((error) => respond(message.id, undefined, error))
})

async function prepare(directory: string): Promise<void> {
  if (recognizer) return
  if (preparePromise) return preparePromise
  modelsDirectory = directory

  preparePromise = (async () => {
    try {
      await mkdir(modelsDirectory, { recursive: true })
      const verified = await hasVerifiedManifest()
      if (!verified) await ensureModelFiles()

      updateStatus({ ...initialAsrStatus('loading'), progress: 1 })
      const threads = Math.max(2, Math.min(4, os.availableParallelism()))
      const config: OfflineRecognizerConfig = {
        featConfig: { sampleRate: 16_000, featureDim: 80 },
        modelConfig: {
          transducer: {
            encoder: modelPath('encoder.int8.onnx'),
            decoder: modelPath('decoder.int8.onnx'),
            joiner: modelPath('joiner.int8.onnx')
          },
          tokens: modelPath('tokens.txt'),
          numThreads: threads,
          provider: 'cpu',
          modelType: 'nemo_transducer',
          debug: 0
        }
      }
      recognizer = await sherpaOnnx.OfflineRecognizer.createAsync(config)
      updateStatus(initialAsrStatus('ready'))
    } catch (error) {
      updateStatus({
        ...initialAsrStatus('error'),
        error: errorMessage(error)
      })
      throw error
    }
  })()

  try {
    await preparePromise
  } finally {
    preparePromise = null
  }
}

async function transcribe(wavPath: string): Promise<string> {
  if (!recognizer) {
    if (!modelsDirectory) throw new Error('Windows Parakeet model is not prepared')
    await prepare(modelsDirectory)
  }
  if (!recognizer) throw new Error('Windows Parakeet recognizer is unavailable')

  const startedAt = performance.now()
  const wave = sherpaOnnx.readWave(wavPath)
  const stream = recognizer.createStream()
  stream.acceptWaveform({ sampleRate: wave.sampleRate, samples: wave.samples })
  const result = await recognizer.decodeAsync(stream)
  console.info(`Transcribed in ${Math.round(performance.now() - startedAt)} ms`)
  return result.text.trim()
}

async function ensureModelFiles(): Promise<void> {
  let completedBytes = 0
  updateStatus({ ...initialAsrStatus('downloading'), progress: 0 })

  for (const file of WINDOWS_PARAKEET_MODEL_FILES) {
    if (await verifyModelFile(file)) {
      completedBytes += file.size
      updateDownloadProgress(completedBytes)
      continue
    }

    await downloadModelFile(file, completedBytes)
    completedBytes += file.size
    updateDownloadProgress(completedBytes)
  }

  const manifestPath = path.join(modelsDirectory, WINDOWS_PARAKEET_MANIFEST_FILE)
  const temporaryManifestPath = `${manifestPath}.part`
  await writeFile(
    temporaryManifestPath,
    JSON.stringify(
      {
        revision: WINDOWS_PARAKEET_MODEL_REVISION,
        files: WINDOWS_PARAKEET_MODEL_FILES.map(({ name, size, sha256 }) => ({
          name,
          size,
          sha256
        }))
      },
      null,
      2
    )
  )
  await unlink(manifestPath).catch(() => undefined)
  await rename(temporaryManifestPath, manifestPath)
}

async function downloadModelFile(
  file: WindowsParakeetModelFile,
  completedBytes: number
): Promise<void> {
  const destination = modelPath(file.name)
  const temporaryPath = `${destination}.part`
  await unlink(temporaryPath).catch(() => undefined)

  const response = await fetch(windowsParakeetModelUrl(file.name), {
    redirect: 'follow',
    signal: AbortSignal.timeout(30 * 60_000)
  })
  if (!response.ok || !response.body) {
    throw new Error(`Не удалось загрузить ${file.name}: HTTP ${response.status}`)
  }

  const hash = createHash('sha256')
  const handle = await open(temporaryPath, 'w')
  let downloadedBytes = 0
  let downloadError: unknown
  try {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      let chunkOffset = 0
      while (chunkOffset < value.byteLength) {
        const { bytesWritten } = await handle.write(
          value,
          chunkOffset,
          value.byteLength - chunkOffset,
          downloadedBytes + chunkOffset
        )
        if (bytesWritten === 0) throw new Error(`Не удалось записать ${file.name}`)
        chunkOffset += bytesWritten
      }
      downloadedBytes += value.byteLength
      updateDownloadProgress(completedBytes + downloadedBytes)
    }
  } catch (error) {
    downloadError = error
  } finally {
    await handle.close()
  }

  if (downloadError) {
    await unlink(temporaryPath).catch(() => undefined)
    throw downloadError
  }

  if (downloadedBytes !== file.size || hash.digest('hex') !== file.sha256) {
    await unlink(temporaryPath).catch(() => undefined)
    throw new Error(`Проверка целостности ${file.name} не пройдена`)
  }

  await unlink(destination).catch(() => undefined)
  await rename(temporaryPath, destination)
}

async function verifyModelFile(file: WindowsParakeetModelFile): Promise<boolean> {
  const filePath = modelPath(file.name)
  try {
    if ((await stat(filePath)).size !== file.size) return false
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(filePath)) hash.update(chunk)
    return hash.digest('hex') === file.sha256
  } catch {
    return false
  }
}

async function hasVerifiedManifest(): Promise<boolean> {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(modelsDirectory, WINDOWS_PARAKEET_MANIFEST_FILE), 'utf8')
    ) as { revision?: string }
    if (manifest.revision !== WINDOWS_PARAKEET_MODEL_REVISION) return false

    const sizes = await Promise.all(
      WINDOWS_PARAKEET_MODEL_FILES.map(async (file) => (await stat(modelPath(file.name))).size)
    )
    return sizes.every((size, index) => size === WINDOWS_PARAKEET_MODEL_FILES[index]?.size)
  } catch {
    return false
  }
}

function modelPath(fileName: string): string {
  return path.join(modelsDirectory, fileName)
}

function updateDownloadProgress(downloadedBytes: number): void {
  updateStatus({
    ...initialAsrStatus('downloading'),
    progress: Math.max(0, Math.min(1, downloadedBytes / WINDOWS_PARAKEET_MODEL_SIZE_BYTES))
  })
}

function updateStatus(status: AsrStatus): void {
  post({ type: 'status', status })
}

function respond(id: string, text?: string, error?: unknown): void {
  post({
    type: 'response',
    id,
    text,
    ...(error ? { error: errorMessage(error) } : {})
  })
}

function post(message: WindowsAsrWorkerMessage): void {
  parentPort.postMessage(message)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
