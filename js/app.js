/**
 * App.js - Main Controller for SoundMaster PRO
 */
document.addEventListener('DOMContentLoaded', () => {
  // Engines & Utilities
  const lufsEngine = new LUFSEngine();
  const maskingEngine = new MaskingEngine();
  const phaseEngine = new PhaseEngine();
  const keyEngine = new KeyEngine();
  const headerParser = new HeaderParser();
  const formatAdvisor = new FormatAdvisor();
  const audioDecoder = new AudioDecoder();
  const reportGenerator = new ReportGenerator();

  // State Management
  let loadedFiles = []; // Array of { id, file, name, buffer, headerInfo, type }
  let activeMasterIndex = -1;
  let currentAudioSource = null;
  let isPlaying = false;
  let playbackStartTime = 0;
  let currentAnalysisData = null;

  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const audioInput = document.getElementById('audio-input');
  const fileListContainer = document.getElementById('file-list');
  const fileCountBadge = document.getElementById('file-count');
  const stemsAssignmentPanel = document.getElementById('stems-assignment-panel');
  const stemsMappingList = document.getElementById('stems-mapping-list');

  const uploadProgressContainer = document.getElementById('upload-progress-container');
  const progressLabel = document.getElementById('progress-label');
  const progressPercent = document.getElementById('progress-percent');
  const uploadProgressFill = document.getElementById('upload-progress-fill');

  function updateProgress(percent, text) {
    if (!uploadProgressContainer) return;
    if (percent < 100) {
      uploadProgressContainer.classList.remove('hidden');
    }
    progressPercent.textContent = Math.round(percent) + '%';
    uploadProgressFill.style.width = percent + '%';
    if (text) progressLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
    if (percent >= 100) {
      setTimeout(() => {
        uploadProgressContainer.classList.add('hidden');
        uploadProgressFill.style.width = '0%';
      }, 600);
    }
  }

  const btnAnalyze = document.getElementById('btn-analyze');
  const btnAnalyzeAll = document.getElementById('btn-analyze-all');
  const btnLoadDemo = document.getElementById('btn-load-demo');
  const btnExportReport = document.getElementById('btn-export-report');

  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const statusFiles = document.getElementById('status-files');
  const statusGrade = document.getElementById('status-grade');

  const btnPlay = document.getElementById('btn-play');
  const currentTrackName = document.getElementById('current-track-name');
  const currentTrackMeta = document.getElementById('current-track-meta');
  const timeDisplay = document.getElementById('time-display');
  const waveformCanvas = document.getElementById('waveform-canvas');
  const spectrumCanvas = document.getElementById('spectrum-canvas');

  const valIntegratedLUFS = document.getElementById('val-integrated-lufs');
  const valTruePeak = document.getElementById('val-true-peak');
  const valLRA = document.getElementById('val-lra');
  const valShortTermLUFS = document.getElementById('val-shortterm-lufs');

  const barIntegratedLUFS = document.getElementById('bar-integrated-lufs');
  const barTruePeak = document.getElementById('bar-true-peak');
  const barLRA = document.getElementById('bar-lra');
  const barShortTermLUFS = document.getElementById('bar-shortterm-lufs');

  const platformMatrixBody = document.getElementById('platform-matrix-body');
  const muddinessResult = document.getElementById('muddiness-result');
  const stemConflictResult = document.getElementById('stem-conflict-result');

  const specSampleRate = document.getElementById('spec-sample-rate');
  const specSampleRateStatus = document.getElementById('spec-sample-rate-status');
  const specBitDepth = document.getElementById('spec-bit-depth');
  const specBitDepthStatus = document.getElementById('spec-bit-depth-status');
  const specChannels = document.getElementById('spec-channels');
  const specChannelsStatus = document.getElementById('spec-channels-status');
  const specDuration = document.getElementById('spec-duration');

  const formatBanner = document.getElementById('format-advisor-banner');
  const formatTitle = document.getElementById('format-detected-title');
  const formatDesc = document.getElementById('format-detected-desc');

  const reportModal = document.getElementById('report-modal');
  const reportBody = document.getElementById('report-body');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnPrintReport = document.getElementById('btn-print-report');
  const btnCopyMarkdown = document.getElementById('btn-copy-markdown');

  // Tab Switching Logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetContent = document.getElementById(btn.dataset.tab);
      if (targetContent) targetContent.classList.add('active');

      // Update button text to reflect active tab name
      const activeTabName = btn.textContent.trim();
      btnAnalyze.innerHTML = `<i class="fa-solid fa-play"></i> 檢測「${activeTabName}」`;

      // Force Canvas redraw when switching tabs so clientWidth is non-zero
      setTimeout(() => {
        if (btn.dataset.tab === 'tab-phase') {
          drawPhaseGoniometer(currentAnalysisData && currentAnalysisData.phaseData ? currentAnalysisData.phaseData.polarPoints : []);
        } else if (btn.dataset.tab === 'tab-masking') {
          drawSpectrum(currentAnalysisData && currentAnalysisData.maskingData ? currentAnalysisData.maskingData.singleMaster.bandPercentages : {});
        } else if (btn.dataset.tab === 'tab-lufs' && activeMasterIndex >= 0 && loadedFiles[activeMasterIndex]) {
          drawWaveform(loadedFiles[activeMasterIndex].buffer);
        } else if (btn.dataset.tab === 'tab-key' && currentAnalysisData && currentAnalysisData.keyData) {
          drawChromagram(currentAnalysisData.keyData.chromagram, currentAnalysisData.keyData.pitchNames);
        }
      }, 50);
    });
  });

  // Drag & Drop Handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      await handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  });

  audioInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleFilesAdded(Array.from(e.target.files));
    }
  });

  // Process Added Files
  async function handleFilesAdded(files) {
    const totalFiles = files.length;
    let completed = 0;
    updateProgress(5, `開始載入 ${totalFiles} 個音檔...`);

    for (const file of files) {
      const id = 'file_' + Math.random().toString(36).substring(2, 9);
      updateProgress(10 + (completed / totalFiles) * 80, `正在解碼音訊 ${file.name}...`);

      const headerInfo = await headerParser.parseHeader(file);
      const buffer = await audioDecoder.decodeFile(file);

      // Infer stem type from filename
      let type = 'master';
      const nameLower = file.name.toLowerCase();
      if (nameLower.includes('vocal') || nameLower.includes('vox')) type = 'vocal';
      else if (nameLower.includes('bass')) type = 'bass';
      else if (nameLower.includes('drum') || nameLower.includes('kick')) type = 'drums';
      else if (nameLower.includes('synth') || nameLower.includes('guitar')) type = 'synth';
      else if (nameLower.includes('stem')) type = 'other';

      loadedFiles.push({ id, file, name: file.name, buffer, headerInfo, type });
      completed++;
    }

    updateProgress(100, `全部 ${totalFiles} 個音軌載入解碼完成！`);
    updateFileListUI();
  }

  // Update File List UI & Stems Panel
  function updateFileListUI() {
    fileCountBadge.textContent = loadedFiles.length;

    if (loadedFiles.length === 0) {
      fileListContainer.innerHTML = '<h4><i class="fa-solid fa-list-check"></i> 已載入音軌 (0)</h4><div class="empty-state">尚無載入檔案，請拖放音檔或點擊上傳</div>';
      stemsAssignmentPanel.classList.add('hidden');
      btnAnalyze.disabled = true;
      return;
    }

    fileListContainer.innerHTML = '<h4><i class="fa-solid fa-list-check"></i> 已載入音軌 (' + loadedFiles.length + ')</h4><div class="file-list" id="file-list-inner"></div>';
    const innerList = document.getElementById('file-list-inner');

    loadedFiles.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `
        <span class="file-item-name"><i class="fa-solid fa-music"></i> ${item.name}</span>
        <span class="file-item-remove" data-index="${index}"><i class="fa-solid fa-trash"></i></span>
      `;
      innerList.appendChild(row);
    });

    // Remove file event
    document.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        loadedFiles.splice(idx, 1);
        updateFileListUI();
      });
    });

    // Render Stems Assignment if 2+ files
    if (loadedFiles.length >= 2) {
      stemsAssignmentPanel.classList.remove('hidden');
      stemsMappingList.innerHTML = '';
      loadedFiles.forEach((item, index) => {
        const mapRow = document.createElement('div');
        mapRow.className = 'stems-mapping-row';
        mapRow.innerHTML = `
          <span style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;" title="${item.name}">${item.name}</span>
          <select class="stem-select" data-index="${index}">
            <option value="master" ${item.type === 'master' ? 'selected' : ''}>Full Master (整曲)</option>
            <option value="vocal" ${item.type === 'vocal' ? 'selected' : ''}>Vocal (人聲分軌)</option>
            <option value="bass" ${item.type === 'bass' ? 'selected' : ''}>Bass (低音分軌)</option>
            <option value="drums" ${item.type === 'drums' ? 'selected' : ''}>Drums (鼓組分軌)</option>
            <option value="synth" ${item.type === 'synth' ? 'selected' : ''}>Synth / Guitar (樂器分軌)</option>
            <option value="other" ${item.type === 'other' ? 'selected' : ''}>Other (其他分軌)</option>
          </select>
        `;
        stemsMappingList.appendChild(mapRow);
      });

      document.querySelectorAll('.stem-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.index);
          loadedFiles[idx].type = e.target.value;
        });
      });
    } else {
      stemsAssignmentPanel.classList.add('hidden');
    }

    // Enable analysis buttons
    btnAnalyze.disabled = false;
    btnAnalyzeAll.disabled = false;
  }

  // Load Demo Audio
  btnLoadDemo.addEventListener('click', async () => {
    btnLoadDemo.disabled = true;
    btnLoadDemo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 合成示範音訊中...';

    updateProgress(20, '正在合成母帶與 Stems 示範音訊...');
    const demoData = await audioDecoder.generateDemoMasterAndStems();
    updateProgress(70, '解碼合成音訊 Buffer...');

    loadedFiles = [
      { id: 'demo_m', file: { name: demoData.master.name }, name: demoData.master.name, buffer: demoData.master.buffer, headerInfo: demoData.master.headerInfo, type: 'master' },
      ...demoData.stems.map(s => ({
        id: 'demo_' + s.type,
        file: { name: s.name },
        name: s.name,
        buffer: s.buffer,
        headerInfo: s.headerInfo,
        type: s.type
      }))
    ];

    updateProgress(100, '示範音訊載入完成！');
    updateFileListUI();
    btnLoadDemo.disabled = false;
    btnLoadDemo.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 載入示範母帶與分軌';
    
    // Auto Trigger Scan All Analysis
    btnAnalyzeAll.click();
  });

  const dspProgressContainer = document.getElementById('dsp-progress-container');
  const dspProgressLabel = document.getElementById('dsp-progress-label');
  const dspProgressPercent = document.getElementById('dsp-progress-percent');
  const dspProgressFill = document.getElementById('dsp-progress-fill');
  const dspTimeEstimate = document.getElementById('dsp-time-estimate');

  const yieldThread = (ms = 15) => new Promise(resolve => setTimeout(resolve, ms));

  function updateDSPProgress(percent, labelText, timeEst) {
    if (!dspProgressContainer) return;
    if (percent < 100) {
      dspProgressContainer.classList.remove('hidden');
    }
    dspProgressPercent.textContent = Math.round(percent) + '%';
    dspProgressFill.style.width = percent + '%';
    if (labelText) dspProgressLabel.innerHTML = `<i class="fa-solid fa-gear fa-spin"></i> ${labelText}`;
    if (timeEst) dspTimeEstimate.textContent = `預估剩餘時間：${timeEst}`;

    if (percent >= 100) {
      setTimeout(() => {
        dspProgressContainer.classList.add('hidden');
        dspProgressFill.style.width = '0%';
      }, 400);
    }
  }

  // 1. Modular On-Demand Single-Tab Analysis
  btnAnalyze.addEventListener('click', async () => {
    if (loadedFiles.length === 0) return;

    const activeTab = document.querySelector('.tab-btn.active');
    const tabId = activeTab ? activeTab.dataset.tab : 'tab-lufs';
    const tabName = activeTab ? activeTab.textContent.trim() : '目前項目';

    btnAnalyze.disabled = true;
    btnAnalyzeAll.disabled = true;

    const masterTrack = loadedFiles.find(f => f.type === 'master') || loadedFiles[0];
    activeMasterIndex = loadedFiles.indexOf(masterTrack);

    if (!currentAnalysisData) {
      currentAnalysisData = {
        masterName: masterTrack.name,
        lufsData: null,
        maskingData: { singleMaster: null, stemConflicts: null },
        headerInfo: masterTrack.headerInfo,
        formatData: null,
        phaseData: null,
        keyData: null,
        grade: '--'
      };
    }

    if (tabId === 'tab-lufs') {
      updateDSPProgress(40, '正在計算 EBU R128 LUFS & 4x True Peak...', '極速分析中');
      await yieldThread(15);
      currentAnalysisData.lufsData = await lufsEngine.analyzeAudioBuffer(masterTrack.buffer);
    } else if (tabId === 'tab-masking') {
      updateDSPProgress(50, '正在分析 20Hz-20kHz 頻譜與分軌干擾...', '極速分析中');
      await yieldThread(15);
      const singleSpectrum = maskingEngine.analyzeSpectrum(masterTrack.buffer);
      const stemConflicts = maskingEngine.analyzeStemConflicts(loadedFiles.map(f => ({ name: f.name, type: f.type, audioBuffer: f.buffer })));
      currentAnalysisData.maskingData = { singleMaster: singleSpectrum, stemConflicts };
    } else if (tabId === 'tab-specs') {
      updateDSPProgress(60, '正在解析採樣率與位元深度...', '極速分析中');
      await yieldThread(10);
      currentAnalysisData.headerInfo = masterTrack.headerInfo;
    } else if (tabId === 'tab-format') {
      updateDSPProgress(60, '正在比對發行管道與副檔名...', '極速分析中');
      await yieldThread(10);
      currentAnalysisData.formatData = formatAdvisor.evaluateFormat(masterTrack.name, masterTrack.headerInfo, masterTrack.buffer);
    } else if (tabId === 'tab-phase') {
      updateDSPProgress(70, '正在計算極座標相位與 Ozone 聲相圖...', '極速分析中');
      await yieldThread(15);
      currentAnalysisData.phaseData = phaseEngine.analyzePhase(masterTrack.buffer);
    } else if (tabId === 'tab-key') {
      updateDSPProgress(70, '正在計算 Chromagram 12音級與歌曲調性...', '極速分析中');
      await yieldThread(20);
      currentAnalysisData.keyData = keyEngine.analyzeKey(masterTrack.buffer);
    }

    updateDSPProgress(100, `「${tabName}」單項檢測完成！`, '完成');

    renderAnalysisResults(currentAnalysisData, masterTrack.buffer);

    btnAnalyze.disabled = false;
    btnAnalyzeAll.disabled = false;
    btnExportReport.disabled = false;
    btnPlay.disabled = false;
    statusBanner.classList.remove('hidden');
    statusText.textContent = `已完成：${tabName}`;
  });

  // 2. Full Sweep Scan-All Analysis
  btnAnalyzeAll.addEventListener('click', async () => {
    if (loadedFiles.length === 0) return;

    btnAnalyze.disabled = true;
    btnAnalyzeAll.disabled = true;

    const masterTrack = loadedFiles.find(f => f.type === 'master') || loadedFiles[0];
    activeMasterIndex = loadedFiles.indexOf(masterTrack);

    updateDSPProgress(15, '1/6 正在計算 EBU R128 LUFS & 4x True Peak...', '< 0.1秒');
    await yieldThread(15);
    const lufsData = await lufsEngine.analyzeAudioBuffer(masterTrack.buffer);

    updateDSPProgress(35, '2/6 正在分析 20Hz-20kHz 頻譜與分軌干擾...', '< 0.1秒');
    await yieldThread(15);
    const singleSpectrum = maskingEngine.analyzeSpectrum(masterTrack.buffer);
    const stemConflicts = maskingEngine.analyzeStemConflicts(loadedFiles.map(f => ({ name: f.name, type: f.type, audioBuffer: f.buffer })));

    updateDSPProgress(55, '3/6 正在計算極座標相位與 Ozone 聲相圖...', '< 0.1秒');
    await yieldThread(15);
    const phaseData = phaseEngine.analyzePhase(masterTrack.buffer);

    updateDSPProgress(75, '4/6 正在進行 Krumhansl Chromagram 歌曲調性分析...', '< 0.1秒');
    await yieldThread(15);
    const keyData = keyEngine.analyzeKey(masterTrack.buffer);

    updateDSPProgress(90, '5/6 正在解析採樣率與位元深度...', '< 0.1秒');
    await yieldThread(10);
    const headerInfo = masterTrack.headerInfo;

    updateDSPProgress(98, '6/6 正在比對發行管道建議與產生報告...', '即將完成');
    await yieldThread(10);
    const formatData = formatAdvisor.evaluateFormat(masterTrack.name, headerInfo, masterTrack.buffer);

    let grade = 'A+';
    if (lufsData.truePeakDB > -1.0 || formatData.status === 'critical' || singleSpectrum.muddinessStatus === 'critical' || phaseData.status === 'critical') grade = 'C';
    else if (lufsData.integratedLUFS > -10.0 || singleSpectrum.muddinessStatus === 'warning' || phaseData.status === 'warning') grade = 'B';
    else if (lufsData.integratedLUFS <= -12.0 && lufsData.truePeakDB <= -1.0) grade = 'A';

    currentAnalysisData = {
      masterName: masterTrack.name,
      lufsData,
      maskingData: { singleMaster: singleSpectrum, stemConflicts },
      headerInfo,
      formatData,
      phaseData,
      keyData,
      grade
    };

    updateDSPProgress(100, '母帶全項目 DSP 掃描全數完成！', '完成');

    renderAnalysisResults(currentAnalysisData, masterTrack.buffer);

    btnAnalyze.disabled = false;
    btnAnalyzeAll.disabled = false;
    btnExportReport.disabled = false;
    btnPlay.disabled = false;

    statusBanner.classList.remove('hidden');
    statusText.textContent = '全項目檢測完成';
    statusFiles.textContent = loadedFiles.length + ' 軌已分析';
    statusGrade.textContent = grade;
  });

  // Render UI Results
  function renderAnalysisResults(data, audioBuffer) {
    const { lufsData, maskingData, headerInfo, formatData } = data;

    // 1. Gauges
    valIntegratedLUFS.innerHTML = `${lufsData.integratedLUFS} <span>LUFS</span>`;
    valTruePeak.innerHTML = `${lufsData.truePeakDB} <span>dBTP</span>`;
    valLRA.innerHTML = `${lufsData.lra} <span>LU</span>`;
    valShortTermLUFS.innerHTML = `${lufsData.maxShortTermLUFS} <span>LUFS</span>`;

    // Progress Bar Fills
    barIntegratedLUFS.style.width = Math.min(100, Math.max(0, (lufsData.integratedLUFS + 30) * 2.5)) + '%';
    barTruePeak.style.width = Math.min(100, Math.max(0, (lufsData.truePeakDB + 20) * 5)) + '%';
    barLRA.style.width = Math.min(100, lufsData.lra * 5) + '%';
    barShortTermLUFS.style.width = Math.min(100, Math.max(0, (lufsData.maxShortTermLUFS + 30) * 2.5)) + '%';

    // Highlight Peak exceed & True Peak Limiter Warning
    const truePeakAlertBanner = document.getElementById('true-peak-alert-banner');
    const truePeakAlertDesc = document.getElementById('true-peak-alert-desc');
    const subtitleTruePeak = document.getElementById('subtitle-true-peak');

    if (lufsData.truePeakDB > -1.0) {
      valTruePeak.style.color = '#ef4444';
      if (subtitleTruePeak) subtitleTruePeak.innerHTML = '<span style="color:#ef4444; font-weight:700;">⚠️ 峰值過載！請使用 Limiter 壓限</span>';
      if (truePeakAlertBanner && truePeakAlertDesc) {
        truePeakAlertDesc.innerHTML = `檢測到 True Peak 峰值高達 <strong>${lufsData.truePeakDB} dBTP</strong>（超過 Spotify / Apple Music 之 <strong>-1.0 dBTP</strong> 安全門檻 ${ (lufsData.truePeakDB - (-1.0)).toFixed(2) } dB）。此狀況極易在串流平台數位解碼時造成 <strong>Inter-sample Clipping（跨採樣破音失真）</strong>！`;
        truePeakAlertBanner.classList.remove('hidden');
      }
    } else {
      valTruePeak.style.color = '#10b981';
      if (subtitleTruePeak) subtitleTruePeak.innerHTML = '4x Oversampling 跨採樣峰值 (安全)';
      if (truePeakAlertBanner) truePeakAlertBanner.classList.add('hidden');
    }

    // Platform Matrix Table
    platformMatrixBody.innerHTML = lufsData.platformAnalysis.map(p => `
      <tr>
        <td><i class="${p.icon}"></i> <strong>${p.name}</strong></td>
        <td>${p.targetLUFS} LUFS</td>
        <td>${p.maxTruePeak} dBTP</td>
        <td>${lufsData.integratedLUFS} LUFS / ${lufsData.truePeakDB} dBTP</td>
        <td>${p.loudnessPenalty < 0 ? '<span class="badge-penalty-negative">' + p.loudnessPenalty + ' dB</span>' : '<span class="badge-penalty-none">0 dB</span>'}</td>
        <td>${p.truePeakExceeded ? '<span class="badge-warn" style="color:#ef4444;">⚠️ 破音風險（請用 Limiter 限制峰值 ≤ ' + p.maxTruePeak + ' dBTP）</span>' : '<span class="badge-pass">✓ 相容安全</span>'}</td>
      </tr>
    `).join('');

    // 2. Frequency Masking Results
    const singleSpectrum = maskingData.singleMaster;
    muddinessResult.innerHTML = `
      <p style="margin-bottom:8px;"><strong>中低頻 (250-500Hz) 渾濁積聚率：</strong> <span class="badge" style="font-size:0.85rem;">${singleSpectrum.mudRatio}%</span></p>
      <p style="color: ${singleSpectrum.muddinessStatus === 'critical' ? '#ef4444' : '#10b981'}; font-weight:600;">${singleSpectrum.muddinessText}</p>
    `;

    const stemConflicts = maskingData.stemConflicts;
    if (!stemConflicts.hasVocal) {
      stemConflictResult.innerHTML = `<p class="sub-text">${stemConflicts.summaryText}</p>`;
    } else {
      if (stemConflicts.conflicts.length === 0) {
        stemConflictResult.innerHTML = `<p style="color:#10b981; font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${stemConflicts.summaryText}</p>`;
      } else {
        stemConflictResult.innerHTML = `
          <p style="color:#ef4444; font-weight:600; margin-bottom:10px;">${stemConflicts.summaryText}</p>
          ${stemConflicts.conflicts.map(c => `
            <div style="background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:10px; margin-bottom:8px; border-radius:4px;">
              <div class="conflict-tag">${c.band} 衝突</div>
              <p><strong>${c.stemName}</strong>: ${c.description}</p>
              <p style="color:#00f0ff; margin-top:4px; font-size:0.78rem;">💡 ${c.recommendation}</p>
            </div>
          `).join('')}
        `;
      }
    }

    // 3. Audio Specs Inspector
    specSampleRate.textContent = (headerInfo.sampleRate || audioBuffer.sampleRate) + ' Hz';
    specSampleRateStatus.textContent = (headerInfo.sampleRate || audioBuffer.sampleRate) >= 44100 ? '✓ 符合發行標準' : '⚠️ 低於標準';
    specSampleRateStatus.className = (headerInfo.sampleRate || audioBuffer.sampleRate) >= 44100 ? 'specs-card-status text-green' : 'specs-card-status text-red';

    specBitDepth.textContent = (headerInfo.bitDepth || 24) + '-bit';
    specBitDepthStatus.textContent = (headerInfo.bitDepth || 24) >= 24 ? '✓ 24-bit 高品質' : '⚠️ 建議 24-bit';

    specChannels.textContent = audioBuffer.numberOfChannels === 2 ? 'Stereo (立體聲)' : 'Mono (單聲道)';
    specChannelsStatus.textContent = '✓ 規格正常';

    const durSec = Math.floor(audioBuffer.duration);
    const mins = Math.floor(durSec / 60);
    const secs = (durSec % 60).toString().padStart(2, '0');
    specDuration.textContent = `${mins}:${secs}`;

    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
      timeDisplay.textContent = `00:00 / ${formatTime(audioBuffer.duration)}`;
    }
    if (currentTrackName && activeMasterIndex >= 0 && loadedFiles[activeMasterIndex]) {
      currentTrackName.textContent = loadedFiles[activeMasterIndex].name;
    }
    if (currentTrackMeta) {
      currentTrackMeta.textContent = `${headerInfo.sampleRate || audioBuffer.sampleRate} Hz / ${headerInfo.bitDepth || 24}-bit`;
    }

    // 4. Format Advisor Banner
    if (formatData.status === 'critical') {
      formatBanner.className = 'format-advisor-banner warning-card';
    } else {
      formatBanner.className = 'format-advisor-banner pass-card';
    }
    formatTitle.textContent = formatData.title;
    formatDesc.textContent = formatData.desc;

    // 5. Phase Analysis UI Updates
    const phaseData = data.phaseData;
    if (phaseData) {
      const valPhaseCorr = document.getElementById('val-phase-corr');
      const barPhaseCorr = document.getElementById('bar-phase-corr');
      const valStereoWidth = document.getElementById('val-stereo-width');
      const barStereoWidth = document.getElementById('bar-stereo-width');
      const phaseAlertBanner = document.getElementById('phase-alert-banner');
      const phaseAlertDesc = document.getElementById('phase-alert-desc');

      if (valPhaseCorr) {
        valPhaseCorr.textContent = (phaseData.correlation >= 0 ? '+' : '') + phaseData.correlation.toFixed(2);
        valPhaseCorr.style.color = phaseData.correlation < 0 ? '#ef4444' : phaseData.correlation < 0.3 ? '#f59e0b' : '#10b981';
        barPhaseCorr.style.width = Math.min(100, Math.max(0, ((phaseData.correlation + 1) / 2) * 100)) + '%';
      }

      if (valStereoWidth) {
        valStereoWidth.textContent = phaseData.stereoWidth + ' %';
        barStereoWidth.style.width = phaseData.stereoWidth + '%';
      }

      if (phaseAlertBanner && phaseAlertDesc) {
        if (phaseData.status === 'critical' || phaseData.status === 'warning') {
          phaseAlertBanner.classList.remove('hidden');
          phaseAlertDesc.textContent = phaseData.statusText;
        } else {
          phaseAlertBanner.classList.add('hidden');
        }
      }
    }

    // 6. Song Key & Scale Analysis UI Updates
    const keyData = data.keyData;
    if (keyData) {
      const valDetectedKey = document.getElementById('val-detected-key');
      const valKeyConfidence = document.getElementById('val-key-confidence');
      const valCamelotCode = document.getElementById('val-camelot-code');
      const valRelativeKey = document.getElementById('val-relative-key');

      if (valDetectedKey) valDetectedKey.textContent = keyData.detectedKey;
      if (valKeyConfidence) valKeyConfidence.textContent = `演算法信心度：${keyData.confidence} %`;
      if (valCamelotCode) valCamelotCode.textContent = keyData.camelotCode;
      if (valRelativeKey) valRelativeKey.textContent = keyData.relativeKey;

      if (keyData.chromagram && keyData.pitchNames) {
        drawChromagram(keyData.chromagram, keyData.pitchNames);
      }
    }

    // Render Canvas Waveform, Spectrum & Ozone Imager Phase Goniometer
    drawWaveform(audioBuffer);
    if (singleSpectrum) drawSpectrum(singleSpectrum.bandPercentages);
    if (phaseData && phaseData.polarPoints) {
      drawPhaseGoniometer(phaseData.polarPoints);
    }
  }

  // Format seconds to mm:ss
  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '00:00';
    const totalSec = Math.floor(sec);
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m.toString().padStart(2, '0')}:${s}`;
  }

  // Draw Waveform Canvas with Progress Playhead Overlay
  function drawWaveform(audioBuffer, progressRatio = 0) {
    if (!waveformCanvas || !audioBuffer) return;
    const ctx = waveformCanvas.getContext('2d');
    const containerWidth = (waveformCanvas.parentElement && waveformCanvas.parentElement.clientWidth > 0) ? waveformCanvas.parentElement.clientWidth : 720;
    const width = waveformCanvas.width = containerWidth;
    const height = waveformCanvas.height = 90;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);

    ctx.clearRect(0, 0, width, height);

    const amp = height / 2;
    const playheadX = Math.floor(width * progressRatio);

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      // Color coding: Played part = Emerald (#10b981), Unplayed = Cyan (#00f0ff)
      if (i <= playheadX && playheadX > 0) {
        ctx.fillStyle = '#10b981';
      } else {
        ctx.fillStyle = '#00f0ff';
      }

      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw Vertical Playhead Line & Glowing Cap
    if (playheadX > 0 && playheadX < width) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playheadX - 1, 0, 2, height);
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(playheadX, height / 2, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // Draw Spectrum Canvas
  function drawSpectrum(bandPercentages) {
    const ctx = spectrumCanvas.getContext('2d');
    const width = spectrumCanvas.width = spectrumCanvas.parentElement.clientWidth;
    const height = spectrumCanvas.height = 220;

    ctx.clearRect(0, 0, width, height);

    const bands = [
      { id: 'sub', label: 'Sub (20-60Hz)', color: '#3b82f6' },
      { id: 'bass', label: 'Bass (60-250Hz)', color: '#00f0ff' },
      { id: 'mud', label: 'Mud (250-500Hz)', color: '#f59e0b' },
      { id: 'mid', label: 'Mid (500-2kHz)', color: '#10b981' },
      { id: 'vocal', label: 'Vocal (2k-6kHz)', color: '#ef4444' },
      { id: 'air', label: 'Air (6k-20kHz)', color: '#8b5cf6' }
    ];

    const barWidth = (width - 40) / bands.length;
    bands.forEach((b, i) => {
      const pct = bandPercentages[b.id] || 0;
      const barHeight = (pct / 50) * (height - 60);
      const x = 20 + i * barWidth;
      const y = height - 30 - barHeight;

      // Bar fill
      ctx.fillStyle = b.color;
      ctx.fillRect(x + 10, y, barWidth - 20, barHeight);

      // Label text
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, x + barWidth / 2, height - 10);
      ctx.fillText(pct + '%', x + barWidth / 2, y - 6);
    });
  }

  // Draw Semicircular Ozone Imager Polar Goniometer Canvas
  function drawPhaseGoniometer(polarPoints) {
    const phaseCanvas = document.getElementById('phase-canvas');
    if (!phaseCanvas) return;

    const ctx = phaseCanvas.getContext('2d');
    const containerWidth = (phaseCanvas.parentElement && phaseCanvas.parentElement.clientWidth > 0) ? phaseCanvas.parentElement.clientWidth : 720;
    const width = phaseCanvas.width = containerWidth;
    const height = phaseCanvas.height = 260;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height - 30;
    const radius = Math.min(width / 2 - 40, height - 50);

    // 1. Draw Semicircular Polar Grid & Arc
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;

    // Grid concentric arcs (25%, 50%, 75%, 100%)
    [0.25, 0.5, 0.75, 1.0].forEach(rPct => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * rPct, Math.PI, 2 * Math.PI, false);
      ctx.stroke();
    });

    // Polar Ray lines (-90° Left, -45°, 0° Mid, +45°, +90° Right)
    const angles = [
      { angle: -Math.PI / 2, label: 'L (-1)' },
      { angle: -Math.PI / 4, label: 'L-Mid' },
      { angle: 0, label: 'MONO / M (0)' },
      { angle: Math.PI / 4, label: 'R-Mid' },
      { angle: Math.PI / 2, label: 'R (+1)' }
    ];

    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';

    angles.forEach(a => {
      const x = centerX + Math.sin(a.angle) * radius;
      const y = centerY - Math.cos(a.angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = a.angle === 0 ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();

      const labelX = centerX + Math.sin(a.angle) * (radius + 18);
      const labelY = centerY - Math.cos(a.angle) * (radius + 18);
      ctx.fillText(a.label, labelX, labelY);
    });

    // Outer Semicircle Arc Line
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Draw Polar Vector Cloud (Ozone Imager style dots/rays) in Batched Draws
    if (!polarPoints || polarPoints.length === 0) return;

    const colorStyles = [
      'rgba(16, 185, 129, 0.7)',  // 0: Green (Mono / In-phase)
      'rgba(0, 240, 255, 0.6)',   // 1: Cyan (Stereo Wide)
      'rgba(239, 68, 68, 0.75)'   // 2: Red (Out-of-phase)
    ];

    for (let cType = 0; cType < 3; cType++) {
      ctx.beginPath();
      let count = 0;

      for (let i = 0; i < polarPoints.length; i++) {
        const pt = polarPoints[i];
        if (pt.colorType === cType) {
          const ptRadius = Math.min(radius, pt.radius * radius * 1.5);
          const px = centerX + Math.sin(pt.angle) * ptRadius;
          const py = centerY - Math.cos(pt.angle) * ptRadius;

          ctx.moveTo(px + 2, py);
          ctx.arc(px, py, 2, 0, 2 * Math.PI);
          count++;
        }
      }

      if (count > 0) {
        ctx.fillStyle = colorStyles[cType];
        ctx.fill();
      }
    }

    // 3. Center Glow Origin Dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#00f0ff';
    ctx.fill();
  }

  // Draw 12 Pitch Classes Chromagram Canvas
  function drawChromagram(chromaValues, pitchNames) {
    const chromaCanvas = document.getElementById('chroma-canvas');
    if (!chromaCanvas) return;

    const ctx = chromaCanvas.getContext('2d');
    const containerWidth = (chromaCanvas.parentElement && chromaCanvas.parentElement.clientWidth > 0) ? chromaCanvas.parentElement.clientWidth : 720;
    const width = chromaCanvas.width = containerWidth;
    const height = chromaCanvas.height = 200;

    ctx.clearRect(0, 0, width, height);

    if (!chromaValues || chromaValues.length < 12) return;

    const colors = ['#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#00f0ff', '#3b82f6', '#6366f1', '#a855f7', '#d946ef'];
    const barWidth = (width - 40) / 12;

    chromaValues.forEach((val, i) => {
      const barHeight = val * (height - 60);
      const x = 20 + i * barWidth;
      const y = height - 30 - barHeight;

      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x + 4, y, barWidth - 8, barHeight);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(pitchNames[i] || i, x + barWidth / 2, height - 10);
      ctx.fillText(Math.round(val * 100) + '%', x + barWidth / 2, y - 6);
    });
  }

  // Real-time Interactive Audio Playback Engine
  let playbackStartCtxTime = 0;
  let currentSeekTime = 0;
  let playbackAnimFrame = null;

  function updatePlaybackUI() {
    if (!isPlaying || activeMasterIndex < 0 || !loadedFiles[activeMasterIndex]) return;

    const buffer = loadedFiles[activeMasterIndex].buffer;
    const duration = buffer.duration;
    const elapsed = currentSeekTime + (audioDecoder.audioCtx.currentTime - playbackStartCtxTime);

    if (elapsed >= duration) {
      stopPlayback();
      return;
    }

    const progressRatio = Math.min(1.0, elapsed / duration);

    // Update Seconds Display: 01:23 / 03:45
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
      timeDisplay.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
    }

    // Update Waveform Scrubber Range Slider
    const scrubber = document.getElementById('waveform-scrubber');
    if (scrubber) {
      scrubber.value = (progressRatio * 100).toFixed(1);
    }

    // Redraw Waveform with Progress Highlight
    drawWaveform(buffer, progressRatio);

    playbackAnimFrame = requestAnimationFrame(updatePlaybackUI);
  }

  function startPlaybackAt(seekTime = 0) {
    if (activeMasterIndex < 0 || !loadedFiles[activeMasterIndex]) return;

    if (currentAudioSource) {
      try { currentAudioSource.stop(); } catch (e) {}
      currentAudioSource = null;
    }
    if (playbackAnimFrame) {
      cancelAnimationFrame(playbackAnimFrame);
      playbackAnimFrame = null;
    }

    const buffer = loadedFiles[activeMasterIndex].buffer;
    const duration = buffer.duration;
    currentSeekTime = Math.max(0, Math.min(duration, seekTime));

    if (audioDecoder.audioCtx.state === 'suspended') {
      audioDecoder.audioCtx.resume();
    }

    currentAudioSource = audioDecoder.audioCtx.createBufferSource();
    currentAudioSource.buffer = buffer;
    currentAudioSource.connect(audioDecoder.audioCtx.destination);
    currentAudioSource.start(0, currentSeekTime);

    playbackStartCtxTime = audioDecoder.audioCtx.currentTime;
    isPlaying = true;
    btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
    currentTrackName.textContent = loadedFiles[activeMasterIndex].name;

    currentAudioSource.onended = () => {
      const elapsed = currentSeekTime + (audioDecoder.audioCtx.currentTime - playbackStartCtxTime);
      if (elapsed >= duration - 0.2) {
        stopPlayback();
      }
    };

    updatePlaybackUI();
  }

  function stopPlayback() {
    if (currentAudioSource) {
      try { currentAudioSource.stop(); } catch (e) {}
      currentAudioSource = null;
    }
    if (playbackAnimFrame) {
      cancelAnimationFrame(playbackAnimFrame);
      playbackAnimFrame = null;
    }
    isPlaying = false;
    currentSeekTime = 0;
    btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';

    if (activeMasterIndex >= 0 && loadedFiles[activeMasterIndex]) {
      const buffer = loadedFiles[activeMasterIndex].buffer;
      const timeDisplay = document.getElementById('time-display');
      if (timeDisplay) {
        timeDisplay.textContent = `00:00 / ${formatTime(buffer.duration)}`;
      }
      const scrubber = document.getElementById('waveform-scrubber');
      if (scrubber) scrubber.value = 0;
      drawWaveform(buffer, 0);
    }
  }

  btnPlay.addEventListener('click', () => {
    if (activeMasterIndex < 0 || !loadedFiles[activeMasterIndex]) return;

    if (isPlaying) {
      stopPlayback();
    } else {
      startPlaybackAt(currentSeekTime);
    }
  });

  // Waveform Click-to-Seek & Scrubber Range Input Listeners
  const waveformContainer = document.querySelector('.waveform-container');
  if (waveformContainer) {
    waveformContainer.addEventListener('click', (e) => {
      if (e.target.id === 'waveform-scrubber') return;
      if (activeMasterIndex < 0 || !loadedFiles[activeMasterIndex]) return;
      const rect = waveformContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const buffer = loadedFiles[activeMasterIndex].buffer;
      startPlaybackAt(ratio * buffer.duration);
    });
  }

  const waveformScrubber = document.getElementById('waveform-scrubber');
  if (waveformScrubber) {
    waveformScrubber.addEventListener('input', (e) => {
      if (activeMasterIndex < 0 || !loadedFiles[activeMasterIndex]) return;
      const buffer = loadedFiles[activeMasterIndex].buffer;
      const ratio = parseFloat(e.target.value) / 100;
      startPlaybackAt(ratio * buffer.duration);
    });
  }

  // Modal & Export Report Handlers
  btnExportReport.addEventListener('click', () => {
    if (!currentAnalysisData) return;
    reportBody.innerHTML = reportGenerator.generateHTMLReport(currentAnalysisData);
    reportModal.classList.remove('hidden');
  });

  btnCloseModal.addEventListener('click', () => {
    reportModal.classList.add('hidden');
  });

  btnPrintReport.addEventListener('click', () => {
    window.print();
  });

  btnCopyMarkdown.addEventListener('click', () => {
    if (!currentAnalysisData) return;
    const md = reportGenerator.generateMarkdownReport(currentAnalysisData);
    navigator.clipboard.writeText(md);
    alert('Markdown 報告已成功複製到剪貼簿！');
  });

  // Initial Empty Canvas Render
  drawPhaseGoniometer([]);
});
