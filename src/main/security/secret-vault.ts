import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface ProtectedStoragePort {
  isAvailable(): boolean
  encrypt(value: string): Buffer
  decrypt(value: Buffer): string
}

export class SecretVault {
  constructor(
    private readonly directory: string,
    private readonly storage: ProtectedStoragePort
  ) {}

  isAvailable(): boolean {
    return this.storage.isAvailable()
  }

  async set(id: string, secret: string): Promise<void> {
    const filePath = this.filePath(id)
    if (!this.storage.isAvailable()) throw new Error('Protected system storage is unavailable')
    if (!secret) throw new Error('Secret cannot be empty')
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    await writeFile(filePath, this.storage.encrypt(secret), { mode: 0o600 })
    await chmod(filePath, 0o600).catch(() => undefined)
  }

  async get(id: string): Promise<string | null> {
    if (!this.storage.isAvailable()) return null
    const encrypted = await readFile(this.filePath(id)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    return encrypted ? this.storage.decrypt(encrypted) : null
  }

  async remove(id: string): Promise<void> {
    await unlink(this.filePath(id)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }

  private filePath(id: string): string {
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/u.test(id)) throw new Error('Invalid secret identifier')
    return path.join(this.directory, `${id}.bin`)
  }
}
