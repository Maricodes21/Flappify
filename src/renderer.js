import { getActiveTheme } from "./game/ThemeEngine";
import { getSetting } from "./services/storage";
import { GAME_HEIGHT as H, GAME_WIDTH as W } from "./game/dimensions";
import { calculateFlightAccuracy, calculateRhythmPoints, calculateSongProgress, calculateTotalScore } from "./game/scoring";
import { eventXAt, visibleTimeWindow } from "./game/transport";

const PIPE_W = 54, BIRD_R = 15;

export function drawGame(ctx, g, pal, f, curPhase, bestRef, isPaused, activeSprite, albumImg) {
  const [pr, pgc, pb] = pal.rgb || [29, 185, 84];
  const theme = getActiveTheme();

  const shx = g.shake * (Math.random() - 0.5);
  const shy = g.shake * (Math.random() - 0.5);
  ctx.save();
  ctx.translate(shx, shy);

  // ── Kick-Driven Background Scale (disabled — keeping lighting only) ──
  const kickScale = 1; // no longer scaling canvas on beats

  // ── Background (theme-delegated) ──────────────────────────
  theme.drawBackground(ctx, W, H, g, pal, g.beatFlash);

  // Death red flash
  if (g.dFlash > 0.01) {
    ctx.fillStyle = `rgba(255,0,0,${g.dFlash * 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Off-Beat Desaturation ─────────────────────────────────
  // When player taps off-beat, momentarily desaturate the screen
  if ((g.offBeatFlash || 0) > 0.01) {
    ctx.globalAlpha = g.offBeatFlash * 0.45;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, W, H);
    // Vignette effect
    const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    vigGrad.addColorStop(0, "transparent");
    vigGrad.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Chroma flash for a high pipe combo
  if ((g.chromaFlash || 0) > 0.01) {
    const chromaHue = (performance.now() / 5) % 360;
    ctx.globalAlpha = g.chromaFlash * 0.12;
    ctx.fillStyle = `hsl(${chromaHue}, 100%, 60%)`;
    ctx.fillRect(0, 0, W, H);
    // Edge glow bars
    const edgeGrad = ctx.createLinearGradient(0, 0, 0, H);
    edgeGrad.addColorStop(0, `hsla(${chromaHue}, 100%, 70%, ${g.chromaFlash * 0.3})`);
    edgeGrad.addColorStop(0.5, "transparent");
    edgeGrad.addColorStop(1, `hsla(${(chromaHue + 180) % 360}, 100%, 70%, ${g.chromaFlash * 0.3})`);
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, 4, H);
    ctx.fillRect(W - 4, 0, 4, H);
    ctx.globalAlpha = 1;
  }

  // ── "Drop" GET READY Banner ───────────────────────────────
  if ((g.dropReadyTimer || 0) > 0) {
    const readyAlpha = Math.min(1, g.dropReadyTimer * 2);
    ctx.globalAlpha = readyAlpha * 0.7;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, H / 2 - 40, W, 80);
    ctx.globalAlpha = readyAlpha;
    ctx.font = "bold 28px Orbitron, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFD700";
    ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 20;
    ctx.fillText("GET READY!", W / 2, H / 2 + 10);
    ctx.shadowBlur = 0;
    ctx.font = "10px Space Mono, monospace";
    ctx.fillStyle = "rgba(255,215,0,0.6)";
    ctx.fillText("DROP INCOMING", W / 2, H / 2 + 30);
    ctx.globalAlpha = 1;
  }

  // Parallax layers
  g.par.forEach((layer, li) => {
    ctx.globalAlpha = 0.08 + li * 0.06;
    ctx.fillStyle = pal.bright;
    layer.pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
  });
  ctx.globalAlpha = 1;

  // Stars
  g.stars.forEach(s => {
    s.tw += 0.02 * s.speed;
    const a = 0.2 + 0.5 * (Math.sin(s.tw) * 0.5 + 0.5) + g.beatFlash * 0.4;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = pal.bright;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (1 + g.beatFlash * 0.6), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Beat pulse
  if (g.beatFlash > 0.05) {
    const rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
    rg.addColorStop(0, `rgba(${pr},${pgc},${pb},${g.beatFlash * 0.08})`);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  // Shockwaves
  g.shockwaves.forEach(s => {
    ctx.globalAlpha = s.life * 0.7;
    ctx.strokeStyle = pal.bright; ctx.lineWidth = 2.5;
    ctx.shadowColor = pal.bright; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;

  // Particles
  g.particles.forEach(p => {
    ctx.globalAlpha = p.life * 0.85;
    ctx.shadowColor = p.color || pal.bright; ctx.shadowBlur = 6;
    ctx.fillStyle = p.color || pal.bright;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;

  // Ceiling indicator
  ctx.globalAlpha = 0.3;
  ctx.shadowColor = pal.bright; ctx.shadowBlur = 8;
  ctx.fillStyle = pal.bright;
  ctx.fillRect(0, 0, W, 1);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // ── Pipes (theme-delegated) with anticipation glow ────────
  g.pipes.forEach(p => {
    // Anticipation glow: pipes glow brighter 1/4 beat before passing
    const distToBird = p.x - g.bird.x;
    const quarterBeatDist = (g.speed || 3) * (g.beatDuration || 0.5) * 60 * 0.25;
    let anticipation = 0;
    if (distToBird > 0 && distToBird < quarterBeatDist * 2) {
      anticipation = 1 - (distToBird / (quarterBeatDist * 2));
    }

    // Combine beatGlow with anticipation
    const combinedGlow = Math.max(p.beatGlow || 0, anticipation * 0.7);

    theme.drawPipe(ctx, p.x, p.gy, p.gap, PIPE_W, combinedGlow, pal, { H });

    // A two-tone gap edge remains readable even when album colors are close
    // to the active theme background.
    ctx.save();
    ctx.lineCap = "round";
    [p.gy, p.gy + p.gap].forEach(edgeY => {
      ctx.beginPath();
      ctx.moveTo(p.x - 1, edgeY);
      ctx.lineTo(p.x + PIPE_W + 1, edgeY);
      ctx.strokeStyle = "rgba(0,0,0,0.82)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.62)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.restore();

    // Downbeat pipe indicator: gold glow ring
    if (p.isDownbeat && combinedGlow > 0.1) {
      ctx.globalAlpha = combinedGlow * 0.5;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 12;
      ctx.strokeRect(p.x - 3, p.gy - 16, PIPE_W + 6, 4);
      ctx.strokeRect(p.x - 3, p.gy + p.gap + 12, PIPE_W + 6, 4);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Anticipation pulse: glowing edge lines approaching pipes
    if (anticipation > 0.3) {
      ctx.globalAlpha = (anticipation - 0.3) * 0.6;
      ctx.strokeStyle = pal.bright;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = pal.bright; ctx.shadowBlur = 8;
      // Glow line at gap edges
      ctx.beginPath();
      ctx.moveTo(p.x, p.gy); ctx.lineTo(p.x + PIPE_W, p.gy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.gy + p.gap); ctx.lineTo(p.x + PIPE_W, p.gy + p.gap);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Drop zone pipes: x5 glow indicator
    if (p.isDropPipe) {
      ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 100) * 0.2;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 16;
      ctx.strokeRect(p.x - 1, p.gy - 2, PIPE_W + 2, p.gap + 4);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  });
  // ══════════════════════════════════════════════════════════
  // ── TRAIL DOTS — path-following secondary rhythm guide ──
  // ══════════════════════════════════════════════════════════
  // One dot per non-downbeat. Y follows the gold beatDot path curve
  // (smooth-stepped interpolation). Beat-pulsed teal/cyan ring style.
  // Clearly distinct from gold checkpoint dots — secondary role.
  ctx.save();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const _dotSpeed = g.speed > 0 ? g.speed : 0;
  const _dotLevelFade = g.visualStartTime
    ? Math.max(0, Math.min(1, (performance.now() - g.visualStartTime) / 500))
    : 1;

  if (g.trailDots && g.trailDots.length > 0 && _dotSpeed > 0 && getSetting("showTrailDots", true) && curPhase === "playing") {
    const bx = g.bird.x;
    const gt = g.gt || 0;
    const now2 = performance.now();
    const beatGlow2 = g._dotBeatGlow || 0; // same beat pulse source as gold dots

    const TRAIL_COLOR     = "80,220,255";  // soft cyan/teal — distinct from gold
    const TRAIL_COLOR_HEX = "#50dcff";

    const trailWindow = visibleTimeWindow(gt, _dotSpeed, bx, -80, W + 80);
    const timeLeft2 = trailWindow.start;
    const timeRight2 = trailWindow.end;

    // Binary search start index
    let tlo = 0, thi = g.trailDots.length - 1;
    while (tlo < thi) {
      const tmid = (tlo + thi) >> 1;
      if (g.trailDots[tmid].time < timeLeft2) tlo = tmid + 1;
      else thi = tmid;
    }

    const trailCollected = g._trailCollected || new Set();
    const trailFlashing = g._trailFlashing || {};

    for (let i = tlo; i < g.trailDots.length; i++) {
      const td = g.trailDots[i];
      if (td.time > timeRight2) break;

      const sx = eventXAt(td.time, gt, _dotSpeed, bx);
      const sy = td.y;

      const flashTimer = trailFlashing[i];

      // Skip rendering if already collected and the flash animation is done
      if (trailCollected.has(i) && flashTimer === undefined) continue;

      // Smooth right-edge fade-in: 0 at W+60, full at W-120
      const fadeIn = Math.max(0, Math.min(1, (W + 60 - sx) / 180)) * _dotLevelFade;
      if (fadeIn <= 0) continue;

      if (flashTimer !== undefined) {
        // ── Dissolve / Pop animation upon collection ──
        // flashTimer starts at 0.45 and counts down to 0
        const progress = 1 - (flashTimer / 0.45); // 0.0 to 1.0
        const R = 5.5 + progress * 20; // expands outward
        const alpha = Math.max(0, 1 - progress) * 0.8; // fades out

        ctx.globalAlpha = alpha * fadeIn;
        ctx.strokeStyle = TRAIL_COLOR_HEX;
        ctx.lineWidth = 2.5 * (1 - progress);
        ctx.shadowColor = TRAIL_COLOR_HEX;
        ctx.shadowBlur = 10 * (1 - progress);
        
        ctx.beginPath();
        ctx.arc(sx, sy, R, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        continue;
      }

      // ── Normal Idle Rendering ──
      // Beat pulse: gentle scale and glow on each beat
      // Uses a slower sine than gold dots so it feels calmer
      const pulse = Math.sin(now2 / 350 + i * 0.9) * 0.5 + 0.5;
      const beatBoost = beatGlow2 * 0.6;  // less aggressive than gold (0.6× vs 3×)
      const R = 5.5 + pulse * 2 + beatBoost * 4;  // base 5.5 vs gold's 10+

      // Proximity to bird: trail dots glow up as bird approaches
      const dx = Math.abs(bx - sx);
      const prox = Math.max(0, Math.min(1, 1 - (dx - 20) / 160));

      // ─ Outer radial glow (subtle) ─
      const glowA = (0.04 + prox * 0.12 + beatBoost * 0.08) * fadeIn;
      const tGlowGrad = ctx.createRadialGradient(sx, sy, R * 0.3, sx, sy, R * 3);
      tGlowGrad.addColorStop(0, `rgba(${TRAIL_COLOR},${glowA})`);
      tGlowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = tGlowGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, R * 3, 0, Math.PI * 2);
      ctx.fill();

      // ─ Core ring (the main visual) ─
      ctx.globalAlpha = (0.35 + prox * 0.35 + beatBoost * 0.2 + pulse * 0.1) * fadeIn;
      ctx.strokeStyle = TRAIL_COLOR_HEX;
      ctx.lineWidth   = 1.8 + beatBoost * 1.5;
      ctx.shadowColor = TRAIL_COLOR_HEX;
      ctx.shadowBlur  = 6 + prox * 8 + beatBoost * 6;
      ctx.beginPath();
      ctx.arc(sx, sy, R, 0, Math.PI * 2);
      ctx.stroke();

      // ─ Tiny centre fill — gives it a pearl-like core ─
      ctx.globalAlpha = (0.2 + prox * 0.3 + beatBoost * 0.25) * fadeIn;
      ctx.fillStyle = TRAIL_COLOR_HEX;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(sx, sy, R * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // ─ Outer pulse ring on beat flash ─
      if (beatBoost > 0.1) {
        ctx.globalAlpha = beatBoost * 0.4 * fadeIn;
        ctx.strokeStyle = TRAIL_COLOR_HEX;
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 4;
        ctx.beginPath();
        ctx.arc(sx, sy, R + 5 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // ══════════════════════════════════════════════════════════
  // ── PLAYABLE PULSES — every visible dot is a legal input ─
  // ══════════════════════════════════════════════════════════
  // Only renders during active gameplay (curPhase === "playing") to prevent
  // the scroll-right visual bug during idle/countdown when g.gt is stuck at 0.
  // Cyan pulses carry the phrase; gold double-rings mark downbeats.
  ctx.save();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  if (g.beatDots && g.beatDots.length > 0 && _dotSpeed > 0 && curPhase === "playing") {
    const bx = g.bird.x;
    const gt = g.gt || 0;
    const now = performance.now();
    const beatGlow = g._dotBeatGlow || 0;
    const collected = g._collectedDots || new Set();
    const flashing = g._flashingDots || {};

    const DOWNBEAT_COLOR = "#FFD700";
    const PULSE_COLOR = "#66e7ff";

    // ── Gather visible dots via binary search ─────────────
    const beatWindow = visibleTimeWindow(gt, _dotSpeed, bx, -60, W + 120);
    const timeLeft = beatWindow.start;
    const timeRight = beatWindow.end;

    let lo = 0, hi = g.beatDots.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (g.beatDots[mid].time < timeLeft) lo = mid + 1;
      else hi = mid;
    }

    const visible = [];
    for (let i = lo; i < g.beatDots.length; i++) {
      const dot = g.beatDots[i];
      if (dot.time > timeRight) break;
      const sx = eventXAt(dot.time, gt, _dotSpeed, bx);
      visible.push({
        time: dot.time,
        y: dot.y,
        sx,
        idx: i,
        isDownbeat: dot.isDownbeat,
        isSubdivision: dot.isSubdivision,
      });
    }

    // A single restrained rhythm ribbon clarifies the intended flight line
    // without introducing another set of objects that look tappable.
    const upcoming = visible.filter(dot => dot.sx >= bx - 4 && !collected.has(dot.idx));
    if (upcoming.length && getSetting("showTrailingLine", true)) {
      ctx.save();
      ctx.globalAlpha = 0.24 * _dotLevelFade;
      ctx.strokeStyle = PULSE_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 8]);
      ctx.shadowColor = PULSE_COLOR;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(bx, g.bird.y);
      for (const point of upcoming) ctx.lineTo(point.sx, point.y);
      ctx.stroke();
      ctx.restore();
    }

    // ── Draw each playable pulse ───────────────────────────
    for (const dot of visible) {
      const sx  = dot.sx;
      const sy  = dot.y;
      const idx = dot.idx;
      const isDownbeat = dot.isDownbeat;
      const COLOR = isDownbeat ? DOWNBEAT_COLOR : PULSE_COLOR;
      const COLOR_RGB = isDownbeat ? "255,215,0" : "102,231,255";

      // Fade in from right screen edge so dots don't pop in abruptly
      const rightEdgeFade = Math.max(0, Math.min(1, (W + 60 - sx) / 200)) * _dotLevelFade;
      if (rightEdgeFade <= 0) continue;

      // ─ Flash animation (just collected) ─
      if (flashing[idx] !== undefined) {
        const ft = flashing[idx]; // 0.5 → 0
        const ring = 12 + (0.5 - ft) * 40;
        ctx.globalAlpha = Math.max(0, ft * 2);
        ctx.strokeStyle = COLOR;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLOR;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(sx, sy, ring, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        continue;
      }

      // ─ Skip fully collected dots ─
      if (collected.has(idx)) continue;

      // Time-based approach fill remains stable across screen speeds.
      const timeUntil = dot.time - gt;
      const approachTime = g.approachTime || 1.9;
      const fill = Math.max(0, Math.min(1, 1 - timeUntil / approachTime));

      // Pulse on the beat + proximity-driven size
      const pulse    = Math.sin(now / 300 + idx * 0.7) * 0.5 + 0.5;
      const beatPulse = beatGlow * 3;
      const R = (isDownbeat ? 11 : dot.isSubdivision ? 7.5 : 8.5) + pulse * 1.2 + beatPulse;

      // ─ Outer radial glow ─
      const glowAlpha = (0.08 + fill * 0.28 + beatGlow * 0.15) * rightEdgeFade;
      const glowGrad  = ctx.createRadialGradient(sx, sy, R * 0.3, sx, sy, R * 3.5);
      glowGrad.addColorStop(0, `rgba(${COLOR_RGB},${glowAlpha})`);
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, R * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // ─ Outer ring ─
      ctx.globalAlpha = (0.5 + fill * 0.4 + beatGlow * 0.1) * rightEdgeFade;
      ctx.strokeStyle = COLOR;
      ctx.lineWidth   = 2 + beatGlow * 1.5;
      ctx.shadowColor = COLOR;
      ctx.shadowBlur  = 4 + fill * 12 + beatGlow * 8;
      ctx.beginPath();
      ctx.arc(sx, sy, R, 0, Math.PI * 2);
      ctx.stroke();

      // ─ Inner fill sweep (the core proximity mechanic) ─
      if (fill > 0.02) {
        const fillR = (R - 2) * fill;
        if (fill < 0.95) {
          // Clockwise sweep from top — "loading ring" effect
          ctx.globalAlpha = (0.6 + fill * 0.4) * rightEdgeFade;
          ctx.fillStyle   = COLOR;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, fillR, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
          ctx.closePath();
          ctx.fill();
        } else {
          // Fully filled — solid gold with bright glow
          ctx.globalAlpha = 1 * rightEdgeFade;
          ctx.fillStyle   = COLOR;
          ctx.shadowColor = COLOR;
          ctx.shadowBlur  = 20;
          ctx.beginPath();
          ctx.arc(sx, sy, R - 1, 0, Math.PI * 2);
          ctx.fill();
          // White specular highlight
          ctx.globalAlpha = 0.7 * rightEdgeFade;
          ctx.fillStyle   = "#fff";
          ctx.beginPath();
          ctx.arc(sx - R * 0.25, sy - R * 0.25, R * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Downbeats receive the only double ring, preserving a clear hierarchy.
      if (isDownbeat) {
        ctx.globalAlpha = (0.3 + pulse * 0.2 + beatGlow * 0.2) * rightEdgeFade;
        ctx.strokeStyle = COLOR;
        ctx.lineWidth   = 1.2;
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(sx, sy, R + 7 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ─ TAP hint when nearly full ─
      if (fill > 0.7 && fill < 0.98) {
        ctx.globalAlpha = (fill - 0.7) * 3.3 * rightEdgeFade;
        ctx.font        = "bold 8px Orbitron, monospace";
        ctx.textAlign   = "center";
        ctx.fillStyle   = COLOR;
        ctx.shadowColor = COLOR;
        ctx.shadowBlur  = 8;
        ctx.fillText("TAP", sx, sy - R - 6);
      }
    }
  }

  // Reset canvas state completely
  ctx.restore();

  // (kick scale transform removed — no extra restore needed)

  // ── Bird trail (Overdrive mode → vibrant light stream) ────
  const inOverdrive = (g.perfectStreak || 0) >= 5;
  g.bird.trail.forEach((t, i) => {
    const trailProg = i / g.bird.trail.length;
    if (inOverdrive) {
      // Overdrive: vibrant rainbow trail
      const hue = (performance.now() / 8 + i * 30) % 360;
      ctx.globalAlpha = 0.3 + trailProg * 0.4;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 10;
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BIRD_R * 0.7 * trailProg, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const a = trailProg * 0.35;
      const r2 = BIRD_R * 0.55 * trailProg;
      ctx.globalAlpha = a;
      ctx.shadowColor = pal.bright; ctx.shadowBlur = 4;
      ctx.fillStyle = pal.bright;
      ctx.beginPath(); ctx.arc(t.x, t.y, r2, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // Bird
  const { bird } = g;
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate((bird.angle * Math.PI) / 180);

  // Overdrive outer glow
  if (inOverdrive) {
    const hue = (performance.now() / 10) % 360;
    ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 150) * 0.15;
    const overGrad = ctx.createRadialGradient(0, 0, BIRD_R, 0, 0, BIRD_R * 2.5);
    overGrad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.4)`);
    overGrad.addColorStop(1, "transparent");
    ctx.fillStyle = overGrad;
    ctx.beginPath(); ctx.arc(0, 0, BIRD_R * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (activeSprite && activeSprite.draw) {
    activeSprite.draw(ctx, 0, 0, BIRD_R, bird.pulse, pal, albumImg);
  } else {
    // Fallback: classic orb
    const br2 = BIRD_R * (1 + bird.pulse * 0.22);
    const og = ctx.createRadialGradient(0, 0, br2 * 0.4, 0, 0, br2 * 3);
    og.addColorStop(0, `rgba(${pr},${pgc},${pb},0.35)`);
    og.addColorStop(1, "transparent");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(0, 0, br2 * 3, 0, Math.PI * 2); ctx.fill();

    const bGrad = ctx.createRadialGradient(-3, -3, 1, 0, 0, br2);
    bGrad.addColorStop(0, pal.bright);
    bGrad.addColorStop(0.6, pal.base);
    bGrad.addColorStop(1, pal.dark);
    ctx.fillStyle = bGrad;
    ctx.shadowColor = pal.glow; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, 0, br2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 0.35; ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(-3, -4, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(5, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(5.8, -3.5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(6.5, -2.8, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  // ── Beat Shield Indicator ──────────────────────────────────
  // When beat shield is active, show a soft cyan ring around the bird
  if ((g.beatShield || 0) > 0 && curPhase === "playing") {
    const shieldAlpha = Math.min(1, g.beatShield * 8);
    ctx.globalAlpha = shieldAlpha * 0.45;
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Pop-Art theme: bold outline on bird
  if (theme.pipeOutline) {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R * (1 + bird.pulse * 0.22) + 1, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ── Ground (theme-delegated) ──────────────────────────────
  theme.drawGround(ctx, W, H, g, pal);

  // Visualizer
  const vw = W / g.viz.length;
  g.viz.forEach((v, i) => {
    const h = Math.max(3, v.h);
    const barGrad = ctx.createLinearGradient(0, H - 68, 0, H - 68 - h);
    barGrad.addColorStop(0, `rgba(${pr},${pgc},${pb},0.7)`);
    barGrad.addColorStop(0.6, pal.base);
    barGrad.addColorStop(1, pal.bright);
    ctx.fillStyle = barGrad;
    ctx.fillRect(i * vw + 1, H - 68 - h, vw - 2, h);
  });

  // ── Overdrive Mode indicator ──────────────────────────────
  if (inOverdrive && curPhase === "playing") {
    const overHue = (performance.now() / 12) % 360;
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 200) * 0.3;
    ctx.font = "bold 10px Orbitron, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = `hsl(${overHue}, 100%, 70%)`;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.fillText("★ OVERDRIVE ★", W / 2, 108);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ── Combo Meter Bar ───────────────────────────────────────
  if (curPhase === "playing" && (g.perfectStreak || 0) > 0) {
    const meterW = 80, meterH = 3;
    const meterX = W / 2 - meterW / 2, meterY = 115;
    const fill = Math.min(1, (g.perfectStreak || 0) / 5);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(meterX, meterY, meterW, meterH);
    const meterGrad = ctx.createLinearGradient(meterX, 0, meterX + meterW, 0);
    meterGrad.addColorStop(0, pal.bright);
    meterGrad.addColorStop(1, "#00f0ff");
    ctx.fillStyle = meterGrad;
    ctx.fillRect(meterX, meterY, meterW * fill, meterH);
    ctx.globalAlpha = 0.35;
    ctx.font = "7px Space Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#aaa";
    ctx.fillText(`${g.perfectStreak}/5 OVERDRIVE`, W / 2, meterY + 10);
    ctx.globalAlpha = 1;
  }

  // ── HUD — Calculated Score (amber = achievement color) ───────────────
  ctx.shadowColor = "rgba(245,166,35,0.5)"; ctx.shadowBlur = 18;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 44px Orbitron, monospace";
  ctx.textAlign = "center";
  const liveTotal = calculateTotalScore(g);
  ctx.fillText(liveTotal.toLocaleString(), W / 2, 56);
  ctx.shadowBlur = 0;

  // Combo counter
  if (g.combo >= 3) {
    const comboSize = g.combo >= 1000 ? 11 : g.combo >= 100 ? 13 : 16;
    ctx.font = `bold ${comboSize}px Orbitron, monospace`;
    ctx.fillStyle = g.combo >= 10 ? "#FFD700" : pal.bright;
    ctx.shadowColor = g.combo >= 10 ? "#FFD700" : pal.glow;
    ctx.shadowBlur = 10;
    ctx.fillText(`×${g.combo}`, W / 2, 78);
    ctx.shadowBlur = 0;
  }

  // Floating texts
  g.floats.forEach(ft => {
    const gradeMatch = /^(PERFECT|GREAT|GOOD)(?=\b|\s|[+×★])/i.exec(ft.text);
    if (gradeMatch && !getSetting("showGrades", true)) return;
    ctx.globalAlpha = Math.min(1, ft.life);
    ctx.font = `bold ${ft.size}px Orbitron, monospace`;
    ctx.textAlign = "center";
    const colorblindMode = getSetting("colorblindMode", false);
    const gradeColors = { PERFECT: "#56B4E9", GREAT: "#E69F00", GOOD: "#CC79A7" };
    const accessibleColor = gradeMatch && colorblindMode ? gradeColors[gradeMatch[1].toUpperCase()] : null;
    const gradeSymbols = { PERFECT: "●", GREAT: "▲", GOOD: "■" };
    const label = gradeMatch && colorblindMode
      ? `${gradeSymbols[gradeMatch[1].toUpperCase()]} ${ft.text}`
      : ft.text;
    ctx.fillStyle = accessibleColor || ft.color;
    ctx.shadowColor = accessibleColor || ft.color;
    ctx.shadowBlur = 8;
    ctx.fillText(label, ft.x, ft.y);
    ctx.shadowBlur = 0;

    // Pop-Art: trigger ZAP/POW for perfect grades
    if (theme.onPerfect && ft.text === "PERFECT" && ft.life > 1.1) {
      theme.onPerfect(ctx, ft.x + 50, ft.y - 10, pal);
    }
  });
  ctx.globalAlpha = 1;

  // Idle overlay
  if (curPhase === "idle") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "bold 24px Orbitron, monospace";
    ctx.shadowColor = pal.glow; ctx.shadowBlur = 24;
    ctx.fillStyle = "#fff";
    ctx.fillText("TAP TO FLY", W / 2, H / 2 - 10);
    ctx.shadowBlur = 0;
    ctx.font = "12px Space Mono, monospace";
    ctx.fillStyle = pal.base;
    ctx.fillText("RIDE THE BEAT", W / 2, H / 2 + 28);
  }

  // Keep the countdown on screen through audio startup, then fade it into play.
  const goFade = curPhase === "playing" && g.goStartedAt && !isPaused
    ? Math.max(0, 1 - Math.max(0, g.lastT - g.goStartedAt) / 350)
    : 0;
  if (curPhase === "countdown" || goFade > 0) {
    const opacity = goFade > 0 ? goFade : 1;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.45 * opacity})`;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";

    const countdownDuration = g.countdownDurationMs || 3000;
    const elapsedMs = Math.min(countdownDuration, g.countdownElapsedMs || 0);
    const remainingMs = Math.max(0, countdownDuration - elapsedMs);
    const beatNum = Math.max(1, Math.ceil(remainingMs / 1000));
    const beatFrac = remainingMs === 0 || goFade > 0 ? 1 : (elapsedMs % 1000) / 1000;
    const scale = 1 + (1 - beatFrac) * 0.4;

    // Pulsing ring synced to BPM
    const ringRadius = 60 + (1 - beatFrac) * 30;
    ctx.globalAlpha = opacity * (0.2 + (1 - beatFrac) * 0.3);
    ctx.strokeStyle = pal.bright;
    ctx.lineWidth = 3;
    ctx.shadowColor = pal.glow; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, ringRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);

    ctx.font = "bold 72px Orbitron, monospace";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = pal.glow; ctx.shadowBlur = 40;
    ctx.globalAlpha = opacity * (0.5 + beatFrac * 0.5);
    ctx.fillText(goFade > 0 ? "GO" : String(beatNum), 0, 24);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    if (!goFade) {
      ctx.font = "12px Space Mono, monospace";
      ctx.fillStyle = `rgba(${pr},${pgc},${pb},0.78)`;
      const waitingMs = g.lastT - g.countdownStartedAt - countdownDuration;
      ctx.fillText(g.countdownHolding && waitingMs > 250 ? "SYNCING MUSIC…" : "MUSIC READY", W / 2, H / 2 + 68);
    }
    ctx.restore();
  }

  // Spotify synchronization overlay. Gameplay remains frozen until the SDK
  // confirms that the requested track is actively playing.
  if (curPhase === "syncing" || curPhase === "sync-error") {
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";

    if (curPhase === "syncing") {
      const angle = (performance.now() / 650) % (Math.PI * 2);
      ctx.save();
      ctx.translate(W / 2, H / 2 - 52);
      ctx.rotate(angle);
      ctx.strokeStyle = pal.bright;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.shadowColor = pal.glow;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 1.45);
      ctx.stroke();
      ctx.restore();
    }

    ctx.font = "bold 22px Orbitron, monospace";
    ctx.fillStyle = curPhase === "sync-error" ? "#ff6680" : "#fff";
    ctx.shadowColor = curPhase === "sync-error" ? "#ff2244" : pal.glow;
    ctx.shadowBlur = 20;
    ctx.fillText(g.syncMessage || (curPhase === "syncing" ? "LOADING SPOTIFY" : "MUSIC DIDN'T START"), W / 2, H / 2 + 12);
    ctx.shadowBlur = 0;
    ctx.font = "12px Space Mono, monospace";
    ctx.fillStyle = curPhase === "sync-error" ? "#fff" : pal.base;
    ctx.fillText(g.syncDetail || (curPhase === "syncing" ? "WAITING FOR THE TRACK TO START…" : "TAP TO RETRY"), W / 2, H / 2 + 48);
  }

  // Results overlay
  if (curPhase === "dead" || curPhase === "completed") {
    const completed = curPhase === "completed";
    const resultColor = completed ? pal.bright : "#ff4466";
    const resultGlow = completed ? pal.glow : "#ff2244";
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";

    ctx.font = "900 36px Orbitron, monospace";
    ctx.shadowColor = resultGlow; ctx.shadowBlur = 28;
    ctx.fillStyle = resultColor;
    ctx.fillText(completed ? "LEVEL CLEARED" : "GAME OVER", W / 2, H / 2 - 140);
    ctx.shadowBlur = 0;

    const totalScore = g.totalScore || 0;
    ctx.font = "bold 42px Orbitron, monospace";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(245,166,35,0.6)"; ctx.shadowBlur = 16;
    ctx.fillText(totalScore.toLocaleString(), W / 2, H / 2 - 90);
    ctx.shadowBlur = 0;

    ctx.font = "11px Space Mono, monospace";
    ctx.fillStyle = "#f5a623";
    ctx.fillText("TOTAL POINTS", W / 2, H / 2 - 72);

    const bestScore = bestRef.current;
    if (g.isNewBest) {
      ctx.font = "bold 13px Orbitron, monospace";
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 12;
      ctx.fillText("★ NEW BEST! ★", W / 2, H / 2 - 54);
      ctx.shadowBlur = 0;
    } else if (bestScore > 0) {
      ctx.font = "12px Space Mono, monospace";
      ctx.fillStyle = "#9090a0";
      ctx.fillText(`BEST ${bestScore.toLocaleString()}`, W / 2, H / 2 - 54);
    }

    const pct = calculateSongProgress(g);
    const barW = 180, barH = 5, barX = (W - barW) / 2, barY = H / 2 - 36;
    ctx.fillStyle = "#1a1a28";
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill();
    const progGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    progGrad.addColorStop(0, pal.base); progGrad.addColorStop(1, pal.bright);
    ctx.fillStyle = progGrad;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * (pct / 100), barH, 3); ctx.fill();
    ctx.font = "bold 11px Space Mono, monospace";
    ctx.fillStyle = pal.bright;
    ctx.fillText(`${pct}% of song`, W / 2, barY + 16);

    ctx.font = "12px Space Mono, monospace";
    ctx.fillStyle = "#9090a0";
    const rhythmAccuracy = g.rhythmAccuracy || 0;

    const breakdownY = H / 2 + 4;

    // Rhythm accuracy
    ctx.textAlign = "left";
    ctx.fillStyle = "#9090a0";
    ctx.fillText("Rhythm:", W / 2 - 85, breakdownY);
    ctx.textAlign = "right";
    ctx.fillStyle = rhythmAccuracy >= 55 ? "#FFD700" : "#c0c0cc";
    ctx.fillText(`${rhythmAccuracy}%  ·  ${calculateRhythmPoints(g)} pts`, W / 2 + 85, breakdownY);

    ctx.textAlign = "left";
    ctx.fillStyle = "#9090a0";
    ctx.fillText("Flight:", W / 2 - 85, breakdownY + 22);
    ctx.textAlign = "right";
    ctx.fillStyle = "#aaa";
    ctx.fillText(`${g.flightAccuracy || 0}%  ·  ${g.totalPipes || 0} pts`, W / 2 + 85, breakdownY + 22);

    // Perfects and Misses
    ctx.textAlign = "center";
    ctx.font = "11px Space Mono, monospace";
    ctx.fillStyle = "#a0a0b0";
    ctx.fillText(`${g.rhythmPerfects || 0} PERFECT  ·  ${g.rhythmMisses || 0} MISS  ·  ${g.maxRhythmStreak || 0} STREAK`, W / 2, breakdownY + 50);

    const rating = g.rating || "D";
    const ratingColors = { S: "#FFD700", A: "#4ade80", B: "#60a5fa", C: "#f59e0b", D: "#888" };
    ctx.font = "bold 30px Orbitron, monospace";
    ctx.fillStyle = ratingColors[rating] || "#888";
    ctx.shadowColor = ratingColors[rating] || "#888";
    ctx.shadowBlur = 12;
    const stars = Math.max(0, Math.min(3, g.masteryStars || 0));
    ctx.fillText(`${rating}${stars ? `  ${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}` : ""}`, W / 2, breakdownY + 80);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px Space Mono, monospace";
    ctx.fillText(completed ? "NEXT SONG OR REPLAY BELOW" : "TAP TO RETRY", W / 2, breakdownY + 110);
  }

  // Pause overlay — now handled by HTML overlay in GameScreen (screens.jsx)
  // Canvas just dims slightly so the HTML overlay is readable
  if (isPaused && curPhase === "playing") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}
