// Sprite definitions for bird customization
// Each sprite has: id, name, description, unlockText, check(stats), draw(ctx, x, y, r, pulse, palette)
import { getTotalStats, getAllScores } from "../services/storage";

function getUnlockStats() {
  const stats = getTotalStats();
  const scores = getAllScores();
  const scoreValues = Object.values(scores);

  return {
    totalPlays: stats.totalPlays || 0,
    totalDeaths: stats.totalPlays || 0, // each play ends in death
    sRanks: stats.sRanks || 0,
    hasSRank: stats.sRanks > 0,
    maxPerfectsInRun: scoreValues.reduce((m, s) => Math.max(m, s.perfects || 0), 0),
    maxCombo: scoreValues.reduce((m, s) => Math.max(m, s.maxCombo || 0), 0),
    maxSongPct: scoreValues.reduce((m, s) => Math.max(m, s.songPct || 0), 0),
  };
}

export const SPRITES = [
  {
    id: "classic",
    name: "Classic",
    description: "The original neon orb",
    unlockText: "Default",
    check: () => true,
    draw: (ctx, x, y, r, pulse, pal) => {
      const [pr, pg, pb] = pal.rgb || [29, 185, 84];
      const br = r * (1 + pulse * 0.22);

      // Outer glow
      const og = ctx.createRadialGradient(x, y, br * 0.4, x, y, br * 3);
      og.addColorStop(0, `rgba(${pr},${pg},${pb},0.35)`);
      og.addColorStop(1, "transparent");
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(x, y, br * 3, 0, Math.PI * 2); ctx.fill();

      // Body
      const bg = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, br);
      bg.addColorStop(0, pal.bright);
      bg.addColorStop(0.6, pal.base);
      bg.addColorStop(1, pal.dark);
      ctx.fillStyle = bg;
      ctx.shadowColor = pal.glow; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(x, y, br, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Shine
      ctx.globalAlpha = 0.35; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(x - 3, y - 4, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x + 5, y - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(x + 5.8, y - 3.5, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x + 6.5, y - 2.8, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: "vinyl",
    name: "Vinyl",
    description: "Spinning vinyl record",
    unlockText: "Play 5 songs",
    check: (stats) => stats.totalPlays >= 5,
    draw: (ctx, x, y, r, pulse, pal) => {
      const br = r * (1 + pulse * 0.15);
      const t = performance.now() / 400;

      // Record body
      ctx.fillStyle = "#1a1a1a";
      ctx.shadowColor = pal.glow; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, br, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Grooves
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5;
      for (let i = 3; i < br; i += 2.5) {
        ctx.beginPath(); ctx.arc(x, y, i, 0, Math.PI * 2); ctx.stroke();
      }

      // Label
      const lg = ctx.createRadialGradient(x, y, 0, x, y, br * 0.35);
      lg.addColorStop(0, pal.bright);
      lg.addColorStop(1, pal.base);
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(x, y, br * 0.35, 0, Math.PI * 2); ctx.fill();

      // Center hole
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();

      // Shine sweep
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, br, t, t + 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
  {
    id: "note",
    name: "Music Note",
    description: "A floating musical note ♪",
    unlockText: "Get 10 Perfects in one run",
    check: (stats) => stats.maxPerfectsInRun >= 10,
    draw: (ctx, x, y, r, pulse, pal) => {
      const br = r * (1 + pulse * 0.2);
      const bob = Math.sin(performance.now() / 300) * 2;

      ctx.shadowColor = pal.glow; ctx.shadowBlur = 12;
      ctx.font = `bold ${br * 2.2}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = pal.bright;
      ctx.fillText("♪", x, y + bob);
      ctx.shadowBlur = 0;

      // Glow ring
      ctx.globalAlpha = 0.15 + pulse * 0.2;
      ctx.strokeStyle = pal.bright;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, br * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
  {
    id: "star",
    name: "Star",
    description: "A glowing star",
    unlockText: "Beat 75% of any song",
    check: (stats) => stats.maxSongPct >= 75,
    draw: (ctx, x, y, r, pulse, pal) => {
      const br = r * (1 + pulse * 0.25);
      const rot = performance.now() / 2000;

      // Glow
      const g = ctx.createRadialGradient(x, y, 0, x, y, br * 2.5);
      g.addColorStop(0, `rgba(255,215,0,0.4)`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, br * 2.5, 0, Math.PI * 2); ctx.fill();

      // Star shape
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
        const ox = Math.cos(angle) * br;
        const oy = Math.sin(angle) * br;
        const ix = Math.cos(innerAngle) * br * 0.4;
        const iy = Math.sin(innerAngle) * br * 0.4;
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  },
  {
    id: "ghost",
    name: "Ghost",
    description: "Translucent phantom",
    unlockText: "50 total plays",
    check: (stats) => stats.totalDeaths >= 50,
    draw: (ctx, x, y, r, pulse, pal) => {
      const br = r * (1 + pulse * 0.15);
      const wave = Math.sin(performance.now() / 250) * 2;

      ctx.globalAlpha = 0.55 + pulse * 0.2;
      ctx.shadowColor = "rgba(200,200,255,0.5)"; ctx.shadowBlur = 16;

      // Body
      ctx.fillStyle = "rgba(200,200,255,0.5)";
      ctx.beginPath();
      ctx.arc(x, y - br * 0.2, br * 0.9, Math.PI, 0);
      // Wavy bottom
      const bY = y + br * 0.6;
      ctx.lineTo(x + br * 0.9, bY);
      for (let i = 0; i < 4; i++) {
        const cx1 = x + br * 0.9 - (i * br * 0.45) - br * 0.1;
        const cx2 = x + br * 0.9 - (i * br * 0.45) - br * 0.35;
        ctx.quadraticCurveTo(cx1, bY + wave + 4, cx2, bY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(x - 3, y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 5, y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
  {
    id: "fire",
    name: "Fireball",
    description: "Flame-trailed orb",
    unlockText: "×20 combo",
    check: (stats) => stats.maxCombo >= 20,
    draw: (ctx, x, y, r, pulse, pal) => {
      const br = r * (1 + pulse * 0.2);
      const t = performance.now() / 100;

      // Flame particles behind
      for (let i = 0; i < 5; i++) {
        const fx = x - 6 - i * 4 + Math.sin(t + i) * 3;
        const fy = y + Math.sin(t * 1.5 + i * 2) * 4;
        const fr = br * (0.8 - i * 0.12);
        ctx.globalAlpha = 0.5 - i * 0.08;
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
        fg.addColorStop(0, "#ff6600");
        fg.addColorStop(0.5, "#ff3300");
        fg.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Core orb
      const cg = ctx.createRadialGradient(x, y, 0, x, y, br);
      cg.addColorStop(0, "#ffff00");
      cg.addColorStop(0.4, "#ff8800");
      cg.addColorStop(1, "#cc2200");
      ctx.fillStyle = cg;
      ctx.shadowColor = "#ff4400"; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(x, y, br * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Hot center
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x - 1, y - 2, br * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
  {
    id: "diamond",
    name: "Diamond",
    description: "Prismatic diamond",
    unlockText: "S-rank any song",
    check: (stats) => stats.hasSRank,
    draw: (ctx, x, y, r, pulse, pal) => {
      const br = r * (1 + pulse * 0.18);
      const rot = Math.sin(performance.now() / 1000) * 0.1;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      // Diamond shape
      ctx.shadowColor = "rgba(100,200,255,0.6)"; ctx.shadowBlur = 16;
      const lg = ctx.createLinearGradient(-br, -br, br, br);
      lg.addColorStop(0, "#88ddff");
      lg.addColorStop(0.3, "#ffffff");
      lg.addColorStop(0.5, "#aaeeff");
      lg.addColorStop(0.7, "#ffffff");
      lg.addColorStop(1, "#66ccff");
      ctx.fillStyle = lg;

      ctx.beginPath();
      ctx.moveTo(0, -br);           // top
      ctx.lineTo(br * 0.7, -br * 0.2); // top-right
      ctx.lineTo(br * 0.5, br);     // bottom-right
      ctx.lineTo(-br * 0.5, br);    // bottom-left
      ctx.lineTo(-br * 0.7, -br * 0.2); // top-left
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Facet lines
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-br * 0.7, -br * 0.2);
      ctx.lineTo(0, br * 0.4);
      ctx.lineTo(br * 0.7, -br * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -br);
      ctx.lineTo(0, br * 0.4);
      ctx.stroke();

      ctx.restore();
    }
  },
  {
    id: "custom",
    name: "Album Art",
    description: "Textured with current track art",
    unlockText: "Always available",
    check: () => true,
    draw: (ctx, x, y, r, pulse, pal, albumImg) => {
      const br = r * (1 + pulse * 0.18);

      // Glow ring
      ctx.strokeStyle = pal.bright;
      ctx.lineWidth = 2;
      ctx.shadowColor = pal.glow; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, br + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      // Clip circle and draw album art
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, br, 0, Math.PI * 2);
      ctx.clip();
      if (albumImg && albumImg.complete && albumImg.naturalWidth > 0) {
        ctx.drawImage(albumImg, x - br, y - br, br * 2, br * 2);
      } else {
        // Fallback: gradient orb
        const fg = ctx.createRadialGradient(x, y, 0, x, y, br);
        fg.addColorStop(0, pal.bright);
        fg.addColorStop(1, pal.dark);
        ctx.fillStyle = fg;
        ctx.fill();
      }
      ctx.restore();

      // Shine overlay
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(x - 3, y - 4, br * 0.5, br * 0.3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
];

export function getSpriteById(id) {
  return SPRITES.find(s => s.id === id) || SPRITES[0];
}

export function getUnlockedSprites() {
  const stats = getUnlockStats();
  return SPRITES.map(s => ({
    ...s,
    unlocked: s.check(stats)
  }));
}
