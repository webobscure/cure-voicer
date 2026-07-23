import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SecretVault } from '../src/main/security/secret-vault'

describe('SecretVault', () => {
  it('stores only protected bytes and round-trips through the system adapter', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'cure-voicer-secret-test-'))
    const vault = new SecretVault(directory, {
      isAvailable: () => true,
      encrypt: (value) => Buffer.from(Buffer.from(value).map((byte) => byte ^ 0x5a)),
      decrypt: (value) => Buffer.from(value.map((byte) => byte ^ 0x5a)).toString('utf8')
    })
    await vault.set('provider.api-key', 'top-secret')
    expect((await readFile(path.join(directory, 'provider.api-key.bin'))).toString()).not.toContain('top-secret')
    await expect(vault.get('provider.api-key')).resolves.toBe('top-secret')
    await vault.remove('provider.api-key')
    await expect(vault.get('provider.api-key')).resolves.toBeNull()
    await rm(directory, { recursive: true })
  })

  it('rejects path traversal and plaintext fallback', async () => {
    const vault = new SecretVault('/tmp/not-used', {
      isAvailable: () => false,
      encrypt: () => Buffer.alloc(0),
      decrypt: () => ''
    })
    await expect(vault.set('../key', 'secret')).rejects.toThrow('Invalid secret identifier')
    await expect(vault.set('key', 'secret')).rejects.toThrow('unavailable')
  })
})
