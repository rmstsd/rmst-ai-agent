function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWav(buffer: AudioBuffer) {
  const channelCount = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const output = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(output);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([output], { type: "audio/wav" });
}

export async function recordingToWav(recording: Blob) {
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
