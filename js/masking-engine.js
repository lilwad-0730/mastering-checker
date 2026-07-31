/**
 * MaskingEngine - Frequency Masking, Stem Clash & Muddiness Analyzer
 */
class MaskingEngine {
  constructor() {
    this.frequencyBands = [
      { id: 'sub', name: 'Sub-Bass (20-60Hz)', min: 20, max: 60, color: '#3b82f6' },
      { id: 'bass', name: 'Bass (60-250Hz)', min: 60, max: 250, color: '#00f0ff' },
      { id: 'mud', name: 'Mud Zone (250-500Hz)', min: 250, max: 500, color: '#f59e0b' },
      { id: 'mid', name: 'Mid (500-2kHz)', min: 500, max: 2000, color: '#10b981' },
      { id: 'vocal', name: 'Vocal Clarity / Harsh (2k-6kHz)', min: 2000, max: 6000, color: '#ef4444' },
      { id: 'air', name: 'Air / Brilliance (6k-20kHz)', min: 6000, max: 20000, color: '#8b5cf6' }
    ];
  }

  /**
   * Analyze spectrum of single AudioBuffer
   */
  analyzeSpectrum(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const fftSize = 2048;
    const numBands = this.frequencyBands.length;
    const bandEnergy = new Float32Array(numBands);

    // Compute FFT energy distribution
    const numWindows = Math.min(100, Math.floor(channelData.length / fftSize));
    let totalEnergy = 0;

    for (let w = 0; w < numWindows; w++) {
      const offset = Math.floor(w * (channelData.length / numWindows));
      const windowData = channelData.subarray(offset, offset + fftSize);
      const spectrum = this.computeFFT(windowData);

      for (let i = 0; i < spectrum.length; i++) {
        const freq = (i * sampleRate) / fftSize;
        const mag = spectrum[i];
        totalEnergy += mag;

        for (let b = 0; b < numBands; b++) {
          const band = this.frequencyBands[b];
          if (freq >= band.min && freq <= band.max) {
            bandEnergy[b] += mag;
          }
        }
      }
    }

    // Normalize band energy percentages
    const bandPercentages = {};
    for (let b = 0; b < numBands; b++) {
      const pct = totalEnergy > 0 ? (bandEnergy[b] / totalEnergy) * 100 : 0;
      bandPercentages[this.frequencyBands[b].id] = Number(pct.toFixed(1));
    }

    // Single Master Muddiness Index (Mud Zone 250-500Hz energy ratio)
    const mudRatio = bandPercentages['mud'] || 0;
    let muddinessStatus = 'normal';
    let muddinessText = '頻率分佈極佳！中低頻動態清晰，無視覺渾濁現象。';

    if (mudRatio > 35.0) {
      muddinessStatus = 'critical';
      muddinessText = `⚠️ 警告：250Hz - 500Hz (Mud Zone) 能量佔據高達 ${mudRatio}%！聲音極易渾濁糊成一片。建議在混音階段衰減樂器 300Hz 附近的 EQ。`;
    } else if (mudRatio > 25.0) {
      muddinessStatus = 'warning';
      muddinessText = `⚠️ 提示：250Hz - 500Hz 區域能量佔比為 ${mudRatio}%，中低頻稍微偏厚重，可適度修剪。`;
    }

    return {
      bandPercentages,
      muddinessStatus,
      muddinessText,
      mudRatio
    };
  }

  /**
   * Compare multiple Stems (e.g. Vocal vs Bass vs Synth) for Frequency Clash
   */
  analyzeStemConflicts(stemsData) {
    // stemsData: Array of { name, type, audioBuffer }
    // Types: 'vocal', 'bass', 'drums', 'synth', 'guitar', 'other'
    const conflicts = [];
    const vocalStem = stemsData.find(s => s.type === 'vocal');
    const otherStems = stemsData.filter(s => s.type !== 'vocal');

    if (!vocalStem) {
      return {
        hasVocal: false,
        summaryText: '未檢測到指定的人聲 (Vocal) 分軌。請上傳並標記人聲分軌以獲得 AI 人聲頻率打架與遮蔽警示。',
        conflicts: []
      };
    }

    const vocalSpectrum = this.analyzeSpectrum(vocalStem.audioBuffer);

    otherStems.forEach(stem => {
      const stemSpectrum = this.analyzeSpectrum(stem.audioBuffer);
      
      // Check 1: Mid-High Vocal Range Clash (2k-6kHz)
      const vocalVocalRange = vocalSpectrum.bandPercentages['vocal'];
      const stemVocalRange = stemSpectrum.bandPercentages['vocal'];

      if (vocalVocalRange > 20 && stemVocalRange > 20) {
        conflicts.push({
          severity: 'high',
          stemName: stem.name,
          stemType: stem.type,
          band: '2kHz - 6kHz (人聲清晰度頻段)',
          description: `人聲分軌與【${stem.name}】在此頻段能量同時高過 20% (${vocalVocalRange}% vs ${stemVocalRange}%)，導致人聲被遮蔽、聲音咬字模糊。`,
          recommendation: `建議在【${stem.name}】上使用 Dynamic EQ 在 2.5kHz - 4kHz 處雕刻出 -2.5dB 凹槽 (Frequency Cutout)，給人聲留出空間。`
        });
      }

      // Check 2: Low-Mid Mud Zone Clash (250-500Hz)
      const vocalMud = vocalSpectrum.bandPercentages['mud'];
      const stemMud = stemSpectrum.bandPercentages['mud'];

      if (vocalMud > 20 && stemMud > 25) {
        conflicts.push({
          severity: 'medium',
          stemName: stem.name,
          stemType: stem.type,
          band: '250Hz - 500Hz (渾濁擁擠區)',
          description: `人聲底端與【${stem.name}】在 300Hz 附近重疊佔用頻率，造成整體混音糊成一片。`,
          recommendation: `建議對人聲施加 120Hz-150Hz 的 High-pass Filter，並在中音樂器（如 ${stem.name}）衰減 350Hz。`
        });
      }
    });

    let summaryText = 'AI 檢測完成：人聲與樂器分軌動態搭配良好，未發現嚴重頻率遮蔽。';
    if (conflicts.length > 0) {
      summaryText = `⚠️ 檢測到 ${conflicts.length} 處嚴重頻率爭搶與遮蔽問題！請參考以下修正建議：`;
    }

    return {
      hasVocal: true,
      summaryText,
      conflicts
    };
  }

  /**
   * Fast Fourier Transform magnitude calculation
   */
  computeFFT(buffer) {
    const N = buffer.length;
    const magnitudes = new Float32Array(N / 2);

    // Hanning Window + Magnitude estimation
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      const step = 4; // Strided speedup
      for (let n = 0; n < N; n += step) {
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * n) / N));
        const angle = (2 * Math.PI * k * n) / N;
        const val = buffer[n] * window;
        real += val * Math.cos(angle);
        imag -= val * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag);
    }
    return magnitudes;
  }
}

window.MaskingEngine = MaskingEngine;
