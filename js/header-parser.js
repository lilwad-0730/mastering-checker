/**
 * HeaderParser - Raw ArrayBuffer Binary Header Parser for WAV & FLAC Bit Depth Inspection
 */
class HeaderParser {
  /**
   * Parse File or ArrayBuffer header to extract exact bit depth and sample rate
   */
  async parseHeader(file) {
    // Read first 100 bytes of the raw audio file
    const slice = file.slice(0, 100);
    const arrayBuffer = await slice.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    // Default values if fallback to AudioBuffer
    const result = {
      formatName: file.name.split('.').pop().toLowerCase(),
      sampleRate: null,
      bitDepth: null,
      channels: null,
      audioFormat: 'PCM',
      isLossless: true
    };

    try {
      // Check RIFF / WAV Header
      const chunkID = this.getString(dataView, 0, 4);
      if (chunkID === 'RIFF') {
        const format = this.getString(dataView, 8, 4);
        if (format === 'WAVE') {
          // Find "fmt " sub-chunk
          let pos = 12;
          while (pos < dataView.byteLength - 8) {
            const subchunkID = this.getString(dataView, pos, 4);
            const subchunkSize = dataView.getUint32(pos + 4, true);

            if (subchunkID === 'fmt ') {
              const audioFormatCode = dataView.getUint16(pos + 8, true); // 1 = PCM, 3 = IEEE Float, 65534 = Extensible
              result.channels = dataView.getUint16(pos + 10, true);
              result.sampleRate = dataView.getUint32(pos + 12, true);
              result.bitDepth = dataView.getUint16(pos + 22, true);

              if (audioFormatCode === 3) {
                result.audioFormat = 'IEEE 32-bit Float';
              } else if (audioFormatCode === 1) {
                result.audioFormat = 'Linear PCM';
              }
              break;
            }
            pos += 8 + subchunkSize;
          }
        }
      } else if (chunkID === 'fLaC') {
        // FLAC metadata block header
        result.formatName = 'flac';
        result.audioFormat = 'FLAC Lossless';
        // FLAC STREAMINFO is 34 bytes long following fLaC
        if (dataView.byteLength >= 38) {
          const sampleRateRaw = (dataView.getUint8(18) << 12) | (dataView.getUint8(19) << 4) | (dataView.getUint8(20) >> 4);
          const channelsRaw = ((dataView.getUint8(20) & 0x0E) >> 1) + 1;
          const bitsPerSampleRaw = (((dataView.getUint8(20) & 0x01) << 4) | (dataView.getUint8(21) >> 4)) + 1;

          result.sampleRate = sampleRateRaw;
          result.channels = channelsRaw;
          result.bitDepth = bitsPerSampleRaw;
        }
      } else if (result.formatName === 'mp3') {
        result.isLossless = false;
        result.bitDepth = 16; // Compressed lossy representation
        result.audioFormat = 'MPEG Layer 3 Lossy';
      }
    } catch (err) {
      console.warn('Header parse fallback:', err);
    }

    return result;
  }

  getString(dataView, offset, length) {
    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(dataView.getUint8(offset + i));
    }
    return str;
  }
}

window.HeaderParser = HeaderParser;
