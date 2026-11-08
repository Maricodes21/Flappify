import { GAME_HEIGHT, GAME_WIDTH, PLAYER_X } from "./dimensions.js";

const RHYTHM_TUNING = {
  easy: {
    approachTime: 2.15, arcHeight: 42, pathAmplitude: 34,
    gateEvery: 6, energeticGateEvery: 5, minGatePixels: 190,
    minGap: 200, maxGap: 260, gapRatio: 0.34,
    timingWindows: { perfect: 0.09, great: 0.16, good: 0.24 },
  },
  normal: {
    approachTime: 1.9, arcHeight: 48, pathAmplitude: 46,
    gateEvery: 4, energeticGateEvery: 3, minGatePixels: 165,
    minGap: 175, maxGap: 230, gapRatio: 0.30,
    timingWindows: { perfect: 0.075, great: 0.14, good: 0.21 },
  },
  hard: {
    approachTime: 1.55, arcHeight: 56, pathAmplitude: 58,
    gateEvery: 3, energeticGateEvery: 2, minGatePixels: 140,
    minGap: 150, maxGap: 205, gapRatio: 0.26,
    timingWindows: { perfect: 0.06, great: 0.115, good: 0.18 },
  },
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function median(values, fallback) {
  if (!values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function classifySegment(segment) {
  const timbre = segment?.timbre || [];
  const loudness = timbre[0] || 0;
  const brightness = timbre[1] || 0;
  const attack = timbre[3] || 0;
  if (loudness > 30 && brightness < 0 && attack > 20) return "kick";
  if (loudness > 25 && brightness > 0 && attack > 15) return "snare";
  return "other";
}

function classifyBeats(beats, segments) {
  if (!segments?.length) return beats.map(() => "other");
  let segmentIndex = 0;
  return beats.map(beat => {
    while (segmentIndex < segments.length - 1
      && Math.abs(segments[segmentIndex + 1].start - beat.start) < Math.abs(segments[segmentIndex].start - beat.start)) {
      segmentIndex++;
    }
    return classifySegment(segments[segmentIndex]);
  });
}

/**
 * Build a readable input pulse. Fast songs use half-time; slow songs receive
 * interpolated half-beats so the intended tap rate stays roughly 1.2–2.4 Hz.
 */
export function buildPlayablePulses(beats = [], bars = [], bpm = 120, beatTypes = []) {
  if (!beats.length) return [];
  const stride = bpm > 145 ? 2 : 1;
  const selected = [];
  for (let index = 0; index < beats.length; index += stride) {
    const beat = beats[index];
    selected.push({
      time: beat.start,
      sourceIndex: index,
      confidence: beat.confidence ?? 0.8,
      beatType: beatTypes[index] || "other",
      isDownbeat: bars.some(bar => Math.abs(bar.start - beat.start) < 0.05),
      isSubdivision: false,
    });
  }

  const pulses = [];
  const maxPulseInterval = 0.86;
  for (const pulse of selected) {
    const previous = pulses[pulses.length - 1];
    if (previous) {
      const interval = pulse.time - previous.time;
      const pieces = Math.max(1, Math.ceil(interval / maxPulseInterval));
      for (let part = 1; part < pieces; part++) {
        pulses.push({
          time: previous.time + interval * (part / pieces),
          sourceIndex: previous.sourceIndex,
          confidence: Math.min(previous.confidence, pulse.confidence) * 0.8,
          beatType: "subdivision",
          isDownbeat: false,
          isSubdivision: true,
        });
      }
    }
    pulses.push(pulse);
  }
  return pulses;
}

export function deriveRhythmPhysics(pulses = [], difficulty = "normal") {
  const tuning = RHYTHM_TUNING[difficulty] || RHYTHM_TUNING.normal;
  const intervals = pulses.slice(1).map((pulse, index) => pulse.time - pulses[index].time)
    .filter(interval => interval > 0.2 && interval < 1.5);
  const pulseDuration = clamp(median(intervals, 0.5), 0.36, 0.9);
  const pulseFrames = pulseDuration * 60;
  const gravity = (8 * tuning.arcHeight) / (pulseFrames * pulseFrames);
  // The game applies gravity before position each frame, so use the exact
  // discrete impulse that returns to the same height after one pulse.
  const flapVelocity = -gravity * (pulseFrames + 1) / 2;
  return {
    pulseDuration,
    gravity,
    flapVelocity,
    maxUpVelocity: flapVelocity * 1.45,
  };
}

function sectionAt(sections, time) {
  let active = sections[0] || { start: 0, duration: 30, energy: 0.5 };
  for (const section of sections) {
    if (section.start > time) break;
    active = section;
  }
  return active;
}

export function buildRhythmSchedule(analysis, features, difficulty, diffSettings, baseGap) {
  const beats = analysis?.beats || [];
  const bars = analysis?.bars || [];
  const bpm = Math.max(50, features?.tempo || 120);
  const energy = features?.energy ?? 0.7;
  const tuning = RHYTHM_TUNING[difficulty] || RHYTHM_TUNING.normal;
  const height = GAME_HEIGHT;
  const ground = height - 70;
  const birdX = PLAYER_X;
  const spawnX = GAME_WIDTH + 24;
  const sections = (analysis?.sections || []).map(section => {
    const loudness = Number.isFinite(section.loudness) ? section.loudness : -18;
    return {
      start: section.start,
      duration: section.duration,
      loudness,
      energy: clamp((loudness + 60) / 60, 0, 1),
      tempo: section.tempo || bpm,
      key: section.key,
    };
  });
  const beatTypes = classifyBeats(beats, analysis?.segments || []);
  const pulses = buildPlayablePulses(beats, bars, bpm, beatTypes);
  const physics = deriveRhythmPhysics(pulses, difficulty);

  // Approach time is independent from BPM. Music controls event timing while
  // difficulty controls how long the player has to read the path.
  const pixelsPerSecond = (spawnX - birdX) / tuning.approachTime;
  const speed = pixelsPerSecond / 60;
  const responsiveGapFloor = clamp(height * tuning.gapRatio, tuning.minGap, tuning.maxGap);
  const safeTop = 50 + responsiveGapFloor / 2;
  const safeBottom = ground - 30 - responsiveGapFloor / 2;
  const centerY = (safeTop + safeBottom) / 2;

  // One actionable target per pulse. The eight-pulse wave acts as a readable
  // phrase, giving the song visible direction without random vertical jumps.
  const beatDots = pulses.map((pulse, index) => {
    const section = sectionAt(sections, pulse.time);
    const amplitude = tuning.pathAmplitude * (0.78 + section.energy * 0.28);
    // Twelve pulses create alternating rises, falls, and returns. Sampling this
    // path every 3–4 pulses gives gates different musical directions instead
    // of placing every downbeat at the same vertical midpoint.
    const phrasePhase = index * (Math.PI / 6) + ((section.start || 0) % 8) * 0.08;
    const primaryWave = Math.sin(phrasePhase) * amplitude;
    const secondaryWave = Math.sin(index * Math.PI / 2) * amplitude * 0.12;
    return {
      time: pulse.time,
      y: clamp(centerY + primaryWave + secondaryWave, safeTop, safeBottom),
      beatType: pulse.beatType,
      isDownbeat: pulse.isDownbeat,
      isSubdivision: pulse.isSubdivision,
      sectionEnergy: section.energy,
    };
  });

  // A perfect tap receives the impulse that carries it toward the next target.
  // This preserves ballistic flight while making each input author the path.
  for (let index = 0; index < beatDots.length; index++) {
    const current = beatDots[index];
    const next = beatDots[index + 1];
    if (!next) {
      current.flapVelocity = physics.flapVelocity;
      continue;
    }
    const frames = Math.max(1, (next.time - current.time) * 60);
    const gravityTravel = 0.5 * physics.gravity * frames * (frames + 1);
    const requiredVelocity = (next.y - current.y - gravityTravel) / frames;
    current.flapVelocity = clamp(requiredVelocity, physics.maxUpVelocity, -1.5);
  }

  // Gates attach to a sparse subset of pulses. Section changes receive a full
  // four-pulse breather, and accents cannot bypass minimum physical spacing.
  const schedule = [];
  let gateCounter = 0;
  let previousSectionStart = null;
  let breatherUntil = -Infinity;
  let lastGateHitTime = -Infinity;
  const minGateSeconds = tuning.minGatePixels / pixelsPerSecond;

  for (let index = 0; index < beatDots.length; index++) {
    const dot = beatDots[index];
    const section = sectionAt(sections, dot.time);
    if (previousSectionStart !== null && section.start !== previousSectionStart) {
      breatherUntil = dot.time + physics.pulseDuration * 4;
      gateCounter = 0;
    }
    previousSectionStart = section.start;
    if (dot.time < breatherUntil) continue;

    gateCounter++;
    const energetic = energy > 0.78 || section.energy > 0.76;
    const gateEvery = energetic ? tuning.energeticGateEvery : tuning.gateEvery;
    const isEligibleAccent = dot.isDownbeat && gateCounter >= gateEvery - 1;
    if (gateCounter < gateEvery && !isEligibleAccent) continue;
    if (dot.time < tuning.approachTime + 0.25) continue;
    if (dot.time - lastGateHitTime < minGateSeconds) continue;

    gateCounter = 0;
    lastGateHitTime = dot.time;
    const gapMultiplier = diffSettings?.gapM || 1;
    const energyGap = baseGap * gapMultiplier * (1.12 - (section.energy - 0.5) * 0.16);
    const gapSize = clamp(energyGap, responsiveGapFloor, tuning.maxGap);
    const gapY = clamp(dot.y - gapSize / 2, 50, ground - 30 - gapSize);

    schedule.push({
      time: dot.time - tuning.approachTime,
      spawnTime: dot.time - tuning.approachTime,
      hitTime: dot.time,
      targetDotIndex: index,
      gapSize,
      gapY,
      beatType: dot.beatType,
      isDownbeat: dot.isDownbeat,
      sectionEnergy: section.energy,
      isBreather: false,
    });
  }

  if (schedule.length > 0) {
    const intervals = schedule.slice(1).map((gate, index) => gate.hitTime - schedule[index].hitTime);
    const minimumPixels = intervals.length ? Math.min(...intervals) * pixelsPerSecond : Infinity;
    console.log(`[RHYTHM] ${beatDots.length} taps · ${schedule.length} gates · ${Number.isFinite(minimumPixels) ? minimumPixels.toFixed(0) : "—"}px minimum gate spacing · ${physics.pulseDuration.toFixed(2)}s pulse`);
  }

  return {
    schedule,
    beatDots,
    trailDots: [],
    sections,
    bars: bars.map(bar => bar.start),
    beats: beats.map(beat => beat.start),
    barStarts: bars.map(bar => bar.start),
    speed,
    approachTime: tuning.approachTime,
    pulseDuration: physics.pulseDuration,
    physics,
    timingWindows: tuning.timingWindows,
  };
}
