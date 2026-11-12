import { getSetting } from "../services/storage.js";

let audioCtx = null;
let compressor = null;
let sfxOutput = null;
const activeTaps = [];
const MAX_TAP_VOICES = 3;

function playNativeSound(name) {
  try {
    if (!window.ReactNativeWebView?.postMessage) return false;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "game-sfx", name }));
    return true;
  } catch {
    return false;
  }
}

function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playableContext() {
  const c = ac();
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  return c;
}

export async function unlockGameAudio() {
  try {
    const c = ac();
    if (c.state === "suspended") await c.resume();
    return c.state === "running";
  } catch {
    return false;
  }
}

let synthTrackInterval = null;
let synthTrackStep = 0;

export function startSynthesizedBackingTrack(bpm = 120, key = 7) {
  stopSynthesizedBackingTrack();
  try {
    const c = playableContext();
    const intervalMs = (60 / Math.max(40, Math.min(240, bpm))) * 1000;
    const baseFreqs = [261.6, 277.2, 293.7, 311.1, 329.6, 349.2, 370.0, 392.0, 415.3, 440.0, 466.2, 493.9];
    const rootFreq = baseFreqs[Math.abs(key) % 12] || 261.6;

    synthTrackStep = 0;
    const tickBeat = () => {
      try {
        const now = c.currentTime;
        const isDownbeat = synthTrackStep % 4 === 0;
        const isSnare = synthTrackStep % 4 === 2;

        // Kick drum on downbeat (and soft on step 2)
        if (isDownbeat || synthTrackStep % 2 === 0) {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(isDownbeat ? 140 : 90, now);
          osc.frequency.exponentialRampToValueAtTime(35, now + (isDownbeat ? 0.18 : 0.12));
          gain.gain.setValueAtTime(isDownbeat ? 0.3 : 0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + (isDownbeat ? 0.2 : 0.14));
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + 0.22);
        }

        // Snare / clap on beat 2 & 4
        if (isSnare) {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + 0.16);
        }

        // Bass synth note
        const bassOsc = c.createOscillator();
        const bassGain = c.createGain();
        bassOsc.type = "sawtooth";
        const noteFactor = isDownbeat ? 0.5 : (synthTrackStep % 4 === 2 ? 0.75 : 0.5);
        bassOsc.frequency.setValueAtTime(rootFreq * noteFactor, now);
        bassGain.gain.setValueAtTime(0.06, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.35, (intervalMs / 1000) * 0.8));
        bassOsc.connect(bassGain);
        bassGain.connect(c.destination);
        bassOsc.start(now);
        bassOsc.stop(now + Math.min(0.38, (intervalMs / 1000) * 0.85));

        synthTrackStep++;
      } catch {}
    };

    tickBeat();
    synthTrackInterval = setInterval(tickBeat, intervalMs);
    return true;
  } catch {
    return false;
  }
}

export function stopSynthesizedBackingTrack() {
  if (synthTrackInterval) {
    clearInterval(synthTrackInterval);
    synthTrackInterval = null;
  }
  synthTrackStep = 0;
}

function getSFXBus() {
  const c = playableContext();
  if (!compressor) {
    compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;
    sfxOutput = c.createGain();
    compressor.connect(sfxOutput);
    sfxOutput.connect(c.destination);
  }
  const volume = Math.max(0, Math.min(1, Number(getSetting("sfxVolume", 80)) / 100));
  sfxOutput.gain.setTargetAtTime(volume, c.currentTime, 0.015);
  return compressor;
}

export function playTap(key, webOnly = false) {
  try {
    const c = playableContext(), bus = getSFXBus();
    // Polyphony limiter: kill oldest voices if at limit
    while (activeTaps.length >= MAX_TAP_VOICES) {
      const old = activeTaps.shift();
      try {
        old.gain.gain.setValueAtTime(0.001, c.currentTime);
        old.osc.stop(c.currentTime + 0.01);
      } catch {}
    }
    const freq = [261.6,277.2,293.7,311.1,329.6,349.2,370,392,415.3,440,466.2,493.9][key] || 392;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * 2, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, c.currentTime + 0.12);
    f.type = "lowpass";
    f.frequency.setValueAtTime(3000, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.15);
    g.gain.setValueAtTime(0.22, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(); o.stop(c.currentTime + 0.16);
    activeTaps.push({ osc: o, gain: g, time: c.currentTime });
    // Auto-cleanup after sound ends
    setTimeout(() => {
      const idx = activeTaps.findIndex(t => t.osc === o);
      if (idx >= 0) activeTaps.splice(idx, 1);
    }, 200);
    return true;
  } catch {
    return webOnly ? false : playNativeSound("tap");
  }
}

