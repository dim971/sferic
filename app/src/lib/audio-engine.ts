class AudioEngineImpl {
  private ctx: AudioContext | null = null;

  getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return this.getContext().decodeAudioData(arrayBuffer);
  }
}

export const AudioEngine = new AudioEngineImpl();
