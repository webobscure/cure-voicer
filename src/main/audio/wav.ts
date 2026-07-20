const WAV_HEADER_SIZE = 44

export function encodeFloat32PcmAsWav(
  samples: Float32Array,
  sampleRate: number
): Buffer {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const output = Buffer.allocUnsafe(WAV_HEADER_SIZE + dataSize)

  output.write('RIFF', 0, 'ascii')
  output.writeUInt32LE(36 + dataSize, 4)
  output.write('WAVE', 8, 'ascii')
  output.write('fmt ', 12, 'ascii')
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(1, 20)
  output.writeUInt16LE(1, 22)
  output.writeUInt32LE(sampleRate, 24)
  output.writeUInt32LE(sampleRate * bytesPerSample, 28)
  output.writeUInt16LE(bytesPerSample, 32)
  output.writeUInt16LE(16, 34)
  output.write('data', 36, 'ascii')
  output.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    output.writeInt16LE(Math.round(int16), WAV_HEADER_SIZE + index * bytesPerSample)
  }

  return output
}

export function float32FromBytes(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error('PCM payload has an invalid byte length')
  }

  const copy = Uint8Array.from(bytes)
  return new Float32Array(copy.buffer)
}
