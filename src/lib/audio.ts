function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWav(buffer: AudioBuffer) {
  // 与原实现保持一致，使用硬编码的单声道、16 位 PCM 音频参数。
  const channelCount = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const output = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(output);

  // 写入标准 44 字节 WAV 头，数字字段均使用小端序。
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  // 声道数：WAV 头偏移量 22-23。
  view.setUint16(22, channelCount, true);
  // 采样率：WAV 头偏移量 24-27。
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  // 位深度：WAV 头偏移量 34-35。
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // 提取并写入纯音频数据。
  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([output], { type: "audio/wav" });
}

export async function recordingToWav(recording: Blob) {
  // 解析浏览器录音并统一转换为语音识别接口需要的 WAV 格式。
  const audioContext = new AudioContext({ sampleRate: 16_000 });
  try {
    const decoded = await audioContext.decodeAudioData(await recording.arrayBuffer());
    return audioBufferToWav(decoded);
  } finally {
    await audioContext.close();
  }
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取录音失败"));
    reader.readAsDataURL(blob);
  });
}
