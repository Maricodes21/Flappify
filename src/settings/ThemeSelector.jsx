import { useState } from "react";
import { THEMES, applyThemeCSS } from "../game/ThemeEngine";
import { getSetting, saveSetting } from "../services/storage";

export default function ThemeSelector({ onBack }) {
  const [activeTheme, setActiveTheme] = useState(getSetting("theme", "classic"));

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "7px 14px", fontSize: 12 }}>← BACK</button>
          <h2 className="neon-heading" style={{ fontSize: 16, margin: 0 }}>SKINS & THEMES</h2>
        </div>

        <p style={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 20, letterSpacing: 1 }}>
          Choose a visual style — changes apply instantly to the game canvas and menus.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {THEMES.map(theme => {
            const isActive = activeTheme === theme.id;
            return (
              <div key={theme.id}
                onClick={() => selectTheme(theme.id)}
                style={{
                  background: isActive ? "var(--bg-card-hover)" : "var(--bg-card)",
                  border: `2px solid ${isActive ? theme.preview.accent : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-lg)",
                  padding: 16,
                  cursor: "pointer",
                  transition: "all var(--transition-normal)",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  boxShadow: isActive ? `0 0 20px ${theme.preview.accent}33` : "none",
                }}>
                {/* Preview swatch */}
                <div style={{
                  width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                  background: theme.preview.bg,
                  border: `1px solid ${theme.preview.accent}44`,
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Mini pipe preview */}
                  <div style={{
                    position: "absolute", left: 22, top: 0, width: 8, height: 22,
                    background: theme.preview.pipe, borderRadius: "0 0 2px 2px",
                  }} />
                  <div style={{
                    position: "absolute", left: 22, bottom: 12, width: 8, height: 20,
                    background: theme.preview.pipe, borderRadius: "2px 2px 0 0",
                  }} />
                  {/* Mini bird */}
                  <div style={{
                    position: "absolute", left: 12, top: 28, width: 8, height: 8,
                    background: theme.preview.accent, borderRadius: "50%",
                    boxShadow: `0 0 6px ${theme.preview.accent}`,
                  }} />
                  {/* Ground line */}
                  <div style={{
                    position: "absolute", bottom: 10, left: 0, right: 0, height: 1,
                    background: theme.preview.accent,
                  }} />
                  {/* Theme icon */}
                  <div style={{
                    position: "absolute", bottom: 1, right: 4, fontSize: 14, lineHeight: 1,
                  }}>{theme.icon}</div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: "var(--font-display)", fontSize: 13, fontWeight: "bold",
                      color: isActive ? theme.preview.accent : "var(--text-primary)",
                      letterSpacing: 1,
                    }}>
                      {theme.name.toUpperCase()}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: 9, background: theme.preview.accent, color: "#000",
                        padding: "2px 6px", borderRadius: 4, fontWeight: "bold",
                        fontFamily: "var(--font-display)", letterSpacing: 1,
                      }}>ACTIVE</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5,
                  }}>
                    {theme.description}
                  </div>
                </div>

                {/* Color dots */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.accent, border: "1px solid #fff1" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.pipe, border: "1px solid #fff1" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.bg, border: "1px solid #fff2" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