export function playWhoosh(webOnly = false) {
  try {
    const c = playableContext(), bus = getSFXBus();
    const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(), g = c.createGain();
    f.type = "bandpass"; f.frequency.setValueAtTime(2000, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(500, c.currentTime + 0.08); f.Q.value = 2;
    g.gain.setValueAtTime(0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    s.connect(f); f.connect(g); g.connect(bus); s.start();
    return true;
  } catch {
    return webOnly ? false : playNativeSound("whoosh");
  }
}

export function playDeath(webOnly = false) {
  try {
    const c = playableContext(), bus = getSFXBus();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(400, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.4);
    g.gain.setValueAtTime(0.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    o.connect(g); g.connect(bus);
    o.start(); o.stop(c.currentTime + 0.45);
    return true;
  } catch {
    return webOnly ? false : playNativeSound("death");
  }
}

export function playGrade(grade, webOnly = false) {
  try {
    const c = playableContext(), bus = getSFXBus();
    // Lower, gentler frequencies and soft peak gain for "perfect" so it doesn't pierce or overpower playback
    const freqs = grade === "perfect" ? [261.6, 329.6, 392] : grade === "great" ? [330, 415.3] : [261.6];
    const peakGain = grade === "perfect" ? 0.045 : grade === "great" ? 0.06 : 0.07;
    freqs.forEach((fr, i) => {
      const o = c.createOscillator(), g = c.createGain(), filter = c.createBiquadFilter();
      o.type = "sine";
      o.frequency.value = fr;
      filter.type = "lowpass";
      filter.frequency.value = 1400; // gentle smoothing
      g.gain.setValueAtTime(0, c.currentTime + i * 0.04);
      g.gain.linearRampToValueAtTime(peakGain, c.currentTime + i * 0.04 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, c.currentTime + i * 0.04 + 0.18);
      o.connect(filter);
      filter.connect(g);
      g.connect(bus);
      o.start(c.currentTime + i * 0.04);
      o.stop(c.currentTime + i * 0.04 + 0.2);
    });
    return true;
  } catch {
    const name = ["perfect", "great", "good"].includes(grade) ? grade : "good";
    return webOnly ? false : playNativeSound(name);
  }
}

export function playMilestone(webOnly = false) {
  try {
    const c = playableContext(), bus = getSFXBus();
    [523, 659, 784, 1047].forEach((fr, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = fr;
      g.gain.setValueAtTime(0, c.currentTime + i * 0.08);
      g.gain.linearRampToValueAtTime(0.13, c.currentTime + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.08 + 0.3);
      o.connect(g); g.connect(bus);
      o.start(c.currentTime + i * 0.08);
      o.stop(c.currentTime + i * 0.08 + 0.32);
    });
    return true;
  } catch {
    return webOnly ? false : playNativeSound("milestone");
  }
}

export function playMiss(webOnly = false) {
  try {
    const c = playableContext(), bus = getSFXBus();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(220, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(120, c.currentTime + 0.15);
    g.gain.setValueAtTime(0.1, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    o.connect(g); g.connect(bus);
    o.start(); o.stop(c.currentTime + 0.18);
    return true;
  } catch {
    return webOnly ? false : playNativeSound("miss");
  }
}

export function playMetronome(webOnly = false) {
  try {
    const c = playableContext(), bus = getSFXBus();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.06);
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    o.connect(g); g.connect(bus);
    o.start(); o.stop(c.currentTime + 0.12);
    return true;
  } catch {
    return webOnly ? false : playNativeSound("metronome");
  }
}

// The native wrapper calls this only if its managed Expo Audio players are not
// available. This keeps game feedback audible without retrying a broken native
// media session for every cue.
if (typeof window !== "undefined") {
  window.__SF_PLAY_WEB_SFX__ = (name) => {
    if (name === "tap") playTap(7, true);
    else if (name === "whoosh") playWhoosh(true);
    else if (name === "death") playDeath(true);
    else if (["perfect", "great", "good"].includes(name)) playGrade(name, true);
    else if (name === "milestone") playMilestone(true);
    else if (name === "miss") playMiss(true);
    else if (name === "metronome") playMetronome(true);
  };
}
