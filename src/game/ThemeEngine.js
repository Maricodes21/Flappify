// ThemeEngine.js — Global Style Manager
// Defines 5 visual themes, each providing draw functions for background, pipes, ground, effects.
// Active theme can be swapped at runtime without restarting.

import { getSetting } from "../services/storage";

// ═══════════════════════════════════════════════════════════════
//  THEME: CLASSIC NEON (default — current look)
// ═══════════════════════════════════════════════════════════════
const classicNeon = {
  id: "classic",
  name: "Classic Neon",
  icon: "💚",
  description: "High-contrast green & black with neon glow",
  preview: { bg: "#050508", accent: "#1DB954", pipe: "#1DB954" },
  cssOverrides: {},

  drawBackground(ctx, W, H, g, pal, beatFlash) {
    const [pr, pg, pb] = pal.rgb || [29, 185, 84];
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, pal.deep);
    bgGrad.addColorStop(0.5, `rgba(${(pr * 0.08) | 0},${(pg * 0.08) | 0},${(pb * 0.08) | 0},1)`);
    bgGrad.addColorStop(1, "#000");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.globalAlpha = 0.035; ctx.strokeStyle = pal.bright; ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  },

  drawPipe(ctx, x, gy, gap, PIPE_W, beatGlow, pal, extra) {
    const [pr, pg, pb] = pal.rgb || [29, 185, 84];
    const H = extra?.H || 600;
    const glowIntensity = beatGlow || 0;

    const pGrad = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
    pGrad.addColorStop(0, `rgba(${(pr * 0.2) | 0},${(pg * 0.2) | 0},${(pb * 0.2) | 0},1)`);
    pGrad.addColorStop(0.35, pal.base);
    pGrad.addColorStop(0.65, pal.base);
    pGrad.addColorStop(1, `rgba(${(pr * 0.15) | 0},${(pg * 0.15) | 0},${(pb * 0.15) | 0},1)`);
    ctx.fillStyle = pGrad;
    ctx.fillRect(x, 0, PIPE_W, gy);
    ctx.fillRect(x, gy + gap, PIPE_W, H - gy - gap);

    ctx.shadowColor = pal.bright;
    ctx.shadowBlur = 8 + glowIntensity * 16;
    ctx.globalAlpha = 0.5 + glowIntensity * 0.5;
    ctx.strokeStyle = pal.bright;
    ctx.lineWidth = 1 + glowIntensity * 2;
    ctx.strokeRect(x, 0, PIPE_W, gy);
    ctx.strokeRect(x, gy + gap, PIPE_W, H - gy - gap);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    const capH = 14;
    ctx.fillStyle = pal.bright;
    ctx.shadowColor = pal.glow; ctx.shadowBlur = 10 + glowIntensity * 20;
    ctx.fillRect(x - 3, gy - capH, PIPE_W + 6, capH);
    ctx.fillRect(x - 3, gy + gap, PIPE_W + 6, capH);
    ctx.shadowBlur = 0;

    if (glowIntensity > 0.1) {
      ctx.globalAlpha = glowIntensity * 0.4;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
      ctx.strokeRect(x - 5, gy - capH - 2, PIPE_W + 10, capH + 4);
      ctx.strokeRect(x - 5, gy + gap - 2, PIPE_W + 10, capH + 4);
      ctx.globalAlpha = 1;
    }
  },

  drawGround(ctx, W, H, g, pal) {
    const [pr, pg, pb] = pal.rgb || [29, 185, 84];
    ctx.fillStyle = `rgba(${(pr * 0.18) | 0},${(pg * 0.18) | 0},${(pb * 0.18) | 0},0.95)`;
    ctx.fillRect(0, H - 70, W, 70);
    ctx.shadowColor = pal.bright; ctx.shadowBlur = 6;
    ctx.fillStyle = pal.bright;
    ctx.fillRect(0, H - 70, W, 1.5);
    ctx.shadowBlur = 0;
  },

  onPerfect(ctx, x, y, pal) { /* default flash handled elsewhere */ },
  pipeOutline: false,
};

