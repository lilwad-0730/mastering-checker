# SoundMaster PRO — 獨立音樂人母帶檢查器 (Audio Mastering QC)

> **專為獨立音樂人（Indie Musicians）與自混音創作者打造的純前端靜態網頁母帶品質與分軌檢查軟體。**  
> 免費、免安裝、100% 本地瀏覽器運算（音檔絕不上傳任何伺服器，保障音樂著作權與隱私）。

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Supported-00f0ff.svg)
![Platform](https://img.shields.io/badge/Platform-Static%20Web-10b981.svg)

---

## 🌟 核心特色 (Key Features)

### 1. 📊 LUFS 響度與 4x Oversampling True Peak 量測
- **EBU R128 標準**：精確計算 Integrated LUFS (全曲平均響度)、Short-term LUFS、Momentary LUFS 與 Loudness Range (LRA 動態起伏)。
- **4x Oversampling True Peak (dBTP)**：透過 4 倍超取樣內插演算，精確捕捉傳統 Sample Peak 無法偵測的數位跨採樣峰值。
- **串流平台增益懲罰預測 (Loudness Penalty)**：內建 **Spotify (-14 LUFS)**、**Apple Music (-16 LUFS)**、**YouTube (-14 LUFS)**、**Tidal**、**SoundCloud** 與 **CD 數位母帶**之對照矩陣，自動計算音量將被平台強制衰減的 dB 數。
- **Limiter 壓限提醒**：若 True Peak 超過 `-1.0 dBTP`，系統將發出高亮過載警示，並引導使用者於 DAW 的 Master 總軌載入 Limiter 壓限器限制 Ceiling。

### 2. 🌊 AI 頻率遮蔽與分軌干擾分析 (Stem & Frequency Masking)
- **6 大音樂頻段能量剖析**：劃分 Sub-Bass (20-60Hz)、Bass (60-250Hz)、Mud Zone (250-500Hz 渾濁區)、Mid (500-2kHz)、Vocal Clarity (2k-6kHz) 與 Air (6k-20kHz)。
- **單軌母帶渾濁度指數 (Muddiness Index)**：自動檢測 250-500Hz 區域是否過度堆積導致混音糊成一片。
- **多分軌 (Stems) 爭搶比對**：支援上傳並指定人聲 (Vocal)、貝斯 (Bass)、鼓組 (Drums) 與樂器 (Synth/Guitar) 分軌，自動分析人聲與樂器在同時間軸上的頻率遮蔽率，並給予具體 EQ 刻槽建議。

### 3. 🎯 Ozone Imager 風格 — 半圓形極座標相位圖 (Stereo Phase & Polar Goniometer)
- **極座標向量圖 (Polar Goniometer)**：比照 iZotope Ozone Imager 設計，以 180° 半圓弧形圖即時呈現 Mid (正相 Mono) 與 Side (旁側立體聲) 點雲動態分佈。
- **Phase Correlation 相位相關性**：計算 -1.0 (反相) 至 +1.0 (正相) 指數。
- **單聲道向下相容警示 (Mono Compatibility)**：自動偵測反相 (Out-of-Phase) 風態，警示在手機單喇叭或夜店音響播放時低頻與人聲被消音的風險。

### 4. 🔬 取樣率與原始位元深度解析 (Sample Rate & Bit Depth Inspector)
- **二進位 Header 解析**：直接解析 WAV RIFF 與 FLAC Header 檔頭結構，讀取真實原始位元深度 (16-bit / 24-bit / 32-bit float) 與取樣率 (44.1kHz / 48kHz / 96kHz)。
- **發行門檻驗證**：自動判定是否達 24-bit / 44.1kHz 高品質無損發行標準。

### 5. 💡 音檔副檔名與發行管道建議 (Format Advisor)
- **編碼結構判讀**：識別 `.wav`, `.flac`, `.aiff`, `.mp3`, `.m4a` 等副檔名。
- **有損二次壓縮警告**：明確標示 MP3 於 Spotify/Apple Music 轉碼時造成的音質損害，提供 DistroKid、Tunecore、CD Baby 與 Apple Digital Masters 上架最佳實踐說明。

### 6. ⚡ 雙重動態進度條與一鍵示範測試
- **極速 DSP 檢測進度條**：5 階段非同步微秒級（< 0.2 秒）進度與剩餘時間倒數。
- **一鍵載入示範音軌**：內建 Web Audio 示範母帶與 Stems 合成器，無音檔亦可一鍵體驗完整檢測。
- **母帶診斷報告匯出**：產生獨立音樂人 QC 報告，支援畫面列印/PDF 與一鍵複製 Markdown 格式。

---

## 📂 專案架構 (Directory Structure)

```
mastering-checker/
├── index.html              # 混音室主 UI 介面與分頁佈局
├── style.css               # 錄音室暗黑風主題、玻璃擬態與響應式 CSS
├── .gitignore              # Git 忽略檔案
├── README.md               # 專案說明文件
└── js/
    ├── app.js              # 主控制器、UI 事件與雙進度條邏輯
    ├── audio-decoder.js    # Web Audio API 解碼器與示範音效合成器
    ├── lufs-engine.js      # EBU R128 LUFS & 4x Oversampling True Peak 引擎
    ├── masking-engine.js   # 20Hz-20kHz 頻譜與 AI 分軌遮蔽衝突分析器
    ├── phase-engine.js     # 極速相位相干係數與 Ozone Imager 極座標圖引擎
    ├── header-parser.js    # WAV / FLAC Header 二進位解析器
    ├── format-advisor.js   # 數位發行商格式與副檔名建議引擎
    └── report-generator.js # HTML 與 Markdown 母帶診斷報告生成器
```

---

## 🚀 如何在本地運行 (Local Setup)

本軟體為純靜態網頁（Pure Static Web App），無須安裝任何 Node.js 後端環境或數據庫：

1. 下載或複製本儲存庫：
   ```bash
   git clone https://github.com/lilwad-0730/mastering-checker.git
   ```
2. 直接雙擊開啟 `index.html` 即可在瀏覽器中使用！

---

## 🌐 部署至 GitHub Pages (Deploy to GitHub Pages)

若想將此軟體公開託管至 GitHub Pages：

1. 前往 GitHub 儲存庫頁面 `https://github.com/lilwad-0730/mastering-checker`
2. 點擊頂部的 **Settings** 頁籤。
3. 在左側選單點選 **Pages**。
4. 在 **Build and deployment** 下方的 **Source** 選擇 `Deploy from a branch`。
5. Branch 選擇 `main` / `/(root)` 並點擊 **Save**。
6. 約 1 分鐘後即可獲得免費公開網址 `https://lilwad-0730.github.io/mastering-checker/`！

---

## 📄 授權條款 (License)

本專案採 [MIT License](LICENSE) 開源授權，歡迎獨立音樂人、混音師與開發者自由使用與拓展！
