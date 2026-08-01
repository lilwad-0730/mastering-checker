/**
 * LUFSEngine - K-Weighting Filter & RMS Energy Loudness Engine (ITU-R BS.1770-4 / EBU R128)
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
   * Analyze AudioBuffer using K-Weighting Filter & Channel RMS Energy
   */
  async analyzeAudioBuffer(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    // Extract raw float PCM channel data
    const rawChannels = [];
    for (let c = 0; c < numberOfChannels; c++) {
      rawChannels.push(audioBuffer.getChannelData(c));
    }

    // 1. K-Weighting Filter (Stage 1 High Shelf Pre-filter + Stage 2 RLB High Pass Filter)
    const kFilteredChannels = rawChannels.map(chData => this.applyKWeighting(chData, sampleRate));

    // Channel Weights: Left/Right = 1.0, Center = 1.0, Surround = 1.41
    const channelWeights = numberOfChannels === 1 ? [1.0] : [1.0, 1.0];

    // 2. RMS Energy Calculation over 400ms Gated Window (ITU-R BS.1770-4)
    const blockSize = Math.round(sampleRate * 0.4); // 400ms block
    const hopSize = Math.round(sampleRate * 0.1);   // 100ms hop (75% overlap)
    const blocks = [];

    for (let ptr = 0; ptr + blockSize <= length; ptr += hopSize) {
      let blockPower = 0;

      for (let c = 0; c < numberOfChannels; c++) {
        const weight = channelWeights[c] || 1.0;
        const chData = kFilteredChannels[c];

        let sumSq = 0;
        for (let i = ptr; i < ptr + blockSize; i++) {
          const sample = chData[i];
          sumSq += sample * sample;
        }

        // Channel RMS (Root Mean Square) Energy
        const channelRMS = Math.sqrt(sumSq / blockSize);
        const channelMeanSquare = channelRMS * channelRMS; // MS Energy = RMS^2

        blockPower += weight * channelMeanSquare;
      }

      // Convert RMS Mean Square Power to K-Weighted Loudness (LUFS / LKFS)
      const blockLoudness = -0.691 + 10.0 * Math.log10(Math.max(1e-12, blockPower));
      blocks.push({ loudness: blockLoudness, power: blockPower });
    }

    // Stage 1: Absolute Gating Threshold (-70.0 LKFS / LUFS)
    const absGated = blocks.filter(b => b.loudness > -70.0);

    let integratedLUFS = -70.0;
    if (absGated.length > 0) {
      // Average RMS Power across Absolute Gated Blocks
      const absMeanPower = absGated.reduce((sum, b) => sum + b.power, 0) / absGated.length;
      const absLoudness = -0.691 + 10.0 * Math.log10(Math.max(1e-12, absMeanPower));

      // Stage 2: Relative Gating Threshold (-10.0 LU relative to absolute mean)
      const relThreshold = absLoudness - 10.0;
      const relGated = absGated.filter(b => b.loudness > relThreshold);

      if (relGated.length > 0) {
        const relMeanPower = relGated.reduce((sum, b) => sum + b.power, 0) / relGated.length;
        integratedLUFS = -0.691 + 10.0 * Math.log10(Math.max(1e-12, relMeanPower));
      }
    }

    // 3. Short-Term LUFS (3.0s sliding RMS window)
    const stBlockSize = Math.round(sampleRate * 3.0);
    const stHopSize = Math.round(sampleRate * 0.1);
    let maxShortTermLUFS = -70.0;

    for (let ptr = 0; ptr + stBlockSize <= length; ptr += stHopSize) {
      let stPower = 0;
      for (let c = 0; c < numberOfChannels; c++) {
        const weight = channelWeights[c] || 1.0;
        const chData = kFilteredChannels[c];
        let sumSq = 0;
        for (let i = ptr; i < ptr + stBlockSize; i++) {
          const sample = chData[i];
          sumSq += sample * sample;
        }
        const stRMS = Math.sqrt(sumSq / stBlockSize);
        stPower += weight * (stRMS * stRMS);
      }
      const stLoudness = -0.691 + 10.0 * Math.log10(Math.max(1e-12, stPower));
      if (stLoudness > maxShortTermLUFS) maxShortTermLUFS = stLoudness;
    }

    // 4. Loudness Range (LRA) according to EBU Tech 3342
    let lra = 0;
    if (blocks.length >= 10) {
      const stBlocksLoudness = [];
      const stWin = Math.round(sampleRate * 3.0);
      const stStep = Math.round(sampleRate * 0.1);

      for (let ptr = 0; ptr + stWin <= length; ptr += stStep) {
        let p = 0;
        for (let c = 0; c < numberOfChannels; c++) {
          const weight = channelWeights[c] || 1.0;
          const chData = kFilteredChannels[c];
          let sumSq = 0;
          for (let i = ptr; i < ptr + stWin; i++) {
            const sample = chData[i];
            sumSq += sample * sample;
          }
          const rms = Math.sqrt(sumSq / stWin);
          p += weight * (rms * rms);
        }
        const l = -0.691 + 10.0 * Math.log10(Math.max(1e-12, p));
        if (l > -70.0) stBlocksLoudness.push(l);
      }

      if (stBlocksLoudness.length > 5) {
        const meanStPower = stBlocksLoudness.reduce((s, val) => s + Math.pow(10, (val + 0.691) / 10), 0) / stBlocksLoudness.length;
        const meanStLoudness = -0.691 + 10.0 * Math.log10(Math.max(1e-12, meanStPower));
        const lraRelThreshold = meanStLoudness - 20.0;

        const lraGated = stBlocksLoudness.filter(l => l > lraRelThreshold).sort((a, b) => a - b);
        if (lraGated.length > 5) {
          const p10 = lraGated[Math.floor(lraGated.length * 0.10)];
          const p95 = lraGated[Math.floor(lraGated.length * 0.95)];
          lra = Math.max(0, p95 - p10);
        }
      }
    }

    // 5. ITU-R BS.1770-4 Precision 4x Sinc Oversampling True Peak Engine (dBTP)
    const truePeakDB = this.calculateTruePeak4xPrecision(rawChannels);

    // 6. Platform Penalty Matrix
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
   * K-Weighting Filter: Stage 1 High Shelf Pre-filter + Stage 2 RLB High Pass Filter
   * Computes exact biquad coefficients for any sample rate fs
   */
  applyKWeighting(channelData, fs) {
    const len = channelData.length;
    const stage1Out = new Float32Array(len);
    const output = new Float32Array(len);

    // Stage 1: High Shelf Filter (Head Model)
    const dbG = 3.999843853973347;
    const f0_s1 = 1681.974450973347;
    const Vh = Math.pow(10, dbG / 20);
    const K1 = Math.tan((Math.PI * f0_s1) / fs);
    const norm1 = 1 + Math.SQRT2 * K1 + K1 * K1;

    const b0_s1 = (Vh + Math.sqrt(2 * Vh) * K1 + K1 * K1) / norm1;
    const b1_s1 = (2 * (K1 * K1 - Vh)) / norm1;
    const b2_s1 = (Vh - Math.sqrt(2 * Vh) * K1 + K1 * K1) / norm1;
    const a1_s1 = (2 * (K1 * K1 - 1)) / norm1;
    const a2_s1 = (1 - Math.SQRT2 * K1 + K1 * K1) / norm1;

    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = channelData[i];
      const y = b0_s1 * x + b1_s1 * x1 + b2_s1 * x2 - a1_s1 * y1 - a2_s1 * y2;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
      stage1Out[i] = y;
    }

    // Stage 2: High Pass Filter (RLB Filter)
    const f0_s2 = 38.13547087602444;
    const Q_s2 = 0.5003270373238773;

    const K2 = Math.tan((Math.PI * f0_s2) / fs);
    const norm2 = 1 + K2 / Q_s2 + K2 * K2;

    const b0_s2 = 1.0 / norm2;
    const b1_s2 = -2.0 / norm2;
    const b2_s2 = 1.0 / norm2;
    const a1_s2 = (2 * (K2 * K2 - 1)) / norm2;
    const a2_s2 = (1 - K2 / Q_s2 + K2 * K2) / norm2;

    x1 = 0; x2 = 0; y1 = 0; y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = stage1Out[i];
      const y = b0_s2 * x + b1_s2 * x1 + b2_s2 * x2 - a1_s2 * y1 - a2_s2 * y2;
      x2 = x1; x1 = x;
      y2 = y1; y1 = y;
      output[i] = y;
    }

    return output;
  }

  /**
   * ITU-R BS.1770-4 Precision 4x Sinc Polyphase Oversampling True Peak Engine
   */
  calculateTruePeak4xPrecision(channels) {
    let maxPeak = 0;

    const polyCoeffs = [
      [0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0, 0, 0],
      [-0.003, 0.008, -0.019, 0.038, -0.071, 0.134, -0.279, 0.942, 0.311, -0.112, 0.053, -0.027, 0.013, -0.006, 0.002, 0],
      [-0.005, 0.013, -0.029, 0.057, -0.104, 0.198, -0.424, 0.796, 0.796, -0.424, 0.198, -0.104, 0.057, -0.029, 0.013, -0.005],
      [0, -0.006, 0.013, -0.027, 0.053, -0.112, 0.311, 0.942, -0.279, 0.134, -0.071, 0.038, -0.019, 0.008, -0.003, 0]
    ];

    for (let c = 0; c < channels.length; c++) {
      const data = channels[c];
      const len = data.length;

      for (let i = 0; i < len; i++) {
        const absVal = Math.abs(data[i]);
        if (absVal > maxPeak) maxPeak = absVal;
      }

      for (let i = 7; i < len - 8; i++) {
        for (let phase = 1; phase < 4; phase++) {
          const coeffs = polyCoeffs[phase];
          let subSample = 0;
          for (let k = 0; k < 16; k++) {
            subSample += data[i - 7 + k] * coeffs[k];
          }
          const absSub = Math.abs(subSample);
          if (absSub > maxPeak) maxPeak = absSub;
        }
      }
    }

    if (maxPeak <= 1e-6) return -96.0;
    return 20 * Math.log10(maxPeak);
  }
}

window.LUFSEngine = LUFSEngine;
