# Beat Dots & Pipe Rendering Fix Plan

## Executive Summary

The beat dots system is now generating data (415 dots confirmed in console), but the pipe
schedule that depends on the same path simulation has **critical physics constant mismatches**
that cause all pipe gaps to cluster near the bottom of the screen. The bottom pipes get
pushed below the ground and disappear. This document identifies every root cause and provides
an exact fix plan.

---

## Root Cause Analysis

### ROOT CAUSE 1: FLAP_VEL Mismatch (Critical — causes bottom-heavy pipes)

**Location:** `src/game/beatMapper.js` line 160

The beat-optimal path simulation uses `FLAP_VEL = -7.5`, but the actual game physics in
`SpotifyFlappy.jsx` line 45 uses `FLAP_VEL = -9.0`.

The simulation flap is **20% weaker** than reality. Over multiple beats, the simulated bird
drifts downward because each flap doesn't lift it high enough to counteract gravity. After
~5 beats, the predicted Y is near the ground (Y≈500), so all pipe gaps get placed at the
bottom of the screen.

Trace at 120 BPM (0.5s between beats):
- Beat 0: Y=300, flap → vy=-5.25 (-7.5*0.7). After 30 frames: Y≈382
- Beat 1: Y=382, flap → vy=-7.5 (clamped). After 30 frames: Y≈396
- Beat 2: Y=396 → Y≈410. Keeps drifting down toward GROUND (530).

With the CORRECT flap vel of -9.0:
- Beat 0: Y=300, flap → vy=-6.3 (-9.0*0.7), clamped to -9.0. After 30 frames: Y≈247
- Beat 1: Y=247, flap → vy=-9.0. After 30 frames: Y≈262
- The bird oscillates around Y≈250-280 (mid-screen). Much better!

**Fix:** Change line 160 from `const FLAP_VEL = -7.5;` to `const FLAP_VEL = -9.0;`

### ROOT CAUSE 2: Speed Constant Mismatch (Critical — wrong pipe arrival timing)

**Location:** `src/game/beatMapper.js` line 168

The simulation calculates speed as:
```javascript
const speed = 3.8 * (bpm / 120) * (0.75 + energy * 0.5) * (dm.spdM || 1);
```

But the actual game in `SpotifyFlappy.jsx` line 234 uses:
```javascript
const speed = BASE_SPEED * (bpm / 120) * (0.75 + energy * 0.5) * dm.spdM;
```
Where `BASE_SPEED = 2.6`.

The simulation speed is **3.8 / 2.6 = 1.46x** faster than reality. This makes
`pipeScrollTime` (line 222) 1.46x shorter than it actually is, so the predicted bird
Y position at pipe arrival is sampled at the wrong time — typically when the bird is
in a falling phase instead of a rising phase.

**Fix:** Change `3.8` to `2.6` on line 168. Or better yet, import/define a shared
constant.

### ROOT CAUSE 3: Synthetic Section Loudness Too High (Moderate — affects difficulty)

**Location:** `src/game/beatMapper.js` — `generateSyntheticAnalysis()` function

The synthetic sections use `loudness: -5` (chorus) and `loudness: -10` (verse). The
section energy formula `(loudness + 60) / 60` maps these to:
- Chorus energy: 0.917
- Verse energy: 0.833

Real Spotify tracks typically have loudness -8 to -20, giving energy 0.67-0.87.
The synthetic values are at the ceiling, causing:
- Pipes spawn too frequently (beatsPerPipe decreases with energy)
- Gaps shrink too much (dynamicGap inversely proportional to energy)
- Speed ramps up too aggressively

**Fix:** Adjust synthetic loudness to `-12` (chorus) and `-20` (verse), giving
energy 0.80 and 0.67 — matching typical Spotify ranges.

### ROOT CAUSE 4: Synthetic Beats Have No Timing Variation (Moderate — causes jank feel)

**Location:** `src/game/beatMapper.js` — `generateSyntheticAnalysis()` function

Synthetic beats are perfectly regular at exact intervals (e.g., every 0.5000s at
120 BPM). Real music has micro-timing variations (±10-30ms "swing" or "groove").
The perfect regularity creates:
- Unnaturally uniform pipe spacing
- Monotonous visual rhythm that feels mechanical
- The bird path simulation produces an overly predictable trajectory

**Fix:** Add slight timing jitter to synthetic beats: `±(0 to 20ms)` random
offset per beat, preserving overall BPM. Use deterministic randomness (seeded from
beat index) so the pattern is repeatable.

### ROOT CAUSE 5: Debug Overlay Still Present (Minor — visual clutter)

**Location:** `src/renderer.js` — lines after the dot rendering section

The diagnostic overlay draws a black rectangle with green text at the bottom of the
canvas showing dot counts, speed, game time, etc. This was added for debugging and
should be removed.

**Fix:** Delete the entire debug overlay block (the `if (g.beatDots)` block with
`ctx.fillText` calls between the dot section `ctx.restore()` and the kickScale
`ctx.restore()`).

