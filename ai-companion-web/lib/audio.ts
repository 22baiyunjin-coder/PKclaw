"use client"

// Simple Web Audio API wrapper to generate game sounds without external assets

let audioContext: AudioContext | null = null;

const initAudio = () => {
  if (typeof window !== 'undefined' && !audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export type SoundType = "fold" | "check" | "call" | "raise" | "all-in" | "win" | "deal"

export const playSound = (type: SoundType) => {
  try {
    const ctx = initAudio();
    if (!ctx) return;

    // Resume context if suspended (browser policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    switch (type) {
      case "fold":
        playFoldSound(ctx);
        break;
      case "check":
        playCheckSound(ctx);
        break;
      case "call":
        playChipSound(ctx, 1);
        break;
      case "raise":
        playChipSound(ctx, 2);
        break;
      case "all-in":
        playAllInSound(ctx);
        break;
      // Add other cases as needed
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
}

const playFoldSound = (ctx: AudioContext) => {
  // Simulate card sliding: filtered noise
  const bufferSize = ctx.sampleRate * 0.3; // 300ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.25);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start();
}

const playCheckSound = (ctx: AudioContext) => {
  // Two quick knocks (wood block style)
  const t = ctx.currentTime;
  createKnock(ctx, t);
  createKnock(ctx, t + 0.12);
}

const createKnock = (ctx: AudioContext, time: number) => {
  const osc = ctx.createOscillator();
  osc.type = 'sine'; // Sine is cleaner for a "knock" if enveloped correctly
  osc.frequency.setValueAtTime(300, time);
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.08);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.08);
}

const playChipSound = (ctx: AudioContext, count: number) => {
  const t = ctx.currentTime;
  for(let i=0; i<count; i++) {
      createChipClink(ctx, t + i * 0.08);
  }
}

const createChipClink = (ctx: AudioContext, time: number) => {
    // High pitched short metallic/plastic sound
    const osc = ctx.createOscillator();
    osc.type = 'square'; // Square has more harmonics, closer to plastic click
    osc.frequency.setValueAtTime(2200, time);
    osc.frequency.exponentialRampToValueAtTime(1800, time + 0.04);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.04);
}

const playAllInSound = (ctx: AudioContext) => {
    // Dramatic rising sound
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.6);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.linearRampToValueAtTime(2000, t + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
}
