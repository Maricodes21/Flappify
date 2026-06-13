// beatMapper.js — Rhythm-driven pipe schedule generator
// Uses Spotify audio_analysis (beats, bars, sections, segments) to create
// a pipe spawn schedule where placement is tied to musical structure.
// Falls back to synthetic beat generation when API data is unavailable.

/**
 * Generate synthetic audio analysis data when Spotify API is unavailable.
 * Creates a musically plausible beat grid from BPM and duration.
 */
export function generateSyntheticAnalysis(bpm = 120, durationSec = 210) {
  const beatDur = 60 / bpm;
  const beatsPerBar = 4;
  const barDur = beatDur * beatsPerBar;

  // Generate beats with subtle deterministic micro-timing jitter (±12ms)
  // This prevents the perfectly-mechanical feel of 100% regular beats.
  // Uses sin/cos to create repeatable variation without a PRNG seed.
  const beats = [];
  let i = 0;
  for (let t = beatDur; t < durationSec - 0.5; t += beatDur, i++) {
    const jitter = (Math.sin(i * 127.1 + i * i * 0.31) * 0.5) * 0.025; // ±12.5ms
    beats.push({ start: Math.max(0, t + jitter), duration: beatDur, confidence: 0.8 });
  }

  // Generate bars (every 4 beats, aligned to beat times)
  const bars = [];
  for (let b = 0; b < beats.length; b += beatsPerBar) {
    bars.push({ start: beats[b].start, duration: barDur, confidence: 0.8 });
  }

  // Generate sections (~every 20-30 seconds with realistic loudness values.
  // Real Spotify sections have loudness -8 to -25 dB — NOT -5 which is
  // near maximum. Too-high loudness values drove section energy to 0.83-0.92,
  // shrinking gaps aggressively and spawning pipes too fast.
  const sections = [];
  const sectionDur = Math.max(15, Math.min(30, durationSec / 6));
  const sectionTypes = ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"];
  // Realistic loudness map per section type (typical Spotify values)
  const loudnessMap = {
    intro:  -22,
    verse:  -18,
    chorus: -10,
    bridge: -14,
    outro:  -24,
  };
  for (let si = 0; si * sectionDur < durationSec; si++) {
    const start = si * sectionDur;
    const type = sectionTypes[si % sectionTypes.length];
    sections.push({
      start,
      duration: Math.min(sectionDur, durationSec - start),
      loudness: loudnessMap[type] ?? -16,
      tempo: bpm,
      key: 7,
      mode: 1,
      confidence: 0.6,
    });
  }

  // Generate segments with clearly differentiated kick/snare timbre.
  // timbre[0] = loudness, timbre[1] = brightness, timbre[3] = attack.
  // Kick: loud, low brightness, high attack. Snare: bright, moderate attack.
  const segments = beats.map((b, idx) => {
    const beatInBar = idx % 4;
    const isKick  = beatInBar === 0 || beatInBar === 2; // beats 1 & 3
    const isSnare = beatInBar === 1 || beatInBar === 3; // beats 2 & 4
    return {
      start: b.start,
      duration: b.duration,
      loudness_start: isKick ? -8 : -12,
      loudness_max:   isKick ? -4 : -8,
      pitches: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      timbre: [
        isKick ? 50 : 35,    // [0] loudness
        isKick ? -30 : 80,   // [1] brightness — kick is dark, snare is bright
        20,                   // [2] flatness
        isKick ? 80 : 50,    // [3] attack
        0, 0, 0, 0, 0, 0, 0, 0,
      ],
    };
  });

  return { beats, bars, sections, segments, meta: { synthetic: true } };
}

/**
 * Classify a segment as kick/snare/other using timbre vectors.
 * Spotify timbre[0] = avg loudness, timbre[1] = brightness,
 * timbre[3] ≈ attack strength.
 */
function classifySegment(seg) {
  const t = seg.timbre || [];
  const loudness = t[0] || 0;
  const brightness = t[1] || 0;
  const attack = t[3] || 0;

  // Kick: loud, low brightness, strong attack
  if (loudness > 30 && brightness < 0 && attack > 20) return "kick";
  // Snare: loud, high brightness, strong attack
  if (loudness > 25 && brightness > 0 && attack > 15) return "snare";
  return "other";
}

/**
 * Build a lookup map of beat times → segment classification.
 * For each beat, find the closest segment and classify it.
 */