// ═══════════════════════════════════════════════════════════════
//  THEME: NEON SYNTHWAVE
// ═══════════════════════════════════════════════════════════════
const synthwave = {
  id: "synthwave",
  name: "Neon Synthwave",
  icon: "🌆",
  description: "80s retro-futurism with grid floors & sunset gradients",
  preview: { bg: "#1a0030", accent: "#ff2d95", pipe: "#00f0ff" },
  cssOverrides: {
    "--accent": "#ff2d95",
    "--accent-bright": "#ff69b4",
    "--accent-glow": "rgba(255,45,149,0.5)",
    "--bg-deep": "#0d001a",
    "--bg-card": "#1a0030",
  },

  drawBackground(ctx, W, H, g, pal, beatFlash) {
    // Sunset gradient
    const bgG = ctx.createLinearGradient(0, 0, 0, H);
    bgG.addColorStop(0, "#0d001a");
    bgG.addColorStop(0.3, "#1a0040");
    bgG.addColorStop(0.5, "#33004d");
    bgG.addColorStop(0.7, "#ff2d95");
    bgG.addColorStop(0.85, "#ff6b2b");
    bgG.addColorStop(1, "#000");
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, W, H);

    // Sun
    const sunY = H * 0.65;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#ff6b2b";
    ctx.shadowColor = "#ff6b2b"; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(W / 2, sunY, 60, Math.PI, 0); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Sun horizontal lines (clip effect)
    ctx.fillStyle = "#0d001a";
    for (let i = 0; i < 6; i++) {
      const ly = sunY - 50 + i * 15;
      if (ly < sunY) ctx.fillRect(0, ly, W, 3);
    }

    // Perspective grid floor
    ctx.strokeStyle = "#ff2d9555"; ctx.lineWidth = 1;
    const horizon = H * 0.55;
    // Vertical lines (converge to center)
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2, horizon);
      ctx.lineTo(W / 2 + i * 80, H);
      ctx.stroke();
    }
    // Horizontal lines (receding)
    const t = (performance.now() / 1500) % 1;
    for (let i = 0; i < 12; i++) {
      const frac = (i + t) / 12;
      const ly = horizon + (H - horizon) * (frac * frac);
      ctx.globalAlpha = 0.15 + frac * 0.3;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Scanlines
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }
  },

  drawPipe(ctx, x, gy, gap, PIPE_W, beatGlow, pal, extra) {
    const H = extra?.H || 600;
    const glow = beatGlow || 0;

    // Cyan neon pipes
    ctx.fillStyle = "#001122";
    ctx.fillRect(x, 0, PIPE_W, gy);
    ctx.fillRect(x, gy + gap, PIPE_W, H - gy - gap);

    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2 + glow * 2;
    ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 10 + glow * 20;
    ctx.strokeRect(x, 0, PIPE_W, gy);
    ctx.strokeRect(x, gy + gap, PIPE_W, H - gy - gap);
    ctx.shadowBlur = 0;

    // Pink caps
    ctx.fillStyle = "#ff2d95";
    ctx.shadowColor = "#ff2d95"; ctx.shadowBlur = 8 + glow * 16;
    ctx.fillRect(x - 3, gy - 12, PIPE_W + 6, 12);
    ctx.fillRect(x - 3, gy + gap, PIPE_W + 6, 12);
    ctx.shadowBlur = 0;
  },

  drawGround(ctx, W, H, g, pal) {
    ctx.fillStyle = "#0d001a";
    ctx.fillRect(0, H - 70, W, 70);
    ctx.strokeStyle = "#ff2d95"; ctx.lineWidth = 2;
    ctx.shadowColor = "#ff2d95"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(0, H - 70); ctx.lineTo(W, H - 70); ctx.stroke();
    ctx.shadowBlur = 0;
  },

  pipeOutline: false,
};

