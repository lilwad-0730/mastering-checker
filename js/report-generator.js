/**
 * ReportGenerator - Formats HTML and Markdown Mastering QC Reports
 */
class ReportGenerator {
  generateHTMLReport(data) {
    const {
      masterName,
      lufsData,
      maskingData,
      headerInfo,
      formatData,
      grade
    } = data;

    const timestamp = new Date().toLocaleString('zh-TW');

    return `
      <div class="report-container">
        <div class="report-header-banner">
          <h2>SoundMaster QC 獨立音樂人母帶檢查報告</h2>
          <p>產生時間：${timestamp} | 音訊名稱：<strong>${masterName}</strong></p>
          <div class="report-score-pill">母帶品質等級：<span class="badge-grade">${grade}</span></div>
        </div>

        <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">

        <!-- Section 1: LUFS & True Peak -->
        <div class="report-section">
          <h3><i class="fa-solid fa-chart-simple"></i> 1. LUFS 響度與 True Peak 峰值對照</h3>
          <ul>
            <li><strong>Integrated LUFS (平均響度)：</strong> ${lufsData.integratedLUFS} LUFS</li>
            <li><strong>True Peak (4x Oversampling 跨採樣峰值)：</strong> ${lufsData.truePeakDB} dBTP ${lufsData.truePeakDB > -1.0 ? '<span style="color:#ef4444; font-weight:bold;">(⚠️ 超出 -1.0 dBTP 破音門檻)</span>' : '<span style="color:#10b981;">(✓ 安全)</span>'}</li>
            <li><strong>Loudness Range (LRA 動態範圍)：</strong> ${lufsData.lra} LU</li>
          </ul>
          ${lufsData.truePeakDB > -1.0 ? `
            <div style="background:rgba(239,68,68,0.15); border-left:4px solid #ef4444; padding:12px 16px; margin:14px 0; border-radius:4px;">
              <strong style="color:#ff8888;">⚠️ 限制性壓限提醒 (Limiter Warning)：</strong><br>
              您的 True Peak 峰值為 <strong>${lufsData.truePeakDB} dBTP</strong>，已超過 -1.0 dBTP 安全門檻！請在 DAW 的 Master 總軌載入 <strong>Peak Limiter（壓限器）</strong>，將 Ceiling (上限峰值) 壓限制在 <code>-1.0 dBTP</code> 至 <code>-2.0 dBTP</code>，並調整 Out Gain 以避免串流平台轉碼破音。
            </div>
          ` : ''}
          <h4>串流平台過載與懲罰預測：</h4>
          <table class="platform-table" style="margin-top:10px;">
            <thead>
              <tr><th>平台</th><th>目標 LUFS</th><th>您的音檔差值</th><th>預估 Penalty</th></tr>
            </thead>
            <tbody>
              ${lufsData.platformAnalysis.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.targetLUFS} LUFS</td>
                  <td>${p.diffLUFS > 0 ? '+' + p.diffLUFS : p.diffLUFS} LU</td>
                  <td>${p.loudnessPenalty < 0 ? '<span class="badge-penalty-negative">' + p.loudnessPenalty + ' dB</span>' : '<span class="badge-penalty-none">無調整 (0 dB)</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Section 2: Frequency Masking -->
        <div class="report-section" style="margin-top:24px;">
          <h3><i class="fa-solid fa-wave-square"></i> 2. AI 頻率遮蔽與分軌干擾分析</h3>
          <p><strong>母帶渾濁度指數 (250-500Hz)：</strong> ${maskingData.singleMaster.muddinessText}</p>
          ${maskingData.stemConflicts.hasVocal ? `
            <h4>分軌打架警示 (${maskingData.stemConflicts.conflicts.length} 處)：</h4>
            ${maskingData.stemConflicts.conflicts.length === 0 ? '<p style="color:#10b981;">✓ 未發現嚴重人聲與樂器遮蔽衝突。</p>' : `
              <ul>
                ${maskingData.stemConflicts.conflicts.map(c => `
                  <li style="margin-bottom:8px;">
                    <strong style="color:#ef4444;">[${c.band}] ${c.stemName}</strong>: ${c.description}<br>
                    <em>💡 建議：${c.recommendation}</em>
                  </li>
                `).join('')}
              </ul>
            `}
          ` : '<p style="color:#94a3b8;">(未上傳 Stems 分軌檔，已完成單軌母帶渾濁度分析)</p>'}
        </div>

        <!-- Section 3: Sample Rate & Bit Depth -->
        <div class="report-section" style="margin-top:24px;">
          <h3><i class="fa-solid fa-microchip"></i> 3. 取樣率與位元深度檢測</h3>
          <ul>
            <li><strong>取樣率：</strong> ${headerInfo.sampleRate || 44100} Hz ${(headerInfo.sampleRate || 44100) >= 44100 ? '✓ 符合發行門檻' : '⚠️ 低於發行門檻'}</li>
            <li><strong>原始位元深度：</strong> ${headerInfo.bitDepth || 24}-bit ${(headerInfo.bitDepth || 24) >= 24 ? '✓ 24-bit 高品質無損' : '⚠️ 建議升級至 24-bit PCM'}</li>
            <li><strong>編碼模式：</strong> ${headerInfo.audioFormat || 'Linear PCM'}</li>
          </ul>
        </div>

        <!-- Section 4: Format Advisor -->
        <div class="report-section" style="margin-top:24px;">
          <h3><i class="fa-solid fa-file-circle-check"></i> 4. 音檔副檔名與發行管道建議</h3>
          <p><strong>檢測結果：</strong> ${formatData.title}</p>
          <p style="color:#94a3b8;">${formatData.desc}</p>
          ${formatData.recommendations.length > 0 ? `
            <div style="background:rgba(245,158,11,0.1); border-left:3px solid #f59e0b; padding:12px; margin-top:10px; border-radius:4px;">
              <strong>改善步驟建議：</strong>
              <ul>
                ${formatData.recommendations.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Section 5: Phase & Stereo Imager -->
        ${data.phaseData ? `
        <div class="report-section" style="margin-top:24px;">
          <h3><i class="fa-solid fa-circle-nodes"></i> 5. 立體聲相位與單聲道向下相容性 (Ozone Imager)</h3>
          <ul>
            <li><strong>Phase Correlation (相位相關性)：</strong> ${data.phaseData.correlation >= 0 ? '+' : ''}${data.phaseData.correlation} ${data.phaseData.correlation < 0 ? '<span style="color:#ef4444;">(⚠️ 反相/嚴重抵消風險)</span>' : '<span style="color:#10b981;">(✓ 正相良好)</span>'}</li>
            <li><strong>Stereo Width (立體聲旁側寬度比)：</strong> ${data.phaseData.stereoWidth}%</li>
            <li><strong>向下相容診斷：</strong> ${data.phaseData.statusText}</li>
          </ul>
        </div>
        ` : ''}
      </div>
    `;
  }

  generateMarkdownReport(data) {
    const { masterName, lufsData, maskingData, headerInfo, formatData, phaseData, grade } = data;
    return `
# SoundMaster QC 獨立音樂人母帶檢查報告
- **音訊名稱**: ${masterName}
- **母帶品質等級**: ${grade}
- **產生時間**: ${new Date().toLocaleString('zh-TW')}

## 1. LUFS 響度與 True Peak 峰值對照
- **Integrated LUFS**: ${lufsData.integratedLUFS} LUFS
- **True Peak**: ${lufsData.truePeakDB} dBTP ${lufsData.truePeakDB > -1.0 ? '(⚠️ 超出 -1.0 dBTP 門檻！請使用 Limiter 將 Ceiling 限制在 -1.0 dBTP)' : '(✓ 安全)'}
- **Loudness Range**: ${lufsData.lra} LU
${lufsData.truePeakDB > -1.0 ? '> ⚠️ **Limiter 警告**：您的音檔 True Peak 峰值超出 -1.0 dBTP 安全值，請於 DAW 的 Master 總軌載入 Limiter 壓限器並設定 Ceiling ≤ -1.0 dBTP。\n' : ''}

### 串流平台增益懲罰預測:
${lufsData.platformAnalysis.map(p => `- **${p.name}**: 目標 ${p.targetLUFS} LUFS | 預估 Penalty: ${p.loudnessPenalty} dB`).join('\n')}

## 2. 頻率遮蔽與分軌干擾分析
- **渾濁度**: ${maskingData.singleMaster.muddinessText}
${maskingData.stemConflicts.conflicts.map(c => `- **[${c.band}] ${c.stemName}**: ${c.description} (建議: ${c.recommendation})`).join('\n')}

## 3. 取樣率與位元深度檢測
- **取樣率**: ${headerInfo.sampleRate || 44100} Hz
- **位元深度**: ${headerInfo.bitDepth || 24}-bit

## 4. 副檔名與發行建議
- **狀態**: ${formatData.title}
- **建議**: ${formatData.recommendations.join(' / ') || '規格完全正常'}

## 5. 立體聲相位與 Ozone Imager 診斷
- **Phase Correlation**: ${phaseData ? phaseData.correlation : 1.0}
- **Stereo Width**: ${phaseData ? phaseData.stereoWidth : 0}%
- **相容性結論**: ${phaseData ? phaseData.statusText : '純單聲道'}
    `.trim();
  }
}

window.ReportGenerator = ReportGenerator;