function buildBeatClassification(beats, segments) {
  if (!segments || segments.length === 0) return beats.map(() => "other");

  let segIdx = 0;
  return beats.map(beat => {
    const bt = beat.start;
    // Advance segment index to closest segment
    while (segIdx < segments.length - 1 &&
      Math.abs(segments[segIdx + 1].start - bt) < Math.abs(segments[segIdx].start - bt)) {
      segIdx++;
    }
    return classifySegment(segments[segIdx]);
  });
}

/**
 * Get section energy at a given time.
 * Returns 0-1 energy value derived from section loudness.
 */
function getSectionEnergy(sections, time) {
  if (!sections || sections.length === 0) return 0.5;
  let sec = sections[0];
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].start > time) break;
    sec = sections[i];
  }
  // Normalize loudness: typically -60 to 0 dB
  return Math.min(1, Math.max(0, (sec.loudness + 60) / 60));
}

/**
 * Build the pipe spawn schedule from audio analysis data.
 *
 * @param {Object} analysis - Spotify audio_analysis response
 * @param {Object} features - Spotify audio_features response
 * @param {string} difficulty - "easy" | "normal" | "hard"
 * @param {Object} diffSettings - { gapM, spdM } difficulty multipliers
 * @param {number} baseGap - base gap size in pixels
 * @returns {Object} { schedule, sections, bars, beats }
 */