---

## Fix Plan (Implementation Order)

### Step 1: Fix Physics Constants in beatMapper.js

File: `src/game/beatMapper.js`

1a. Change line 159 `const FLAP_VEL = -7.5;` → `const FLAP_VEL = -9.0;`

1b. Change line 168 `const speed = 3.8 * (bpm / 120)...` → `const speed = 2.6 * (bpm / 120)...`

These two changes alone should fix the bottom-heavy pipe placement by making the
path simulation match actual game physics.

### Step 2: Improve Synthetic Analysis Quality

File: `src/game/beatMapper.js`, function `generateSyntheticAnalysis()`

2a. Adjust section loudness values:
    - Intro/outro: `loudness: -25` (quiet)
    - Verse: `loudness: -18` (moderate)
    - Chorus: `loudness: -10` (loud)
    - Bridge: `loudness: -14` (moderate-loud)

2b. Add micro-timing jitter to synthetic beats:
```javascript
// Inside the beat generation loop:
const jitter = (Math.sin(i * 127.1 + i * i * 0.3) * 0.5 + 0.5) * 0.025 - 0.0125;
// That gives ±12.5ms deterministic jitter
beats.push({ start: t + jitter, duration: beatDur, confidence: 0.8 });
```

2c. Add more varied segment timbre for better beat classification:
```javascript
// Alternate kick/snare pattern more clearly
timbre: [
  40 + Math.sin(i * 0.5) * 10,   // loudness
  80,                              // brightness
  20,                              // flatness
  i % 2 === 0 ? 80 : 20,          // attack — clear kick/snare alternation
  ...
]
```

### Step 3: Remove Debug Overlay from Renderer

File: `src/renderer.js`

Delete the entire block between the comments:
```
// ── DEBUG: Beat Dots Diagnostic Overlay ──
```
and:
```
// Reset canvas state completely
ctx.restore();
```

Keep the `ctx.restore()` and everything after it.

### Step 4: Remove Debug Console.log from initGame

File: `src/SpotifyFlappy.jsx`

Delete or comment out the `console.log('[DOTS] initGame...')` line that was added
for debugging (around line 268 area, right after `beatShield: 0`).

Also delete or comment out the `console.log('[DOTS] Audio analysis unavailable...')`
line in the fetch handler (around line 198).

### Step 5 (Optional but Recommended): Add Center-Tendency Bias to Path Simulation

File: `src/game/beatMapper.js`, inside the `while (simTime < maxTime)` loop

The path simulation can drift toward extremes. Add a gentle center pull:

```javascript
// Gentle center attraction to prevent Y drift toward edges
const centerY = H / 2;
const centerPull = (centerY - simY) * 0.001; // very subtle
simVy += centerPull;
```

This prevents the predicted path from hugging the ceiling or floor, producing
better-distributed pipe gaps across the screen height.

### Step 6 (Optional): Add Path Simulation Validation Log

In `buildPipeSchedule()`, after the schedule is generated, add a one-time
console.log that reports the Y distribution:

```javascript
if (schedule.length > 0) {
  const ys = schedule.map(s => s.gapY);
  const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  console.log(`[PIPES] Schedule: ${schedule.length} pipes | gapY range: ${minY.toFixed(0)}-${maxY.toFixed(0)} | avg: ${avgY.toFixed(0)}`);
}
```

This makes it easy to verify the fix worked (avgY should be ~200-280, not 400+).

---

## Verification Criteria

After implementing all fixes, the following should be true:

1. **Console output** `[DOTS] initGame — beatDots: >0` confirms dots are generated
2. **Console output** `[PIPES] gapY range:` shows min ~60, max ~400, avg ~200-280
3. **Visual**: Both top AND bottom pipe halves are visible on screen
4. **Visual**: Pipe gaps are distributed across the full screen height, not clustered at the bottom
5. **Visual**: Beat dots appear along the predicted flight path
6. **Visual**: No debug overlay in bottom-left corner
7. **Gameplay**: Pipes have varied spacing that feels musical, not mechanical
8. **Gameplay**: The bird's natural flight path roughly follows the dot path

---

## Files Modified

| File | Changes |
|------|---------|
| `src/game/beatMapper.js` | Fix FLAP_VEL (→-9.0), fix speed (→2.6), improve synthetic analysis, optional center bias |
| `src/renderer.js` | Remove debug overlay |
| `src/SpotifyFlappy.jsx` | Remove debug console.logs |

---

## Notes

- The **chalk theme** (green background, dashed pipe outlines) is NOT a bug — it's the
  user's selected theme. The dashed outlines are intentional chalk-style rendering.
- The Spotify audio-features and audio-analysis API endpoints return 403 ("Invalid token
  scopes"). This may be a temporary auth issue or indicate Spotify has deprecated these
  endpoints. The synthetic fallback ensures the game works regardless.
- If the Spotify API starts working again, the real analysis data will be used automatically
  (the synthetic fallback only activates when the API fails).
