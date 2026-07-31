/**
 * KeyEngine - Krumhansl-Schmuckler Chromagram Key & Mode Detection Engine
 */
class KeyEngine {
  constructor() {
    this.pitchNames = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
    this.noteFrequencies = [];

    // Precompute frequencies for C1 (32.70Hz) up to B7 (3951.07Hz)
    const a4 = 440.0;
    for (let midi = 24; midi <= 107; midi++) {
      const freq = a4 * Math.pow(2, (midi - 69) / 12);
      const pitchClass = midi % 12;
      this.noteFrequencies.push({ midi, freq, pitchClass });
    }

    // Krumhansl-Kessler Key Profiles
    this.majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    this.minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 2.69, 3.34, 3.17, 3.28];

    // Camelot Wheel Mapping
    this.camelotMap = {
      'C Major': '8B', 'A Minor': '8A',
      'G Major': '9B', 'E Minor': '9A',
      'D Major': '10B', 'B Minor': '10A',
      'A Major': '11B', 'F♯/G♭ Minor': '11A',
      'E Major': '12B', 'C♯/D♭ Minor': '12A',
      'B Major': '1B', 'G♯/A♭ Minor': '1A',
      'F♯/G♭ Major': '2B', 'D♯/E♭ Minor': '2A',
      'C♯/D♭ Major': '3B', 'A♯/B♭ Minor': '3A',
      'G♯/A♭ Major': '4B', 'F Minor': '4A',
      'D♯/E♭ Major': '5B', 'C Minor': '5A',
      'A♯/B♭ Major': '6B', 'G Minor': '6A',
      'F Major': '7B', 'D Minor': '7A'
    };
  }

  /**
   * Analyze AudioBuffer to detect Key, Scale, Chromagram, and Camelot Wheel
   */
  analyzeKey(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const chromagram = new Float32Array(12);

    // Fast strided FFT sampling across track
    const fftSize = 4096;
    const numWindows = Math.min(120, Math.floor(channelData.length / fftSize));

    for (let w = 0; w < numWindows; w++) {
      const offset = Math.floor(w * (channelData.length / numWindows));
      const windowData = channelData.subarray(offset, offset + fftSize);
      const spectrum = this.computeFFT(windowData);

      // Accumulate pitch class energies from spectrum bins
      for (let i = 2; i < spectrum.length; i++) {
        const freq = (i * sampleRate) / fftSize;
        if (freq < 30 || freq > 4000) continue;

        const mag = spectrum[i];
        if (mag < 0.001) continue;

        // Find nearest MIDI note
        const midi = Math.round(69 + 12 * Math.log2(freq / 440.0));
        if (midi >= 24 && midi <= 107) {
          const pc = midi % 12;
          chromagram[pc] += mag;
        }
      }
    }

    // Normalize Chromagram
    let maxChroma = 0;
    for (let i = 0; i < 12; i++) {
      if (chromagram[i] > maxChroma) maxChroma = chromagram[i];
    }
    const normalizedChroma = Array.from(chromagram).map(v => maxChroma > 0 ? Number((v / maxChroma).toFixed(3)) : 0);

    // Correlate Chromagram with 24 Major & Minor Key Profiles
    const keyScores = [];

    for (let root = 0; root < 12; root++) {
      // Major Key
      const majProfileShifted = this.rotateArray(this.majorProfile, root);
      const majCorr = this.pearsonCorrelation(normalizedChroma, majProfileShifted);
      keyScores.push({ root, mode: 'Major', keyName: `${this.pitchNames[root]} Major`, score: majCorr });

      // Minor Key
      const minProfileShifted = this.rotateArray(this.minorProfile, root);
      const minCorr = this.pearsonCorrelation(normalizedChroma, minProfileShifted);
      keyScores.push({ root, mode: 'Minor', keyName: `${this.pitchNames[root]} Minor`, score: minCorr });
    }

    // Sort by correlation score
    keyScores.sort((a, b) => b.score - a.score);

    const bestKey = keyScores[0];
    const secondBestKey = keyScores[1];

    // Format Key Names & Camelot Code
    const detectedKey = `${this.pitchNames[bestKey.root]} ${bestKey.mode === 'Major' ? '大調 (Major)' : '小調 (Minor)'}`;
    const keyEnglish = `${this.pitchNames[bestKey.root]} ${bestKey.mode}`;
    const camelotCode = this.camelotMap[keyEnglish] || '--';

    // Relative Key (關係大小調)
    let relativeKey = '';
    if (bestKey.mode === 'Major') {
      const relRoot = (bestKey.root + 9) % 12;
      relativeKey = `${this.pitchNames[relRoot]} 小調 (${this.pitchNames[relRoot]} Minor)`;
    } else {
      const relRoot = (bestKey.root + 3) % 12;
      relativeKey = `${this.pitchNames[relRoot]} 大調 (${this.pitchNames[relRoot]} Major)`;
    }

    return {
      detectedKey,
      keyEnglish,
      mode: bestKey.mode,
      rootNote: this.pitchNames[bestKey.root],
      camelotCode,
      relativeKey,
      confidence: Number((bestKey.score * 100).toFixed(1)),
      secondaryKey: `${this.pitchNames[secondBestKey.root]} ${secondBestKey.mode === 'Major' ? '大調' : '小調'}`,
      chromagram: normalizedChroma,
      pitchNames: this.pitchNames
    };
  }

  rotateArray(arr, k) {
    const n = arr.length;
    const result = new Array(n);
    for (let i = 0; i < n; i++) {
      result[(i + k) % n] = arr[i];
    }
    return result;
  }

  pearsonCorrelation(x, y) {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den === 0 ? 0 : num / den;
  }

  computeFFT(buffer) {
    const N = buffer.length;
    const magnitudes = new Float32Array(N / 2);
    for (let k = 0; k < N / 2; k += 2) {
      let real = 0, imag = 0;
      for (let n = 0; n < N; n += 4) {
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * n) / N));
        const val = buffer[n] * window;
        const angle = (2 * Math.PI * k * n) / N;
        real += val * Math.cos(angle);
        imag -= val * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag);
    }
    return magnitudes;
  }
}

window.KeyEngine = KeyEngine;