export function buildPipeSchedule(analysis, features, difficulty, diffSettings, baseGap) {
  const beats = (analysis?.beats || []);
  const bars = (analysis?.bars || []);
  const sections = (analysis?.sections || []).map(s => ({
    start: s.start,
    duration: s.duration,
    loudness: s.loudness,
    energy: Math.min(1, Math.max(0, (s.loudness + 60) / 60)),
    tempo: s.tempo || (features?.tempo || 120),
    key: s.key,
  }));
  const segments = analysis?.segments || [];
  const energy = features?.energy ?? 0.7;
  const bpm = Math.max(50, features?.tempo || 120);

  // Classify each beat by its nearest segment's timbre
  const beatTypes = buildBeatClassification(beats, segments);

  // Determine how many beats between pipes based on energy + difficulty
  const baseBeatsPerPipe = Math.max(2, Math.round(4 - energy * 2));
  const diffBeatsMultiplier = difficulty === "easy" ? 1.5 : difficulty === "hard" ? 0.75 : 1;
  const beatsPerPipe = Math.max(1, Math.round(baseBeatsPerPipe * diffBeatsMultiplier));

  const gapM = diffSettings?.gapM || 1.0;

  // Find bar start times for downbeat detection
  const barStarts = new Set(bars.map(b => b.start));

  // ─── Beat-Optimal Path Simulation ─────────────────────────
  // Simulate the bird's Y position assuming the player taps exactly on each beat.
  // Then place pipe gaps centered on where the bird would be at pipe arrival time.
  const GRAVITY = 0.55;   // matches game physics (SpotifyFlappy.jsx line 45)
  const FLAP_VEL = -9.0;  // matches game FLAP_VEL exactly (was -7.5 — 20% too weak)
  const H = 600;           // canvas height
  const GROUND = H - 70;
  const CEILING = 0;
  const BIRD_X = 80;

  // Game speed calculation (mirrors initGame — BASE_SPEED = 2.6, not 3.8)
  const dm = diffSettings || { spdM: 1, gapM: 1 };
  const speed = 2.6 * (bpm / 120) * (0.75 + energy * 0.5) * (dm.spdM || 1);
  const beatDuration = 60 / bpm;

  // Simulate bird physics on perfect beat-taps
  const beatTimes = beats.map(b => b.start);
  const simFrameRate = 60;
  const simDt = 1 / simFrameRate;
  let simY = H / 2;
  let simVy = 0;
  let simTime = 0;
  let nextBeatIdx = 0;

  // Build a trajectory lookup: time → predicted bird Y
  const trajectory = [];
  const maxTime = beatTimes.length > 0 ? beatTimes[beatTimes.length - 1] + 10 : 300;

  while (simTime < maxTime) {
    // Check if we should flap (on beat)
    if (nextBeatIdx < beatTimes.length && simTime >= beatTimes[nextBeatIdx]) {
      simVy = Math.max(FLAP_VEL * 1.5, simVy + FLAP_VEL * 0.7);
      if (simVy > FLAP_VEL) simVy = FLAP_VEL;
      nextBeatIdx++;
    }

    // Apply gravity
    simVy += GRAVITY * simDt * 60;
    simY += simVy * simDt * 60;

    // Gentle center-tendency: prevents the trajectory from permanently
    // hugging the ceiling or floor when BPM is very slow or very fast.
    // The pull is very subtle (0.08% of distance per frame) so it doesn't
    // distort the arc shape, only corrects long-term drift.
    const centerY = H / 2;
    simVy += (centerY - simY) * 0.0008;

    // Clamp to bounds
    if (simY < CEILING + 15) { simY = CEILING + 15; simVy = 0; }
    if (simY > GROUND - 15) { simY = GROUND - 15; simVy = 0; }

    trajectory.push({ time: simTime, y: simY });
    simTime += simDt;
  }

  // Helper: get predicted bird Y at a given time
  function getPredictedY(time) {
    if (trajectory.length === 0) return H / 2;
    // Binary search
    let lo = 0, hi = trajectory.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (trajectory[mid].time < time) lo = mid + 1;
      else hi = mid;
    }
    return trajectory[lo]?.y ?? H / 2;
  }

  // ─── Schedule Generation ──────────────────────────────────
  const schedule = [];
  let beatCounter = 0;
  let prevSectionStart = -1;
  // How long a pipe takes to scroll from right edge to bird X
  const pipeScrollTime = (420 - BIRD_X) / (speed * 60);

  for (let i = 0; i < beats.length; i++) {
    beatCounter++;
    const beat = beats[i];
    const type = beatTypes[i];

    let shouldSpawn = false;
    if (beatCounter >= beatsPerPipe) shouldSpawn = true;
    if (beatCounter >= beatsPerPipe - 1 && (type === "kick" || type === "snare")) shouldSpawn = true;

    if (!shouldSpawn) continue;
    beatCounter = 0;

    // Track sub-section energy
    let currentSection = sections[0] || { start: 0, duration: 10, energy: 0.5 };
    for (let s of sections) {
      if (s.start <= beat.start) currentSection = s;
      else break;
    }
    const secProgress = Math.min(1, Math.max(0, (beat.start - currentSection.start) / (currentSection.duration || 10)));
    const secEnergy = currentSection.energy;
    // Sub-section curve: tension rises over the section
    const arcTension = secProgress * 0.2;
    let dynamicGap = baseGap * (1.3 - (secEnergy + arcTension) * 0.5) * gapM;

    // Breathing gap at section transitions
    let isBreather = false;
    if (currentSection.start !== prevSectionStart) {
      isBreather = true;
      prevSectionStart = currentSection.start;
      dynamicGap *= 1.5;
    }

    // Predict where the bird will be when this pipe reaches the bird
    const arrivalTime = beat.start + pipeScrollTime;
    const predictedY = getPredictedY(arrivalTime);

    // Center the gap on the predicted Y, adding an upward bias (~40px clear) and clamping
    const halfGap = dynamicGap / 2;
    const minGy = 60; // minimum gap-top
    const maxGy = GROUND - 20 - dynamicGap; // maximum gap-top
    let gy = predictedY - halfGap - 40; 
    gy = Math.max(minGy, Math.min(maxGy, gy));

    const isDownbeat = barStarts.has(beat.start) ||
      bars.some(b => Math.abs(b.start - beat.start) < 0.05);

    schedule.push({
      time: beat.start,
      gapSize: dynamicGap,
      gapY: gy,
      beatType: type,
      isDownbeat,
      sectionEnergy: secEnergy,
      isBreather,
    });
  }

  // Reachability validation cap
  for (let i = 1; i < schedule.length; i++) {
    const prev = schedule[i-1];
    const curr = schedule[i];
    const maxDelta = 180;
    if (curr.gapY - prev.gapY > maxDelta) {
      curr.gapY = prev.gapY + maxDelta;
    } else if (prev.gapY - curr.gapY > maxDelta) {
      curr.gapY = prev.gapY - maxDelta;
    }
  }

  // Ensure gentle opening: widen first 5 pipe gaps
  for (let i = 0; i < Math.min(5, schedule.length); i++) {
    const bonus = 1.3 - i * 0.06;
    schedule[i].gapSize *= bonus;
  }

  // Validation log: confirm gapY distribution is spread across the screen.
  // avgY should be ~200-280. If it's >400, physics constants are mismatched.
  if (schedule.length > 0) {
    const ys = schedule.map(s => s.gapY);
    const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    console.log(`[PIPES] Schedule: ${schedule.length} pipes | gapY range: ${minY.toFixed(0)}-${maxY.toFixed(0)} | avg: ${avgY.toFixed(0)} | speed: ${speed.toFixed(2)}`);
  }

  // ─── Beat Dots Generation (Downbeat-only gold checkpoints) ──
  // One dot per BAR START (every 4 beats), positioned safely inside the
  // nearest pipe gap so collecting it never conflicts with survival.
  const beatDots = [];
  for (let i = 0; i < beats.length; i++) {
    const bt = beats[i].start;
    // Skip first beat (countdown grace period)
    if (i < 1) continue;

    // Only generate dots on downbeats (bar starts)
    const isDownbeat = barStarts.has(bt) ||
      bars.some(b => Math.abs(b.start - bt) < 0.05);
    if (!isDownbeat) continue;

    // ── Pipe-safe Y positioning ────────────────────────────
    // If a pipe is scheduled within 2 beats of this dot, place the dot
    // vertically centered in that pipe's gap so the player can fly through
    // and collect it simultaneously — no sacrifice choice required.
    const nearbyThreshold = beatDuration * 2;
    let closestPipe = null;
    let closestDist = Infinity;
    for (const p of schedule) {
      const dist = Math.abs(p.time - bt);
      if (dist < closestDist) { closestDist = dist; closestPipe = p; }
    }

    let dotY;
    if (closestPipe && closestDist < nearbyThreshold) {
      // Snap to center of the nearest pipe's gap
      dotY = closestPipe.gapY + closestPipe.gapSize / 2;
    } else {
      // No nearby pipe — use predicted flight path with upward bias
      const arrivalTime = bt + pipeScrollTime;
      dotY = getPredictedY(arrivalTime) - 40;
    }

    const clampedY = Math.max(40, Math.min(GROUND - 40, dotY));

    beatDots.push({
      time: bt,
      y: clampedY,
      beatType: beatTypes[i] || "other",
      isDownbeat: true, // always true — only downbeats reach here
    });
  }

  // ─── Dot-Pipe Safety Guarantee ──────────────────────────────
  // If a player taps perfectly on a dot, they must NOT collide with a
  // nearby pipe. For every dot, find pipes within a time window and
  // ensure the pipe gap provides at least MIN_CLEARANCE pixels of room
  // above and below the dot's Y coordinate plus the bird's hit radius.
  // If the gap is too small or misaligned, widen and reposition it.
  const BIRD_R_HIT = 15 * 0.80; // HIT_R from SpotifyFlappy.jsx (BIRD_R * 0.80)
  const MIN_CLEARANCE = 25;      // minimum pixels between bird edge and pipe edge
  const MIN_SAFE_HALF = BIRD_R_HIT + MIN_CLEARANCE; // ~37px above and below dot Y

  for (const dot of beatDots) {
    // Time window: pipes that could overlap with the bird when it's at the dot
    // A pipe scrolls across the bird over roughly PIPE_W / (speed * 60) seconds
    const pipePassTime = 54 / (speed * 60); // PIPE_W = 54
    const safeWindow = beatDuration * 2 + pipePassTime;

    for (const pipe of schedule) {
      const timeDist = Math.abs(pipe.time - dot.time);
      if (timeDist > safeWindow) continue;

      // Check if the dot Y is safely inside this pipe's gap
      const gapTop = pipe.gapY;
      const gapBottom = pipe.gapY + pipe.gapSize;
      const dotTop = dot.y - MIN_SAFE_HALF;    // bird top edge at dot Y
      const dotBottom = dot.y + MIN_SAFE_HALF;  // bird bottom edge at dot Y

      if (dotTop >= gapTop && dotBottom <= gapBottom) {
        // Already safe — no adjustment needed
        continue;
      }

      // Need to adjust: widen the gap and/or reposition it
      const requiredGap = MIN_SAFE_HALF * 2 + 10; // minimum gap to safely contain the bird
      if (pipe.gapSize < requiredGap) {
        pipe.gapSize = requiredGap;
      }

      // Re-center the gap on the dot's Y with upward bias
      const newGapY = dot.y - pipe.gapSize / 2 - 10;
      pipe.gapY = Math.max(60, Math.min(GROUND - 20 - pipe.gapSize, newGapY));
    }
  }

  // ─── Trail Dots Generation (every beat, path-following) ─────
  // One small dot per beat (all beats, not just downbeats).
  // Y position follows the gold beatDot path: linearly interpolated
  // between adjacent beatDots so they form a flowing curve, not a flat lane.
  // Dots near pipes are snapped safely inside the pipe gap.
  const trailDots = [];
  const TRAIL_BIRD_R_HIT = 15 * 0.80;
  const TRAIL_MIN_CLEARANCE = 20; // slightly smaller than gold dots — they're secondary
  const TRAIL_MIN_SAFE_HALF = TRAIL_BIRD_R_HIT + TRAIL_MIN_CLEARANCE;

  // Helper: interpolate Y along the beatDot path at a given time
  function getPathY(time) {
    if (beatDots.length === 0) return H / 2;
    if (beatDots.length === 1) return beatDots[0].y;
    // Find surrounding beatDots
    if (time <= beatDots[0].time) return beatDots[0].y;
    if (time >= beatDots[beatDots.length - 1].time) return beatDots[beatDots.length - 1].y;
    for (let d = 0; d < beatDots.length - 1; d++) {
      const a = beatDots[d], b = beatDots[d + 1];
      if (time >= a.time && time <= b.time) {
        const t = (time - a.time) / (b.time - a.time);
        // Smooth step for a gentle curve
        const smooth = t * t * (3 - 2 * t);
        return a.y + (b.y - a.y) * smooth;
      }
    }
    return H / 2;
  }

  for (let i = 0; i < beats.length; i++) {
    const bt = beats[i].start;
    if (i < 1) continue; // skip first beat

    // Skip beats that coincide with a gold beatDot (they already have a dot)
    const isDownbeat = barStarts.has(bt) || bars.some(b => Math.abs(b.start - bt) < 0.05);
    if (isDownbeat) continue;

    // Y: interpolate along the beatDot path
    let trailY = getPathY(bt);

    // Snap to pipe gap center if a pipe is very close
    const nearbyThreshold = beatDuration * 2;
    let closestPipe = null;
    let closestDist = Infinity;
    for (const p of schedule) {
      const dist = Math.abs(p.time - bt);
      if (dist < closestDist) { closestDist = dist; closestPipe = p; }
    }
    if (closestPipe && closestDist < nearbyThreshold) {
      // Check if path Y is safe in the gap; if not, pull to gap center
      const gapCenter = closestPipe.gapY + closestPipe.gapSize / 2;
      const gapTop = closestPipe.gapY + TRAIL_MIN_SAFE_HALF;
      const gapBot = closestPipe.gapY + closestPipe.gapSize - TRAIL_MIN_SAFE_HALF;
      if (trailY < gapTop || trailY > gapBot) {
        // Clamp to safe zone within gap
        trailY = Math.max(gapTop, Math.min(gapBot, gapCenter));
      }
    }

    trailDots.push({
      time: bt,
      y: Math.max(40, Math.min(GROUND - 40, trailY)),
      beatType: beatTypes[i] || "other",
    });
  }

  return {
    schedule,
    beatDots,
    trailDots,
    sections,
    bars: bars.map(b => b.start),
    beats: beats.map(b => b.start),
    barStarts: bars.map(b => b.start),
  };
}

