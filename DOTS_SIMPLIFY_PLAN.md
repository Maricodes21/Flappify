# Dot System Simplification Plan

## Goal
Keep ONLY the gold/yellow downbeat dots. Remove all blue (non-downbeat) dots.
Ensure dots are positioned safely between pipes so collecting them doesn't
cause the player to crash into the next pipe. Fix the scroll-right bug where
dots drift right before any pipes have spawned.

---

## Current State (What Exists Now)

### Two dot types:
- **Yellow (gold)**: `isDownbeat === true` — spawns on bar starts (every 4 beats at 4/4 time). Color `#FFD700`. Larger radius (10px base). Has double-ring indicator.
- **Blue (cyan)**: `isDownbeat === false` — spawns on EVERY other beat. Color `#00f0ff`. Smaller radius (7px base). No double ring.

At 120 BPM, there's a dot every 0.5s. Only every 4th dot (every 2s) is a downbeat/yellow. With the synthetic data, that means ~208 dots total but only ~52 are yellow/downbeat.

### The scroll-right bug:
In `renderer.js` line 210:
```javascript
const _dotSpeed = g.speed > 0 ? (g.pipesSpawned <= 5 ? g.speed * (0.8 + g.pipesSpawned * 0.04) : g.speed) : 0;
```
When `g.pipesSpawned === 0`, the speed multiplier is `0.8 + 0 * 0.04 = 0.8`, which is fine.
But the real issue is that `g.gt` starts at 0 and stays at 0 during idle/countdown until the phase switches to "playing" (SpotifyFlappy.jsx line 536: `gsRef.current.gt = 0`). During this time, dots with `time > 0` compute positive screen X values, meaning they appear to the RIGHT of the bird. Once `g.gt` starts advancing (music plays), the dots suddenly start scrolling left. The visual effect is dots appearing to "scroll right" during the countdown because `gt` isn't advancing yet but the dots are positioned based on `(dot.time - gt)` with gt stuck at 0.

### The pipe-safety problem:
Currently, dots spawn on EVERY beat (including beats that coincide with pipe spawns). Downbeat dots can land right ON a pipe or just before one. When the player taps to collect a dot, the flap changes their trajectory, potentially sending them into the next pipe's solid section.

---

## Fix Plan

### Step 1: Filter beatDots to downbeat-only in `beatMapper.js`

**File:** `src/game/beatMapper.js`, Beat Dots Generation section (~line 336-360)

Replace the current loop that generates a dot for every beat with one that only generates dots for downbeats. Since we're removing blue dots entirely, every dot in the array will be a downbeat.

**Change from:**
```javascript
const beatDots = [];
for (let i = 0; i < beats.length; i++) {
    const bt = beats[i].start;
    if (i < 1) continue;

    const arrivalTime = bt + pipeScrollTime;
    const dotY = getPredictedY(arrivalTime) - 40;
    const clampedY = Math.max(30, Math.min(GROUND - 30, dotY));

    const isDownbeat = barStarts.has(bt) ||
        bars.some(b => Math.abs(b.start - bt) < 0.05);

    beatDots.push({
        time: bt,
        y: clampedY,
        beatType: beatTypes[i] || "other",
        isDownbeat,
    });
}
```

**Change to:**
```javascript
const beatDots = [];
for (let i = 0; i < beats.length; i++) {
    const bt = beats[i].start;
    if (i < 1) continue;

    const isDownbeat = barStarts.has(bt) ||
        bars.some(b => Math.abs(b.start - bt) < 0.05);

    // Only generate dots for downbeats (gold checkpoints)
    if (!isDownbeat) continue;

    // ── Pipe-safety check ──
    // Find the nearest pipe in the schedule to this dot's time.
    // If a pipe spawns within ±1 beat of this dot, shift the dot's Y
    // to sit inside that pipe's gap so the player doesn't have to
    // choose between collecting the dot and surviving the pipe.
    let safeDotY;
    const arrivalTime = bt + pipeScrollTime;
    const predictedY = getPredictedY(arrivalTime) - 40;

    // Find the closest pipe to this beat time
    let closestPipe = null;
    let closestDist = Infinity;
    for (const p of schedule) {
        const dist = Math.abs(p.time - bt);
        if (dist < closestDist) {
            closestDist = dist;
            closestPipe = p;
        }
    }

    if (closestPipe && closestDist < beatDuration * 2) {
        // Dot is near a pipe — place the dot INSIDE the pipe's gap
        // (vertically centered in the gap opening so the player can
        // safely fly through and collect it)
        const gapCenter = closestPipe.gapY + closestPipe.gapSize / 2;
        safeDotY = gapCenter;
    } else {
        // No nearby pipe — use the predicted flight path Y
        safeDotY = predictedY;
    }

    const clampedY = Math.max(30, Math.min(GROUND - 30, safeDotY));

    beatDots.push({
        time: bt,
        y: clampedY,
        beatType: beatTypes[i] || "other",
        isDownbeat: true, // always true now
    });
}
```

