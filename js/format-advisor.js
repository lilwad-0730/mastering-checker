/**
 * FormatAdvisor - Audio Format, Extension & Streaming Distributor Advisor
 */
class FormatAdvisor {
  evaluateFormat(fileName, headerInfo, audioBuffer) {
    const ext = fileName.split('.').pop().toLowerCase();
    const isLossless = ['wav', 'flac', 'aiff', 'aif'].includes(ext);
    const bitDepth = headerInfo.bitDepth || 24;
    const sampleRate = audioBuffer.sampleRate;

    let status = 'pass'; // 'pass', 'warning', 'critical'
    let title = '格式符合專業發行標準！';
    let desc = `檔案副檔名為 .${ext.toUpperCase()} (無損 PCM / ${bitDepth}-bit / ${sampleRate / 1000}kHz)，適合全串流平台發行上架。`;
    const recommendations = [];

    if (!isLossless) {
      status = 'critical';
      title = `⚠️ 不建議使用有損格式 (.${ext.toUpperCase()}) 作為發行母帶！`;
      desc = `檢測到【${fileName}】為有損壓縮格式 (Lossy Audio)。上傳至 Spotify 或 Apple Music 時，串流平台會將音檔重新編碼為 AAC/Ogg，若使用 MP3 將造成【二次壓縮失真 (Double Compression Noise)】，嚴重損害高頻彩度與人聲清晰度。`;
      recommendations.push('請在 DAW (Logic, Ableton, FL Studio, Cubase, Pro Tools) 重新導出 24-bit WAV 或 FLAC 檔案。');
      recommendations.push('若用於 Demo 試聽或 Email 寄送，MP3 方為可行；但正式發行請務必使用無損格式。');
    } else {
      if (bitDepth < 24) {
        status = 'warning';
        title = `⚠️ 位元深度偏低 (${bitDepth}-bit WAV)`;
        desc = `現行上架平台首選為 24-bit PCM，${bitDepth}-bit 動態範圍較小，且可能在聲道微小處殘留量化噪訊 (Quantization Noise)。`;
        recommendations.push('建議將 DAW 導出設定改為 24-bit Uncompressed PCM WAV。');
      }

      if (sampleRate < 44100) {
        status = 'critical';
        title = `⚠️ 取樣率低於標準 (${sampleRate} Hz)`;
        desc = `取樣率必須至少為 44,100 Hz (44.1 kHz)。低於此值會導致嚴重頻域衰減，平台將無法通過上架審核。`;
        recommendations.push('請重新選擇 44.1 kHz 或 48 kHz 導出音檔。');
      }
    }

    return {
      status,
      title,
      desc,
      ext: ext.toUpperCase(),
      isLossless,
      recommendations
    };
  }
}

window.FormatAdvisor = FormatAdvisor;
