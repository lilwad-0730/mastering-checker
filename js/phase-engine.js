/**
 * PhaseEngine - Turbo-Boosted Instant Stereo Phase Analyzer & Ozone Imager Scope
 */
class PhaseEngine {
  /**
   * Instant Stereo Phase Analysis (< 1ms execution time)
   */
  analyzePhase(audioBuffer) {
    if (audioBuffer.numberOfChannels < 2) {
      return {
        correlation: 1.0,
        stereoWidth: 0,
        status: 'pass',
        statusText: '純單聲道 (Mono) 音訊，無相位抵消問題。',
        polarPoints: []
      };
    }

    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const length = left.length;

    let dotProduct = 0;
    let leftSqSum = 0;
    let rightSqSum = 0;
    let midEnergy = 0;
    let sideEnergy = 0;

    // Fixed 1,000 sample steps across the entire audio buffer for 1ms execution time
    const maxSamples = 1000;
    const step = Math.max(1, Math.floor(length / maxSamples));
    
    // Save max 100 points for canvas rendering to prevent UI thread blocking
    const pointStep = Math.max(1, Math.floor(length / 100));
    const polarPoints = [];

    for (let i = 0; i < length; i += step) {
      const l = left[i];
      const r = right[i];

      dotProduct += l * r;
      leftSqSum += l * l;
      rightSqSum += r * r;

      const mid = (l + r) * 0.7071;
      const side = (l - r) * 0.7071;

      midEnergy += mid * mid;
      sideEnergy += side * side;

      if (i % pointStep < step && (l * l + r * r > 0.0001)) {
        const radius = Math.min(1.0, Math.sqrt(l * l + r * r));
        const angle = Math.atan2(side, mid); // -PI/2 to +PI/2
        
        // Classify point color: 0 = green (mono), 1 = cyan (stereo), 2 = red (out-of-phase)
        let colorType = 0;
        const absAngle = Math.abs(angle);
        if (absAngle > Math.PI / 3) colorType = 2; // Red
        else if (absAngle > Math.PI / 6) colorType = 1; // Cyan

        polarPoints.push({ radius, angle, colorType });
      }
    }

    // Pearson Correlation Coefficient r
    const denominator = Math.sqrt(leftSqSum * rightSqSum);
    let correlation = denominator > 0 ? dotProduct / denominator : 1.0;
    correlation = Math.max(-1.0, Math.min(1.0, correlation));

    // Stereo Width percentage
    const totalEnergy = midEnergy + sideEnergy;
    const stereoWidth = totalEnergy > 0 ? (sideEnergy / totalEnergy) * 100 : 0;

    // Phase Cancellation Risk Assessment
    let status = 'pass';
    let statusText = '✓ 立體聲相位良好！與單聲道 (Mono) 具備最佳向下相容性。';

    if (correlation < 0.0) {
      status = 'critical';
      statusText = `⚠️ 嚴重反相 (Out-of-Phase)！相關性為 ${correlation.toFixed(2)}。於單聲道喇叭 (如手機、夜店音響) 播放時低頻與人聲將被完全抵消！`;
    } else if (correlation < 0.3) {
      status = 'warning';
      statusText = `⚠️ 相位相關性偏低 (${correlation.toFixed(2)})，建議減少極端立體聲拓寬 (Stereo Widener) 效果，防止部分音軌消失。`;
    }

    return {
      correlation: Number(correlation.toFixed(2)),
      stereoWidth: Number(stereoWidth.toFixed(1)),
      status,
      statusText,
      polarPoints
    };
  }
}

window.PhaseEngine = PhaseEngine;