### Step 2: Simplify renderer to gold-only visuals in `renderer.js`

**File:** `src/renderer.js`, the dot rendering section (~line 199-375)

Since all dots are now downbeats, simplify the color logic:

2a. Remove the blue/cyan color branch. Hardcode gold everywhere:
   - Line 265: `const color = "#FFD700";`  (remove the ternary)
   - Line 266: `const colorRgb = "255,215,0";`  (remove the ternary)

2b. Remove the `isDown` conditional check for double-ring (line 352-361).
    Since all dots are downbeats, always draw the double ring.

2c. Change the pathway line color from cyan to gold:
   - Line 246: `ctx.strokeStyle = "#FFD700";` (was `"#00f0ff"`)

2d. Simplify the radius calculation:
   - Line 297: `const R = 10 + pulse * 1.5 + beatPulse;` (remove the isDown ternary)

2e. Clean up float text colors in the flap handler (`SpotifyFlappy.jsx`):
   - Lines 372, 378: Since all dots are downbeats, the ternaries that choose
     between gold/cyan can be simplified to always use `"#FFD700"`.

### Step 3: Fix the scroll-right bug in `renderer.js`

**File:** `src/renderer.js`, line 212 area

The dots should NOT render during idle or countdown phases. Add a phase check
so dots only appear once gameplay starts and `g.gt` is actually advancing:

**Change from:**
```javascript
if (g.beatDots && g.beatDots.length > 0 && _dotSpeed > 0) {
```

**Change to:**
```javascript
if (g.beatDots && g.beatDots.length > 0 && _dotSpeed > 0 && curPhase === "playing") {
```

This prevents dots from appearing during idle/countdown when `g.gt` is stuck
at 0, which was causing the "dots scroll to the right" visual bug.

### Step 4: Clean up the flap handler for downbeat-only scoring

**File:** `src/SpotifyFlappy.jsx`, flap handler (~line 333-395)

Since all dots are now downbeats, simplify the scoring:

4a. The PERFECT/GREAT/GOOD scoring logic can remove the `isDownbeat` ternary.
    All dots are downbeats, so always use the higher point values:
    - PERFECT: 200 pts (line 369)
    - GREAT: 100 pts (line 383)
    - GOOD: 25 pts (line 388)

4b. Float text: simplify from `isDownbeat ? "PERFECT! x2" : "PERFECT!"` to
    just `"PERFECT!"`. Similarly for particles color — always `"#FFD700"`.

4c. These are cosmetic simplifications. The actual collection logic
    (proximity search, dx thresholds) stays the same.

---

## Files Modified

| File | What Changes |
|------|-------------|
| `src/game/beatMapper.js` | Filter dots to downbeat-only + pipe-gap-safe Y positioning |
| `src/renderer.js` | Gold-only colors, remove blue branches, add `curPhase === "playing"` gate |
| `src/SpotifyFlappy.jsx` | Simplify flap handler scoring to downbeat-only values |

## Verification

After implementing:
1. Only gold/yellow circles should appear during gameplay — NO blue/cyan circles
2. Dots should NOT appear during the countdown or idle screen
3. Dots near pipes should visually sit inside the pipe gap opening
4. Tapping to collect a dot should not force the player into a pipe
5. The pathway dashed line (if kept) should be gold, not cyan
6. Float text on collection should always be gold-themed
