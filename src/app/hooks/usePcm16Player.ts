"use client";

import { useCallback, useRef, useState } from "react";

export interface Pcm16PlayerOptions {
  sampleRate?: number; // input PCM16 sample rate (Hz), default 24000
  volume?: number; // 0.0 - 1.0
}

export function usePcm16Player(options: Pcm16PlayerOptions = {}) {
  const { sampleRate = 24000, volume = 1.0 } = options;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const playbackTimeRef = useRef<number>(0);
  const [ready, setReady] = useState(false);

  const ensureContext = useCallback(async () => {
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainNodeRef.current = gain;
      playbackTimeRef.current = ctx.currentTime;
      setReady(true);
    }
    if (audioCtxRef.current?.state === "suspended") {
      try {
        await audioCtxRef.current.resume();
      } catch {}
    }
    return audioCtxRef.current!;
  }, [volume]);

  const setVolume = useCallback((v: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.max(0, Math.min(1, v));
    }
  }, []);

  const reset = useCallback(() => {
    try {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    } catch {}
    audioCtxRef.current = null;
    gainNodeRef.current = null;
    playbackTimeRef.current = 0;
    setReady(false);
  }, []);

  const base64ToFloat32 = (base64: string) => {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const samples = new Float32Array(len / 2);
    for (let i = 0, j = 0; i < len; i += 2, j++) {
      const s = view.getInt16(i, true);
      samples[j] = s / 0x8000;
    }
    return samples;
  };

  const playBase64Pcm16 = useCallback(async (base64Chunk: string) => {
    if (!base64Chunk) return;
    const ctx = await ensureContext();
    const gain = gainNodeRef.current!;

    // Convert PCM16 to Float32
    const float32 = base64ToFloat32(base64Chunk);

    // Create AudioBuffer at input sample rate (WebAudio will resample as needed)
    const lengthInFrames = float32.length;
    const buffer = ctx.createBuffer(1, lengthInFrames, sampleRate);
    buffer.getChannelData(0).set(float32);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);

    const startAt = Math.max(ctx.currentTime, playbackTimeRef.current);
    src.start(startAt);
    playbackTimeRef.current = startAt + buffer.duration;
  }, [ensureContext, sampleRate]);

  const syncToNow = useCallback(async () => {
    const ctx = await ensureContext();
    playbackTimeRef.current = Math.max(playbackTimeRef.current, ctx.currentTime);
  }, [ensureContext]);

  return {
    ready,
    ensureContext,
    playBase64Pcm16,
    setVolume,
    reset,
    syncToNow,
  } as const;
}


