import { clipboard } from 'electron'
import type { ClipboardPort, ClipboardSnapshot } from '../../modules/clipboard/types'

export class ElectronClipboardPort implements ClipboardPort {
  async readSnapshot(): Promise<ClipboardSnapshot> {
    return {
      formats: clipboard.availableFormats().map((format) => ({
        format,
        data: new Uint8Array(clipboard.readBuffer(format))
      }))
    }
  }

  async writeSnapshot(snapshot: ClipboardSnapshot): Promise<void> {
    clipboard.clear()
    for (const entry of snapshot.formats) {
      clipboard.writeBuffer(entry.format, Buffer.from(entry.data))
    }
  }

  async writeText(text: string): Promise<void> {
    clipboard.writeText(text)
  }

  async readText(): Promise<string> {
    return clipboard.readText()
  }

  async clear(): Promise<void> {
    clipboard.clear()
  }
}
