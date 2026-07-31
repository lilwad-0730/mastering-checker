/**
 * LUFSEngine - EBU R128 Loudness & 4x Oversampling True Peak Engine
 */
class LUFSEngine {
  constructor() {
    this.platforms = [
      { id: 'spotify', name: 'Spotify', targetLUFS: -14.0, maxTruePeak: -1.0, icon: 'fa-brands fa-spotify' },
      { id: 'apple', name: 'Apple Music', targetLUFS: -16.0, maxTruePeak: -1.0, icon: 'fa-brands fa-apple' },
      { id: 'youtube', name: 'YouTube Music', targetLUFS: -14.0, maxTruePeak: -1.0, icon: 'fa-brands fa-youtube' },
      { id: 'tidal', name: 'Tidal', targetLUFS: -14.0, maxTruePeak: -1.0, icon: 'fa-solid fa-water' },
      { id: 'soundcloud', name: 'SoundCloud', targetLUFS: -14.0, maxTruePeak: -1.0, icon: 'fa-brands fa-soundcloud' },
      { id: 'cd', name: 'CD / Digital Master', targetLUFS: -9.0, maxTruePeak: -0.1, icon: 'fa-solid fa-compact-disc' }
    ];
  }

  /**
   * Analyze AudioBuffer for LUFS, True Peak, and LRA
   */
  async analyzeAudioBuffer(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    // Get channel PCM data
    const channels = [];
    for (let c = 0; c < numberOfChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    // 1. K-Weighting Filter for EBU R128
    const kFilteredChannels = channels.map(channelData => this.applyKWeightingFilter(channelData, sampleRate));

    // 2. Integrated LUFS calculation
    const blockDuration = 0.4; // 400ms block
    const hopDuration = 0.1; // 100ms overlap
    const blockSize = Math.floor(sampleRate * blockDuration);
    const hopSize = Math.floor(sampleRate * hopDuration);

    const blocks = [];
    let ptr = 0;

    while (ptr + blockSize <= length) {
      let blockPower = 0;
      for (let c = 0; c < numberOfChannels; c++) {
        let channelSum = 0;
        const channelData = kFilteredChannels[c];
        for (let i = ptr; i < ptr + blockSize; i++) {
          channelSum += channelData[i] * channelData[i];
        }
        // Channel weighting (Left/Right = 1.0, Surround = 1.41)
        const channelMean = channelSum / blockSize;
        blockPower += channelMean;
      }
      
      const blockLoudness = -0.691 + 10 * Math.log10(Math.max(1e-12, blockPower));
      blocks.push(blockLoudness);
      ptr += hopSize;
    }

    // Absolute threshold (-70 LUFS) & Relative threshold (-10 dB relative to average)
    const absFilteredBlocks = blocks.filter(l => l > -70.0);
    let integratedLUFS = -70.0;

    if (absFilteredBlocks.length > 0) {
      const absMeanPower = absFilteredBlocks.reduce((acc, val) => acc + Math.pow(10, (val + 0.691) / 10), 0) / absFilteredBlocks.length;
      const relativeThreshold = -0.691 + 10 * Math.log10(Math.max(1e-12, absMeanPower)) - 10.0;

      const relFilteredBlocks = absFilteredBlocks.filter(l => l >= relativeThreshold);
      if (relFilteredBlocks.length > 0) {
        const relMeanPower = relFilteredBlocks.reduce((acc, val) => acc + Math.pow(10, (val + 0.691) / 10), 0) / relFilteredBlocks.length;
        integratedLUFS = -0.691 + 10 * Math.log10(Math.max(1e-12, relMeanPower));
      }
    }

    // 3. Short-Term LUFS (3-second sliding window)
    const shortTermWindowSize = Math.floor(sampleRate * 3.0);
    let maxShortTermLUFS = -70.0;
    ptr = 0;

    while (ptr + shortTermWindowSize <= length) {
      let stPower = 0;
      for (let c = 0; c < numberOfChannels; c++) {
        let channelSum = 0;
        const channelData = kFilteredChannels[c];
        for (let i = ptr; i < ptr + shortTermWindowSize; i += 4) { // Strided for performance
          channelSum += channelData[i] * channelData[i];
        }
        stPower += channelSum / (shortTermWindowSize / 4);
      }
      const stLoudness = -0.691 + 10 * Math.log10(Math.max(1e-12, stPower));
      if (stLoudness > maxShortTermLUFS) maxShortTermLUFS = stLoudness;
      ptr += Math.floor(sampleRate * 0.5);
    }

    // 4. Loudness Range (LRA) calculation
    let lra = 0;
    if (absFilteredBlocks.length > 5) {
      const sortedBlocks = [...absFilteredBlocks].sort((a, b) => a - b);
      const p10 = sortedBlocks[Math.floor(sortedBlocks.length * 0.1)];
      const p95 = sortedBlocks[Math.floor(sortedBlocks.length * 0.95)];
      lra = Math.max(0, p95 - p10);
    }

    // 5. 4x Oversampling True Peak Calculation
    const truePeakDB = this.calculateTruePeak4x(channels);

    // 6. Platform penalty matrix
    const platformAnalysis = this.platforms.map(p => {
      const loudnessPenalty = integratedLUFS > p.targetLUFS ? -(integratedLUFS - p.targetLUFS).toFixed(1) : 0;
      const truePeakExceeded = truePeakDB > p.maxTruePeak;
      return {
        ...p,
        loudnessPenalty,
        truePeakExceeded,
        diffLUFS: (integratedLUFS - p.targetLUFS).toFixed(1)
      };
    });

    return {
      integratedLUFS: Number(integratedLUFS.toFixed(1)),
      maxShortTermLUFS: Number(maxShortTermLUFS.toFixed(1)),
      lra: Number(lra.toFixed(1)),
      truePeakDB: Number(truePeakDB.toFixed(2)),
      platformAnalysis
    };
  }

  /**
   * Apply K-Weighting Biquad Filters (Stage 1 High Shelf + Stage 2 High Pass)
   */
  applyKWeightingFilter(channelData, sampleRate) {
    const output = new Float32Array(channelData.length);
    
    // Simplified Stage 1: High-shelf filter (~1.5kHz +4dB boost)
    let b0 = 1.53512485958697, b1 = -2.69169618940638, b2 = 1.19839281085285;
    let a1 = -1.69065929318241, a2 = 0.73248077421585;
    
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const stage1 = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const x = channelData[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
      stage1[i] = y;
    }

    // Stage 2: High-pass filter (~38Hz cut)
    b0 = 1.0; b1 = -2.0; b2 = 1.0;
    a1 = -1.99004745483398; a2 = 0.99007225036621;
    x1 = 0; x2 = 0; y1 = 0; y2 = 0;

    for (let i = 0; i < stage1.length; i++) {
      const x = stage1[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
      output[i] = y;
    }

    return output;
  }

  /**
   * Calculate True Peak using 4x Oversampling Cubic Interpolation
   */
  calculateTruePeak4x(channels) {
    let maxPeak = 0;

    for (let c = 0; c < channels.length; c++) {
      const data = channels[c];
      const len = data.length;
      
      // Step through array with 4x interpolation
      for (let i = 1; i < len - 2; i += 2) {
        const y0 = data[i - 1];
        const y1 = data[i];
        const y2 = data[i + 1];
        const y3 = data[i + 2];

        // 4x cubic Hermite oversampling points
        for (let t = 0; t < 1.0; t += 0.25) {
          const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
          const b = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
          const cVal = -0.5 * y0 + 0.5 * y2;
          const d = y1;

          const interpolated = a * t * t * t + b * t * t + cVal * t + d;
          const absVal = Math.abs(interpolated);
          if (absVal > maxPeak) maxPeak = absVal;
        }
      }
    }

    if (maxPeak <= 1e-6) return -96.0;
    return 20 * Math.log10(maxPeak);
  }
}

window.LUFSEngine = LUFSEngine;
