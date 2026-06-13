// audioAnalyzer.js — Real audio beat detection via Web Audio API
// Analyzes Spotify preview URLs (30s MP3) to extract actual beat times,
// tempo, energy profile, and section boundaries. Then extrapolates
// a full-song beat grid that matches the real rhythm.
//
// Works in browsers AND in WebView/Capacitor APK builds since it only
// uses standard Web Audio API (AudioContext, decodeAudioData).

/**
 * Analyze a preview URL and return beat/section data in the same format
 * as Spotify's audio-analysis API, so beatMapper.js can consume it directly.
 *
 * @param {string} previewUrl - 30s MP3 preview URL from Spotify track object
 * @param {number} fullDurationSec - Total song duration in seconds
 * @param {number} [fallbackBpm=120] - BPM to use if detection fails
 * @returns {Promise<{analysis: Object, features: Object}>}
 */
export async function analyzePreview(previewUrl, fullDurationSec, fallbackBpm = 120) {
  let detectedBpm = fallbackBpm;
  let detectedBeats = [];
  let energyProfile = [];
  let sections = [];

  try {
    // Fetch and decode the preview audio
    const response = await fetch(previewUrl);
    if (!response.ok) throw new Error(`Preview fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    // Extract mono channel data
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Step 1: Detect tempo (BPM) from onset energy
    detectedBpm = detectTempo(channelData, sampleRate);

    // Step 2: Detect actual beat onsets in the preview
    detectedBeats = detectBeats(channelData, sampleRate, detectedBpm);

    // Step 3: Build energy profile (for section detection)
    energyProfile = buildEnergyProfile(channelData, sampleRate);

    // Step 4: Detect sections from energy changes
    sections = detectSections(energyProfile, duration);

  } catch (err) {
    console.warn("[audioAnalyzer] Preview analysis failed, using synthetic fallback:", err.message);
    // Fall through — we'll use fallbackBpm with the synthetic extrapolation
  }

  // Step 5: Extrapolate full-song beat grid from preview data
  const fullAnalysis = extrapolateFullSong(
    detectedBpm || fallbackBpm,
    detectedBeats,
    energyProfile,
    sections,
    fullDurationSec
  );

  // Step 6: Build features object (replaces audio-features API)
  const features = buildFeatures(detectedBpm || fallbackBpm, energyProfile);

  return { analysis: fullAnalysis, features };
}

// ─── Tempo Detection ──────────────────────────────────────────────

/**
 * Detect BPM using autocorrelation on the onset energy envelope.
 * This is more robust than simple peak counting.
 */
function detectTempo(channelData, sampleRate) {
  // Build onset strength envelope at ~100Hz resolution
  const hopSize = Math.floor(sampleRate / 100);
  const envelope = [];

  for (let i = 0; i < channelData.length - hopSize; i += hopSize) {
    let energy = 0;
    for (let j = i; j < i + hopSize; j++) {
      energy += channelData[j] * channelData[j];
    }
    envelope.push(Math.sqrt(energy / hopSize));
  }

  // Compute spectral flux (onset strength)
  const flux = [];
  for (let i = 1; i < envelope.length; i++) {
    const diff = envelope[i] - envelope[i - 1];
    flux.push(diff > 0 ? diff : 0); // half-wave rectified
  }

  // Normalize flux
  const maxFlux = Math.max(...flux, 0.001);
  const normFlux = flux.map(f => f / maxFlux);

  // Autocorrelation to find periodicity
  // Search BPM range 60-200
  const minLag = Math.floor(100 * 60 / 200); // 200 BPM at 100Hz
  const maxLag = Math.floor(100 * 60 / 60);  // 60 BPM at 100Hz
  let bestLag = Math.floor(100 * 60 / 120);  // default 120
  let bestCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < normFlux.length - lag; i++) {
      corr += normFlux[i] * normFlux[i + lag];
      count++;
    }
    corr /= count || 1;

    // Prefer lags that are in the "natural" tempo range (80-160)
    const bpm = (100 * 60) / lag;
    const rangePref = (bpm >= 80 && bpm <= 160) ? 1.15 : 1.0;
    corr *= rangePref;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const bpm = (100 * 60) / bestLag;

  // Check for octave errors — if BPM is very low, try doubling
  if (bpm < 75) return Math.round(bpm * 2);
  if (bpm > 170) return Math.round(bpm / 2);

  return Math.round(bpm);
}

// ─── Beat Detection ───────────────────────────────────────────────

/**
 * Detect individual beat onset times using energy peaks
 * guided by the detected BPM.
 */
function detectBeats(channelData, sampleRate, bpm) {
  const beatDur = 60 / bpm;
  const hopSize = Math.floor(sampleRate / 200); // 200Hz resolution
  const hopDur = hopSize / sampleRate;

  // Build onset envelope
  const envelope = [];
  for (let i = 0; i < channelData.length - hopSize; i += hopSize) {
    let energy = 0;
    for (let j = i; j < i + hopSize; j++) {
      energy += channelData[j] * channelData[j];
    }
    envelope.push(Math.sqrt(energy / hopSize));
  }

  // Compute onset strength (spectral flux)
  const onset = [0];
  for (let i = 1; i < envelope.length; i++) {
    const diff = envelope[i] - envelope[i - 1];
    onset.push(diff > 0 ? diff : 0);
  }

  // Adaptive threshold: local mean + offset
  const windowSize = Math.floor(beatDur / hopDur * 2); // ~2 beats window
  const beats = [];
  const minInterval = beatDur * 0.6; // minimum time between beats (60% of expected)
  let lastBeatTime = -minInterval;

  for (let i = 0; i < onset.length; i++) {
    const time = i * hopDur;

    // Local threshold
    const start = Math.max(0, i - windowSize);
    const end = Math.min(onset.length, i + windowSize);
    let localMean = 0;
    for (let j = start; j < end; j++) localMean += onset[j];
    localMean /= (end - start);

    const threshold = localMean * 1.5 + 0.001;

    // Peak picking with minimum interval
    if (onset[i] > threshold && time - lastBeatTime >= minInterval) {
      // Verify it's a local maximum
      const isPeak = (i === 0 || onset[i] >= onset[i - 1]) &&
                     (i === onset.length - 1 || onset[i] >= onset[i + 1]);
      if (isPeak) {
        beats.push({ start: time, confidence: Math.min(1, onset[i] / (threshold * 2)) });
        lastBeatTime = time;
      }
    }
  }

  // If we got very few beats, fall back to a regular grid
  if (beats.length < 5) {
    const gridBeats = [];
    const duration = channelData.length / sampleRate;
    for (let t = beatDur; t < duration; t += beatDur) {
      gridBeats.push({ start: t, confidence: 0.6 });
    }
    return gridBeats;
  }

  return beats;
}

// ─── Energy Profile ───────────────────────────────────────────────

/**
 * Build an energy profile sampled every 0.5 seconds.
 * Used for section detection and energy mapping.
 */
function buildEnergyProfile(channelData, sampleRate) {
  const windowSec = 0.5;
  const windowSamples = Math.floor(sampleRate * windowSec);
  const profile = [];

  for (let i = 0; i < channelData.length - windowSamples; i += windowSamples) {
    let rms = 0;
    for (let j = i; j < i + windowSamples; j++) {
      rms += channelData[j] * channelData[j];
    }
    rms = Math.sqrt(rms / windowSamples);
    profile.push({
      time: i / sampleRate,
      energy: rms,
    });
  }

  // Normalize to 0-1
  const maxE = Math.max(...profile.map(p => p.energy), 0.001);
  profile.forEach(p => { p.energy /= maxE; });

  return profile;
}

// ─── Section Detection ────────────────────────────────────────────

/**
 * Detect section boundaries from energy profile changes.
 * Looks for significant jumps or drops in energy.
 */
function detectSections(energyProfile, duration) {
  if (energyProfile.length < 4) {
    return [{ start: 0, duration: duration, loudness: -15, energy: 0.5 }];
  }

  const sections = [];
  let sectionStart = 0;
  const smoothWindow = 3;

  // Smooth the energy profile
  const smoothed = energyProfile.map((p, i) => {
    const start = Math.max(0, i - smoothWindow);
    const end = Math.min(energyProfile.length, i + smoothWindow + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += energyProfile[j].energy;
    return sum / (end - start);
  });

  // Find significant energy changes
  const threshold = 0.15; // 15% change triggers a section boundary
  for (let i = 1; i < smoothed.length; i++) {
    const diff = Math.abs(smoothed[i] - smoothed[i - 1]);
    if (diff > threshold) {
      const energy = smoothed[i];
      // Convert energy to loudness (dB-like scale)
      const loudness = -30 + energy * 22; // maps 0→-30, 1→-8
      sections.push({
        start: sectionStart,
        duration: energyProfile[i].time - sectionStart,
        loudness,
        energy,
      });
      sectionStart = energyProfile[i].time;
    }
  }

  // Add final section
  const lastEnergy = smoothed[smoothed.length - 1] || 0.5;
  sections.push({
    start: sectionStart,
    duration: duration - sectionStart,
    loudness: -30 + lastEnergy * 22,
    energy: lastEnergy,
  });

  // If we got too few sections, create sensible defaults
  if (sections.length < 2) {
    const avgEnergy = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
    return [
      { start: 0, duration: duration * 0.3, loudness: -20, energy: avgEnergy * 0.7 },
      { start: duration * 0.3, duration: duration * 0.4, loudness: -12, energy: avgEnergy },
      { start: duration * 0.7, duration: duration * 0.3, loudness: -22, energy: avgEnergy * 0.6 },
    ];
  }

  return sections;
}

// ─── Full Song Extrapolation ──────────────────────────────────────

/**
 * Take the 30s preview analysis and extrapolate a full-song beat grid.
 *
 * Strategy:
 * - Use detected BPM to generate a regular beat grid for the full duration
 * - Apply micro-timing swing from the preview's detected beats
 * - Map preview sections onto full song using typical song structure
 * - Generate bars (every 4 beats) and segments with energy-based timbre
 */
function extrapolateFullSong(bpm, previewBeats, energyProfile, previewSections, fullDuration) {
  const beatDur = 60 / bpm;
  const beatsPerBar = 4;

  // ─── Extract swing/groove pattern from preview beats ───
  // Measure the micro-timing deviations from a perfect grid
  const swingPattern = extractSwingPattern(previewBeats, beatDur);

  // ─── Generate full beat grid with swing applied ───
  const beats = [];
  let beatIndex = 0;
  for (let t = beatDur; t < fullDuration - 0.5; t += beatDur, beatIndex++) {
    // Apply swing pattern (repeats every N beats from the preview)
    const swingOffset = swingPattern.length > 0
      ? swingPattern[beatIndex % swingPattern.length]
      : 0;
    const time = Math.max(0, t + swingOffset);
    beats.push({
      start: time,
      duration: beatDur,
      confidence: 0.85,
    });
  }

  // ─── Generate bars ───
  const bars = [];
  for (let i = 0; i < beats.length; i += beatsPerBar) {
    bars.push({
      start: beats[i].start,
      duration: beatDur * beatsPerBar,
      confidence: 0.8,
    });
  }

  // ─── Map sections to full song ───
  // Use a typical pop structure: intro → verse → chorus → verse → chorus → bridge → chorus → outro
  const sections = mapSectionsToFullSong(previewSections, energyProfile, fullDuration, bpm);

  // ─── Generate segments with energy-based timbre ───
  const segments = beats.map((b, idx) => {
    const beatInBar = idx % 4;
    const isKick = beatInBar === 0 || beatInBar === 2;

    // Find the section this beat belongs to
    let sectionEnergy = 0.5;
    for (const sec of sections) {
      if (b.start >= sec.start && b.start < sec.start + sec.duration) {
        sectionEnergy = sec.energy || 0.5;
        break;
      }
    }

    // Modulate timbre based on section energy
    const loudnessBase = isKick ? 50 : 35;
    return {
      start: b.start,
      duration: b.duration,
      loudness_start: isKick ? -8 : -12,
      loudness_max: isKick ? -4 : -8,
      pitches: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      timbre: [
        loudnessBase * (0.6 + sectionEnergy * 0.4),  // [0] loudness
        isKick ? -30 : 80,                              // [1] brightness
        20,                                              // [2] flatness
        isKick ? 80 : 50,                               // [3] attack
        0, 0, 0, 0, 0, 0, 0, 0,
      ],
    };
  });

  return {
    beats,
    bars,
    sections,
    segments,
    meta: {
      detectedBpm: bpm,
      previewBeatsFound: previewBeats.length,
      method: previewBeats.length > 5 ? "preview_analysis" : "synthetic_with_bpm",
    },
  };
}

/**
 * Extract the micro-timing swing pattern from detected beats.
 * Returns an array of offsets (in seconds) from perfect grid positions.
 */
function extractSwingPattern(previewBeats, beatDur) {
  if (previewBeats.length < 8) return [];

  // Find the best grid alignment for the preview beats
  const firstBeat = previewBeats[0].start;
  const offsets = [];

  for (let i = 0; i < previewBeats.length; i++) {
    const expectedTime = firstBeat + i * beatDur;
    const actualTime = previewBeats[i].start;
    const offset = actualTime - expectedTime;
    // Only keep offsets within ±25% of a beat duration (reject outliers)
    if (Math.abs(offset) < beatDur * 0.25) {
      offsets.push(offset);
    } else {
      offsets.push(0);
    }
  }

  // Return a repeating pattern based on the bar length (typically 4 beats)
  // Average the swing offsets across all bars to get the pattern
  const patternLen = 4; // assume 4/4 time
  const pattern = new Array(patternLen).fill(0);
  const counts = new Array(patternLen).fill(0);

  for (let i = 0; i < offsets.length; i++) {
    const pos = i % patternLen;
    pattern[pos] += offsets[i];
    counts[pos]++;
  }

  for (let i = 0; i < patternLen; i++) {
    pattern[i] = counts[i] > 0 ? pattern[i] / counts[i] : 0;
  }

  return pattern;
}

/**
 * Map preview sections to a full-song structure.
 * Uses the preview's energy profile to infer the song's arc,
 * then tiles it across the full duration.
 */
function mapSectionsToFullSong(previewSections, energyProfile, fullDuration, bpm) {
  // If we have good preview sections, use them to model the song arc
  if (previewSections.length >= 2) {
    // Typical song structure proportions
    const structure = [
      { type: "intro",  pct: 0.00, dur: 0.08, energyMult: 0.5 },
      { type: "verse",  pct: 0.08, dur: 0.17, energyMult: 0.65 },
      { type: "chorus", pct: 0.25, dur: 0.13, energyMult: 1.0 },
      { type: "verse",  pct: 0.38, dur: 0.12, energyMult: 0.7 },
      { type: "chorus", pct: 0.50, dur: 0.13, energyMult: 1.0 },
      { type: "bridge", pct: 0.63, dur: 0.12, energyMult: 0.6 },
      { type: "chorus", pct: 0.75, dur: 0.15, energyMult: 1.0 },
      { type: "outro",  pct: 0.90, dur: 0.10, energyMult: 0.4 },
    ];

    // Scale the preview's energy range to modulate the template
    const previewAvgEnergy = previewSections.reduce((sum, s) => sum + (s.energy || 0.5), 0) / previewSections.length;
    const previewMaxEnergy = Math.max(...previewSections.map(s => s.energy || 0.5));

    return structure.map(s => {
      const energy = Math.min(1, previewAvgEnergy * s.energyMult * (previewMaxEnergy / 0.5));
      const loudness = -30 + energy * 22;
      return {
        start: s.pct * fullDuration,
        duration: s.dur * fullDuration,
        loudness,
        energy,
        tempo: bpm,
        key: 7,
        mode: 1,
        confidence: 0.7,
      };
    });
  }

  // Minimal fallback: 3-section arc
  return [
    { start: 0, duration: fullDuration * 0.3, loudness: -20, energy: 0.5, tempo: bpm, key: 7, mode: 1, confidence: 0.5 },
    { start: fullDuration * 0.3, duration: fullDuration * 0.4, loudness: -12, energy: 0.8, tempo: bpm, key: 7, mode: 1, confidence: 0.5 },
    { start: fullDuration * 0.7, duration: fullDuration * 0.3, loudness: -22, energy: 0.45, tempo: bpm, key: 7, mode: 1, confidence: 0.5 },
  ];
}

// ─── Feature Estimation ───────────────────────────────────────────

/**
 * Build a features object from detected data.
 * Replaces the deprecated audio-features API response.
 */
function buildFeatures(bpm, energyProfile) {
  // Estimate energy from the profile
  const avgEnergy = energyProfile.length > 0
    ? energyProfile.reduce((sum, p) => sum + p.energy, 0) / energyProfile.length
    : 0.6;

  // Estimate danceability from tempo and energy
  // Sweet spot: 100-130 BPM + high energy = very danceable
  const tempoFit = 1 - Math.abs(bpm - 115) / 60;
  const danceability = Math.min(1, Math.max(0, tempoFit * 0.5 + avgEnergy * 0.5));

  // Estimate valence from energy variance (consistent = happier feel)
  const energyVariance = energyProfile.length > 1
    ? energyProfile.reduce((sum, p) => sum + Math.pow(p.energy - avgEnergy, 2), 0) / energyProfile.length
    : 0.1;
  const valence = Math.min(1, Math.max(0, 0.5 + avgEnergy * 0.3 - energyVariance * 2));

  return {
    tempo: bpm,
    energy: Math.min(1, avgEnergy * 1.2), // slight boost since RMS tends to undercount
    danceability,
    valence,
    key: 7,       // can't detect from simple energy analysis
    mode: 1,
    loudness: -10 + (1 - avgEnergy) * -15,
    speechiness: 0.1,
    acousticness: 0.3,
    instrumentalness: 0.2,
    liveness: 0.15,
  };
}
