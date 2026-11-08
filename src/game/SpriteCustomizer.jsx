import { useState, useRef, useEffect } from "react";
import { SPRITES, getUnlockedSprites } from "./sprites";
import { saveSpriteChoice, getSpriteChoice, getSetting } from "../services/storage";
import { THEMES, applyThemeCSS } from "./ThemeEngine";
import { saveSetting } from "../services/storage";

const PREVIEW_SIZE = 120;
const PREVIEW_PAL = {
  base: "#1DB954", bright: "#4ade80", dark: "#061a0c",
  deep: "#020d06", glow: "rgba(77,222,128,0.6)", rgb: [29, 185, 84]
};

const STAR_COLORS_THEME = {
  classic: "#1DB954", synthwave: "#ff2d95", kawaii: "#ff8ec4",
  chalk: "#d4d4c0", popart: "#ff3366"
};

export default function SpriteCustomizer({ onBack, palette }) {
  const [selected, setSelected] = useState(getSpriteChoice());
  const [tab, setTab] = useState("sprites"); // "sprites" | "themes"
  const [activeTheme, setActiveTheme] = useState(getSetting("theme", "classic"));
  const sprites = getUnlockedSprites();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const pal = palette || PREVIEW_PAL;

  // Animate preview
  useEffect(() => {
    if (tab !== "sprites") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let alive = true;

    const drawPreview = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

      // Dark bg
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

      // Grid lines
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = pal.bright;
      ctx.lineWidth = 0.5;
      for (let x = 0; x < PREVIEW_SIZE; x += 15) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PREVIEW_SIZE); ctx.stroke();
      }
      for (let y = 0; y < PREVIEW_SIZE; y += 15) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PREVIEW_SIZE, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const sprite = SPRITES.find(s => s.id === selected) || SPRITES[0];
      const pulse = Math.sin(performance.now() / 300) * 0.3 + 0.3;
      const cx = PREVIEW_SIZE / 2;
      const cy = PREVIEW_SIZE / 2;
      const bob = Math.sin(performance.now() / 500) * 4;

      // Draw trail
      for (let i = 0; i < 6; i++) {
        const tx = cx - (i + 1) * 6;
        const ty = cy + bob + Math.sin(performance.now() / 500 + i * 0.5) * 2;
        ctx.globalAlpha = 0.15 - i * 0.02;
        ctx.fillStyle = pal.bright;
        ctx.beginPath();
        ctx.arc(tx, ty, 5 * (1 - i * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      sprite.draw(ctx, cx, cy + bob, 15, pulse, pal);

      animRef.current = requestAnimationFrame(drawPreview);
    };

    animRef.current = requestAnimationFrame(drawPreview);
    return () => { alive = false; cancelAnimationFrame(animRef.current); };
  }, [selected, pal, tab]);

  const handleSelect = (id) => {
    const s = sprites.find(sp => sp.id === id);
    if (s && s.unlocked) {
      setSelected(id);
      saveSpriteChoice(id);
    }
  };

  const selectTheme = (themeId) => {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    saveSetting("theme", themeId);
    setActiveTheme(themeId);
    applyThemeCSS(theme);
  };

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "7px 14px", fontSize: 12 }}>← BACK</button>
          <h2 className="neon-heading" style={{ fontSize: 16, margin: 0 }}>CUSTOMIZATION</h2>
        </div>

        {/* Tab toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[{ k: "sprites", l: "🎨 SPRITES", icon: "🎨" }, { k: "themes", l: "🎭 THEMES", icon: "🎭" }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 8,
                background: tab === t.k ? "var(--accent)" : "var(--bg-card)",
                border: "1.5px solid var(--border-subtle)",
                color: tab === t.k ? "#ffffff" : "var(--text-primary)",
                fontSize: 11, fontFamily: "var(--font-music)", fontWeight: 800,
                letterSpacing: 1.5, cursor: "pointer",
                boxShadow: "var(--paper-shadow-sm)",
                transition: "all var(--transition-fast)",
              }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Sprites Tab */}
        {tab === "sprites" && (
          <>
            {/* Preview */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div className="glass-card" style={{ padding: 16, textAlign: "center" }}>
                <canvas ref={canvasRef} width={PREVIEW_SIZE} height={PREVIEW_SIZE}
                  style={{ borderRadius: 8, display: "block", margin: "0 auto 8px" }} />
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--accent)", letterSpacing: 2 }}>
                  {(SPRITES.find(s => s.id === selected) || SPRITES[0]).name.toUpperCase()}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                  {(SPRITES.find(s => s.id === selected) || SPRITES[0]).description}
                </div>
              </div>
            </div>

            {/* Sprite Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
              {sprites.map(s => (
                <div key={s.id} onClick={() => handleSelect(s.id)}
                  style={{
                    background: selected === s.id ? "rgba(29,185,84,0.12)" : "var(--bg-card)",
                    border: `2px solid ${selected === s.id ? "var(--accent)" : s.unlocked ? "var(--border-subtle)" : "rgba(255,255,255,0.03)"}`,
                    borderRadius: "var(--radius-md)", padding: 12, textAlign: "center",
                    cursor: s.unlocked ? "pointer" : "not-allowed",
                    opacity: s.unlocked ? 1 : 0.4,
                    transition: "all var(--transition-normal)"
                  }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>
                    {s.unlocked ? (
                      s.id === "classic" ? "🟢" :
                      s.id === "vinyl" ? "💿" :
                      s.id === "note" ? "♪" :
                      s.id === "star" ? "⭐" :
                      s.id === "ghost" ? "👻" :
                      s.id === "fire" ? "🔥" :
                      s.id === "diamond" ? "💎" :
                      s.id === "custom" ? "🖼️" : "?"
                    ) : "🔒"}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: "bold", letterSpacing: 0.5, marginBottom: 2 }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 8, color: s.unlocked ? "var(--text-dim)" : "var(--text-faint)", lineHeight: 1.3 }}>
                    {s.unlocked ? s.description : s.unlockText}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Themes Tab */}
        {tab === "themes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>
              Themes auto-shuffle based on song vibe. Pick a default, or let the music decide.
            </p>
            {THEMES.map(theme => {
              const isActive = activeTheme === theme.id;
              return (
                <div key={theme.id}
                  onClick={() => selectTheme(theme.id)}
                  style={{
                    background: isActive ? "var(--bg-card-hover)" : "var(--bg-card)",
                    border: `2px solid ${isActive ? theme.preview.accent : "var(--border-subtle)"}`,
                    borderRadius: "var(--radius-lg)",
                    padding: 14,
                    cursor: "pointer",
                    transition: "all var(--transition-normal)",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    boxShadow: isActive ? `0 0 16px ${theme.preview.accent}33` : "none",
                  }}>
                  {/* Preview swatch */}
                  <div style={{
                    width: 56, height: 56, borderRadius: 8, flexShrink: 0,
                    background: theme.preview.bg,
                    border: `1px solid ${theme.preview.accent}44`,
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", left: 22, top: 0, width: 7, height: 18,
                      background: theme.preview.pipe, borderRadius: "0 0 2px 2px",
                    }} />
                    <div style={{
                      position: "absolute", left: 22, bottom: 10, width: 7, height: 16,
                      background: theme.preview.pipe, borderRadius: "2px 2px 0 0",
                    }} />
                    <div style={{
                      position: "absolute", left: 10, top: 26, width: 7, height: 7,
                      background: theme.preview.accent, borderRadius: "50%",
                      boxShadow: `0 0 6px ${theme.preview.accent}`,
                    }} />
                    <div style={{
                      position: "absolute", bottom: 8, left: 0, right: 0, height: 1,
                      background: theme.preview.accent,
                    }} />
                    <div style={{
                      position: "absolute", bottom: 0, right: 3, fontSize: 12, lineHeight: 1,
                    }}>{theme.icon}</div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontFamily: "var(--font-display)", fontSize: 12, fontWeight: "bold",
                        color: isActive ? theme.preview.accent : "var(--text-primary)",
                        letterSpacing: 1,
                      }}>
                        {theme.name.toUpperCase()}
                      </span>
                      {isActive && (
                        <span style={{
                          fontSize: 8, background: theme.preview.accent, color: "#000",
                          padding: "1px 5px", borderRadius: 3, fontWeight: "bold",
                          fontFamily: "var(--font-display)", letterSpacing: 1,
                        }}>ACTIVE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {theme.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