// ═══════════════════════════════════════════════════════════════
//  THEME: K-POP KAWAII
// ═══════════════════════════════════════════════════════════════
const kawaii = {
  id: "kawaii",
  name: "K-Pop Kawaii",
  icon: "🧋",
  description: "Pastel pinks, boba tea obstacles & heart-shaped sparkles",
  preview: { bg: "#2a1525", accent: "#ff8ec4", pipe: "#c490d1" },
  cssOverrides: {
    "--accent": "#ff8ec4",
    "--accent-bright": "#ffb3d9",
    "--accent-glow": "rgba(255,142,196,0.5)",
    "--bg-deep": "#1a0d18",
    "--bg-card": "#2a1525",
  },

  drawBackground(ctx, W, H, g, pal, beatFlash) {
    const bgG = ctx.createLinearGradient(0, 0, 0, H);
    bgG.addColorStop(0, "#1a0d18");
    bgG.addColorStop(0.4, "#2a1525");
    bgG.addColorStop(0.8, "#1e1028");
    bgG.addColorStop(1, "#0d0810");
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, W, H);

    // Floating hearts (use star positions as seeds)
    ctx.globalAlpha = 0.12 + beatFlash * 0.1;
    g.stars.forEach(s => {
      const hx = s.x, hy = s.y;
      const sz = s.r * 3;
      ctx.fillStyle = "#ff8ec4";
      ctx.save();
      ctx.translate(hx, hy);
      ctx.beginPath();
      ctx.moveTo(0, sz * 0.3);
      ctx.bezierCurveTo(-sz * 0.5, -sz * 0.3, -sz, sz * 0.1, 0, sz);
      ctx.bezierCurveTo(sz, sz * 0.1, sz * 0.5, -sz * 0.3, 0, sz * 0.3);
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // Soft polka dots
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "#ffb3d9";
    for (let x = 15; x < W; x += 35) {
      for (let y = 15; y < H - 70; y += 35) {
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  drawPipe(ctx, x, gy, gap, PIPE_W, beatGlow, pal, extra) {
    const H = extra?.H || 600;
    const glow = beatGlow || 0;

    // Boba tea cup style pipes — rounded, pastel
    const radius = 8;

    // Top pipe body
    ctx.fillStyle = "#c490d1";
    ctx.beginPath();
    ctx.roundRect(x + 2, 0, PIPE_W - 4, gy, [0, 0, radius, radius]);
    ctx.fill();

    // Bottom pipe body
    ctx.beginPath();
    ctx.roundRect(x + 2, gy + gap, PIPE_W - 4, H - gy - gap, [radius, radius, 0, 0]);
    ctx.fill();

    // Outline (pink)
    ctx.strokeStyle = "#ff8ec4";
    ctx.lineWidth = 2 + glow;
    ctx.shadowColor = "#ff8ec4"; ctx.shadowBlur = glow * 12;
    ctx.beginPath(); ctx.roundRect(x + 2, 0, PIPE_W - 4, gy, [0, 0, radius, radius]); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 2, gy + gap, PIPE_W - 4, H - gy - gap, [radius, radius, 0, 0]); ctx.stroke();
    ctx.shadowBlur = 0;

    // Boba dots on caps
    ctx.fillStyle = "#5a3d5e";
    const capCenters = [gy - 6, gy + gap + 6];
    capCenters.forEach(cy => {
      for (let i = 0; i < 3; i++) {
        const bx = x + 14 + i * 12;
        ctx.beginPath(); ctx.arc(bx, cy, 3, 0, Math.PI * 2); ctx.fill();
      }
    });
  },

  drawGround(ctx, W, H, g, pal) {
    ctx.fillStyle = "#2a1525";
    ctx.fillRect(0, H - 70, W, 70);
    ctx.fillStyle = "#ff8ec4";
    ctx.fillRect(0, H - 70, W, 2);

    // Decorative hearts on ground
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#ffb3d9";
    for (let x = 20; x < W; x += 60) {
      const sz = 5;
      ctx.save();
      ctx.translate(x, H - 50);
      ctx.beginPath();
      ctx.moveTo(0, sz * 0.3);
      ctx.bezierCurveTo(-sz * 0.5, -sz * 0.3, -sz, sz * 0.1, 0, sz);
      ctx.bezierCurveTo(sz, sz * 0.1, sz * 0.5, -sz * 0.3, 0, sz * 0.3);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  pipeOutline: false,
};

// ═══════════════════════════════════════════════════════════════
//  THEME: VINTAGE CHALK
// ═══════════════════════════════════════════════════════════════
const chalk = {
  id: "chalk",
  name: "Vintage Chalk",
  icon: "📝",
  description: "Dark chalkboard with chalky white strokes & dust",
  preview: { bg: "#1a2e1a", accent: "#d4d4c0", pipe: "#e8e8d0" },
  cssOverrides: {
    "--accent": "#d4d4c0",
    "--accent-bright": "#f0f0e0",
    "--accent-glow": "rgba(212,212,192,0.3)",
    "--bg-deep": "#1a2e1a",
    "--bg-card": "#243624",
  },

  drawBackground(ctx, W, H, g, pal, beatFlash) {
    // Chalkboard green
    const bgG = ctx.createLinearGradient(0, 0, 0, H);
    bgG.addColorStop(0, "#1a2e1a");
    bgG.addColorStop(0.5, "#1e3420");
    bgG.addColorStop(1, "#142814");
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, W, H);

    // Chalk dust noise
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 200; i++) {
      const dx = (Math.sin(i * 127.1 + i) * 0.5 + 0.5) * W;
      const dy = (Math.cos(i * 269.5 + i * 0.7) * 0.5 + 0.5) * (H - 70);
      ctx.fillRect(dx, dy, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Wooden frame border
    ctx.strokeStyle = "#5a3d2a";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.strokeStyle = "#8b6644";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, W - 12, H - 12);
  },

  drawPipe(ctx, x, gy, gap, PIPE_W, beatGlow, pal, extra) {
    const H = extra?.H || 600;
    const glow = beatGlow || 0;

    // Chalky dashed pipe outlines
    ctx.strokeStyle = `rgba(232,232,208,${0.6 + glow * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    // Top pipe
    ctx.strokeRect(x + 2, 2, PIPE_W - 4, gy - 4);
    // Bottom pipe
    ctx.strokeRect(x + 2, gy + gap + 2, PIPE_W - 4, H - gy - gap - 4);

    ctx.setLineDash([]);

    // Chalk fill — very faint
    ctx.fillStyle = `rgba(232,232,208,${0.05 + glow * 0.05})`;
    ctx.fillRect(x + 2, 2, PIPE_W - 4, gy - 4);
    ctx.fillRect(x + 2, gy + gap + 2, PIPE_W - 4, H - gy - gap - 4);

    // Solid caps
    ctx.fillStyle = `rgba(232,232,208,${0.4 + glow * 0.3})`;
    ctx.fillRect(x - 3, gy - 10, PIPE_W + 6, 10);
    ctx.fillRect(x - 3, gy + gap, PIPE_W + 6, 10);
  },

  drawGround(ctx, W, H, g, pal) {
    ctx.fillStyle = "#142814";
    ctx.fillRect(0, H - 70, W, 70);

    // Chalk tray
    ctx.fillStyle = "#5a3d2a";
    ctx.fillRect(0, H - 72, W, 6);
    ctx.fillStyle = "#8b6644";
    ctx.fillRect(0, H - 72, W, 2);
  },

  pipeOutline: false,
};

// ═══════════════════════════════════════════════════════════════
//  THEME: POP-ART COMIC
// ═══════════════════════════════════════════════════════════════
const popArt = {
  id: "popart",
  name: "Pop-Art Comic",
  icon: "💥",
  description: "Ben-Day dots, bold outlines, ZAP! & POW! pop-ups",
  preview: { bg: "#1a1a2e", accent: "#ff3366", pipe: "#ffcc00" },
  cssOverrides: {
    "--accent": "#ff3366",
    "--accent-bright": "#ff6699",
    "--accent-glow": "rgba(255,51,102,0.5)",
    "--bg-deep": "#0d0d1a",
    "--bg-card": "#1a1a2e",
  },

  drawBackground(ctx, W, H, g, pal, beatFlash) {
    // Deep comic blue
    ctx.fillStyle = "#0d0d2a";
    ctx.fillRect(0, 0, W, H);

    // Ben-Day dots pattern
    ctx.globalAlpha = 0.06 + beatFlash * 0.04;
    ctx.fillStyle = "#ff3366";
    for (let x = 0; x < W; x += 14) {
      for (let y = 0; y < H - 70; y += 14) {
        ctx.beginPath();
        ctx.arc(x + (y % 28 === 0 ? 7 : 0), y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Speed lines (emanating from center-right)
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(W * 0.7, H * 0.4);
      ctx.lineTo(W * 0.7 + Math.cos(angle) * W, H * 0.4 + Math.sin(angle) * H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  drawPipe(ctx, x, gy, gap, PIPE_W, beatGlow, pal, extra) {
    const H = extra?.H || 600;
    const glow = beatGlow || 0;

    // Solid yellow pipes
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(x, 0, PIPE_W, gy);
    ctx.fillRect(x, gy + gap, PIPE_W, H - gy - gap);

    // Bold black outlines (high contrast)
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 0, PIPE_W, gy);
    ctx.strokeRect(x, gy + gap, PIPE_W, H - gy - gap);

    // Red caps
    ctx.fillStyle = "#ff3366";
    ctx.fillRect(x - 3, gy - 14, PIPE_W + 6, 14);
    ctx.fillRect(x - 3, gy + gap, PIPE_W + 6, 14);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.strokeRect(x - 3, gy - 14, PIPE_W + 6, 14);
    ctx.strokeRect(x - 3, gy + gap, PIPE_W + 6, 14);

    // Halftone shading on pipe body
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#000";
    for (let py = 0; py < gy; py += 8) {
      for (let px = x + 4; px < x + PIPE_W - 4; px += 8) {
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (let py = gy + gap + 4; py < H; py += 8) {
      for (let px = x + 4; px < x + PIPE_W - 4; px += 8) {
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  drawGround(ctx, W, H, g, pal) {
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, H - 70, W, 70);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, H - 70); ctx.lineTo(W, H - 70); ctx.stroke();
    ctx.fillStyle = "#ff3366";
    ctx.fillRect(0, H - 70, W, 2);
  },

  // Flag: bird and pipes should get an extra black outline
  pipeOutline: true,

  // Pop-art specific: generate ZAP/POW text on perfect grades
  onPerfect(ctx, x, y, pal) {
    const words = ["ZAP!", "POW!", "BAM!", "WHAM!"];
    const word = words[Math.floor(Math.random() * words.length)];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.3);

    // Speech bubble background
    ctx.fillStyle = "#ffcc00";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    const tw = ctx.measureText(word).width + 20;
    ctx.beginPath();
    // Starburst shape
    const spikes = 12, outerR = tw * 0.7, innerR = tw * 0.5;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#ff3366";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.font = "bold 18px 'Comic Sans MS', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(word, 0, 0);
    ctx.fillText(word, 0, 0);

    ctx.restore();
  },
};

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════
export const THEMES = [classicNeon, synthwave, kawaii, chalk, popArt];

export function getThemeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function getActiveTheme() {
  const id = getSetting("theme", "classic");
  return getThemeById(id);
}

/**
 * Apply a theme's CSS overrides to the document root.
 * Called when switching themes.
 */
export function applyThemeCSS(theme) {
  const root = document.documentElement;
  // Reset to defaults first
  const defaults = {
    "--accent": "#1DB954",
    "--accent-bright": "#4ade80",
    "--accent-glow": "rgba(29,185,84,0.5)",
    "--bg-deep": "#050508",
    "--bg-card": "#0e0e14",
  };
  Object.entries(defaults).forEach(([k, v]) => root.style.setProperty(k, v));
  // Apply theme overrides
  if (theme.cssOverrides) {
    Object.entries(theme.cssOverrides).forEach(([k, v]) => root.style.setProperty(k, v));
  }
}
