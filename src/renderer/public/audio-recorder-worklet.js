class CureVoicerRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    const channel = input && input[0]

    if (channel) {
      const copy = channel.slice()
      this.port.postMessage(copy.buffer, [copy.buffer])
    }

    return true
  }
}

registerProcessor('cure-voicer-recorder', CureVoicerRecorderProcessor)
