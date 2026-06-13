let audioCtx = null;
let compressor = null;
const activeTaps = [];
const MAX_TAP_VOICES = 3;

function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function getSFXBus() {
  const c = ac();
  if (!compressor) {
    compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;
    compressor.connect(c.destination);
  }
  return compressor;
}

export function playTap(key) {
  try {
    const c = ac(), bus = getSFXBus();
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
  } catch {}
}

export function playWhoosh() {
  try {
    const c = ac(), bus = getSFXBus();
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
  } catch {}
}

export function playDeath() {
  try {
    const c = ac(), bus = getSFXBus();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(400, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.4);
    g.gain.setValueAtTime(0.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    o.connect(g); g.connect(bus);
    o.start(); o.stop(c.currentTime + 0.45);
  } catch {}
}

export function playGrade(grade) {
  try {
    const c = ac(), bus = getSFXBus();
    const freqs = grade === "perfect" ? [523, 659, 784] : grade === "great" ? [440, 554] : [330];
    freqs.forEach((fr, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = fr;
      g.gain.setValueAtTime(0, c.currentTime + i * 0.05);
      g.gain.linearRampToValueAtTime(0.1, c.currentTime + i * 0.05 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.05 + 0.2);
      o.connect(g); g.connect(bus);
      o.start(c.currentTime + i * 0.05);
      o.stop(c.currentTime + i * 0.05 + 0.22);
    });
  } catch {}
}

export function playMilestone() {
  try {
    const c = ac(), bus = getSFXBus();
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
  } catch {}
}

export function playMiss() {
  try {
    const c = ac(), bus = getSFXBus();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(220, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(120, c.currentTime + 0.15);
    g.gain.setValueAtTime(0.1, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    o.connect(g); g.connect(bus);
    o.start(); o.stop(c.currentTime + 0.18);
  } catch {}
}

export function playMetronome() {
  try {
    const c = ac(), bus = getSFXBus();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.06);
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    o.connect(g); g.connect(bus);
    o.start(); o.stop(c.currentTime + 0.12);
  } catch {}
}
