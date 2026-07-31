/**
 * AudioDecoder - Web Audio API Decoder & Demo Audio Generator
 */
class AudioDecoder {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * Decode File object to AudioBuffer
   */
  async decodeFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return await this.audioCtx.decodeAudioData(arrayBuffer);
  }

  /**
   * Generate Synthetic Demo Audio Tracks for 1-Click Testing
   */
  async generateDemoMasterAndStems() {
    const sampleRate = 44100;
    const duration = 12; // 12 seconds demo
    const length = sampleRate * duration;

    // 1. Generate Vocal Stem (Contains 1.5kHz - 4kHz vocal tone + formants)
    const vocalBuffer = this.audioCtx.createBuffer(2, length, sampleRate);
    const vL = vocalBuffer.getChannelData(0);
    const vR = vocalBuffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Singing melody synth around 880Hz + 2.5kHz harmonics
      const melody = Math.sin(2 * Math.PI * 440 * t) * 0.3 +
                     Math.sin(2 * Math.PI * 880 * t) * 0.4 +
                     Math.sin(2 * Math.PI * 2500 * t) * 0.3; // Vocal clarity/harsh region
      const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t);
      vL[i] = melody * env * 0.4;
      vR[i] = melody * env * 0.4;
    }

    // 2. Generate Synth / Guitar Stem (Stereo Widener effect + Mud 320Hz + 3kHz clash)
    const synthBuffer = this.audioCtx.createBuffer(2, length, sampleRate);
    const sL = synthBuffer.getChannelData(0);
    const sR = synthBuffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Sawtooth chord with 320Hz mud accumulation + 3kHz clash + stereo phase shift
      const chordL = Math.sin(2 * Math.PI * 320 * t) * 0.5 + Math.sin(2 * Math.PI * 3000 * t) * 0.4;
      const chordR = Math.sin(2 * Math.PI * 320 * (t + 0.0003)) * 0.5 + Math.sin(2 * Math.PI * 3000 * (t - 0.0003)) * 0.4;
      sL[i] = chordL * 0.45;
      sR[i] = chordR * 0.45;
    }

    // 3. Generate Bass / Drums Stem (Sub 50Hz + Bass 100Hz)
    const bassBuffer = this.audioCtx.createBuffer(2, length, sampleRate);
    const bL = bassBuffer.getChannelData(0);
    const bR = bassBuffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const kick = Math.sin(2 * Math.PI * 60 * t * Math.exp(-t % 0.5 * 10)) * 0.6;
      const sub = Math.sin(2 * Math.PI * 55 * t) * 0.5;
      bL[i] = (kick + sub) * 0.5;
      bR[i] = (kick + sub) * 0.5;
    }

    // 4. Combine into Full Master Buffer with slight peak saturation (-0.5 dBTP)
    const masterBuffer = this.audioCtx.createBuffer(2, length, sampleRate);
    const mL = masterBuffer.getChannelData(0);
    const mR = masterBuffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      mL[i] = Math.min(0.99, (vL[i] + sL[i] + bL[i]) * 1.15); // Slightly loud master
      mR[i] = Math.min(0.99, (vR[i] + sR[i] + bR[i]) * 1.15);
    }

    return {
      master: {
        name: 'Demo_Full_Master_Loud.wav',
        buffer: masterBuffer,
        headerInfo: { formatName: 'wav', bitDepth: 24, sampleRate: 44100, audioFormat: 'Linear PCM' }
      },
      stems: [
        { name: 'Stem_Vocal.wav', type: 'vocal', buffer: vocalBuffer, headerInfo: { formatName: 'wav', bitDepth: 24, sampleRate: 44100 } },
        { name: 'Stem_SynthChords.wav', type: 'synth', buffer: synthBuffer, headerInfo: { formatName: 'wav', bitDepth: 24, sampleRate: 44100 } },
        { name: 'Stem_BassDrums.wav', type: 'bass', buffer: bassBuffer, headerInfo: { formatName: 'wav', bitDepth: 24, sampleRate: 44100 } }
      ]
    };
  }
}

window.AudioDecoder = AudioDecoder;