/**
 * Compute difficulty rating for a track (1-3 stars).
 * Based on BPM, energy, danceability, and segment density.
 */
export function computeDifficultyRating(features, analysis) {
  const bpm = features?.tempo || 120;
  const energy = features?.energy ?? 0.5;
  const danceability = features?.danceability ?? 0.5;
  const duration = features?.duration_ms ? features.duration_ms / 1000 : 210;
  const segmentCount = analysis?.segments?.length || 0;
  const segDensity = duration > 0 ? segmentCount / duration : 0;

  // Raw score: weighted combination
  const rawScore = bpm * 0.4 + energy * 35 + danceability * 10 + segDensity * 8;

  let stars, label;
  if (rawScore < 55) {
    stars = 1;
    label = "Chill";
  } else if (rawScore < 80) {
    stars = 2;
    label = "Moderate";
  } else {
    stars = 3;
    label = "Intense";
  }

  return { stars, label, rawScore: Math.round(rawScore) };
}

/**
 * Find distance from a game time to the nearest bar start (downbeat).
 * Used for timing zone grading.
 *
 * @param {number} time - current game time in seconds
 * @param {number[]} barStarts - array of bar start times
 * @param {number} beatDuration - duration of one beat in seconds
 * @returns {{ dist: number, ratio: number }} absolute distance and ratio to beat duration
 */
export function distanceToNearestDownbeat(time, barStarts, beatDuration) {
  if (!barStarts || barStarts.length === 0) {
    return { dist: Infinity, ratio: 1 };
  }

  let minDist = Infinity;
  // Binary-search-like scan from approximate position
  let lo = 0, hi = barStarts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = Math.abs(barStarts[mid] - time);
    if (d < minDist) minDist = d;
    if (barStarts[mid] < time) lo = mid + 1;
    else hi = mid - 1;
  }

  return {
    dist: minDist,
    ratio: beatDuration > 0 ? minDist / beatDuration : 1,
  };
}
