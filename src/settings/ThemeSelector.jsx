import { useState } from "react";
import { THEMES } from "../game/ThemeEngine";
import { getSetting, saveSetting, getHomeThemeChoice, saveHomeThemeChoice } from "../services/storage";

const HOME_THEMES = [
  {
    id: "papercraft",
    name: "Warm Papercraft",
    badge: "CURRENT",
    icon: "📜",
    description: "Warm craft buff, manila paper cards, crisp stamped espresso ink, and organic typography",
    preview: {
      bg: "#dfd2bc",
      card: "#fbf6ec",
      accent: "#2e5339",
      text: "#211c17",
      border: "#2b231c",
    },
  },
  {
    id: "neon",
    name: "Dark Cyber Neon",
    badge: "PREVIOUS",
    icon: "⚡",
    description: "Deep space black, high-contrast Spotify neon green glow, and Orbitron typography",
    preview: {
      bg: "#06070a",
      card: "#0f1118",
      accent: "#1DB954",
      text: "#f0f3f8",
      border: "rgba(255,255,255,0.18)",
    },
  },
];

export default function ThemeSelector({ onBack }) {
  const [tab, setTab] = useState("level"); // "level" | "home"
  const [activeLevelTheme, setActiveLevelTheme] = useState(() => getSetting("theme", "classic"));
  const [activeHomeTheme, setActiveHomeTheme] = useState(() => getHomeThemeChoice());

  const selectLevelTheme = (themeId) => {
    saveSetting("theme", themeId);
    setActiveLevelTheme(themeId);
  };

  const selectHomeTheme = (themeId) => {
    saveHomeThemeChoice(themeId);
    setActiveHomeTheme(themeId);
    document.documentElement.setAttribute("data-home-theme", themeId);
  };

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "7px 14px", fontSize: 12 }}>← BACK</button>
          <h2 className="neon-heading" style={{ fontSize: 16, margin: 0 }}>THEMES & SKINS</h2>
        </div>

        {/* Tab switcher: Level Themes vs Home Themes */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setTab("level")}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--border-subtle)",
              background: tab === "level" ? "var(--accent)" : "var(--bg-card)",
              color: tab === "level" ? "#ffffff" : "var(--text-primary)",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: 1.2,
              cursor: "pointer",
              boxShadow: "var(--paper-shadow-sm)",
              transition: "all var(--transition-fast)",
            }}
          >
            🎮 LEVEL THEMES
          </button>
          <button
            onClick={() => setTab("home")}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--border-subtle)",
              background: tab === "home" ? "var(--accent)" : "var(--bg-card)",
              color: tab === "home" ? "#ffffff" : "var(--text-primary)",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: 1.2,
              cursor: "pointer",
              boxShadow: "var(--paper-shadow-sm)",
              transition: "all var(--transition-fast)",
            }}
          >
            🏠 HOME THEMES
          </button>
        </div>

        {/* Description */}
        <p style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 18, lineHeight: 1.5 }}>
          {tab === "level"
            ? "Visual styles for in-game levels. By default, the level is dynamically designed using the colors and mood of each song's album cover art."
            : "Visual styles for the home screen, navigation, library, and menus. Switch between the current Warm Papercraft look and the classic Dark Cyber Neon design."}
        </p>

        {/* LEVEL THEMES LIST */}
        {tab === "level" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {THEMES.map(theme => {
              const isActive = activeLevelTheme === theme.id;
              const isDefault = theme.id === "classic";
              return (
                <div
                  key={theme.id}
                  onClick={() => selectLevelTheme(theme.id)}
                  className="card-interactive"
                  style={{
                    padding: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    border: `2px solid ${isActive ? theme.preview.accent : "var(--border-subtle)"}`,
                    background: isActive ? "var(--bg-card-hover)" : "var(--bg-card)",
                    boxShadow: isActive ? `0 0 16px ${theme.preview.accent}44` : "var(--paper-shadow-sm)",
                  }}
                >
                  {/* Preview swatch */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: theme.preview.bg,
                      border: `1px solid ${theme.preview.accent}55`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 22,
                        top: 0,
                        width: 8,
                        height: 22,
                        background: theme.preview.pipe,
                        borderRadius: "0 0 2px 2px",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 22,
                        bottom: 12,
                        width: 8,
                        height: 20,
                        background: theme.preview.pipe,
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        top: 28,
                        width: 8,
                        height: 8,
                        background: theme.preview.accent,
                        borderRadius: "50%",
                        boxShadow: `0 0 6px ${theme.preview.accent}`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: 0,
                        right: 0,
                        height: 1.5,
                        background: theme.preview.accent,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 2,
                        right: 4,
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      {theme.icon}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          fontWeight: "bold",
                          color: isActive ? theme.preview.accent : "var(--text-primary)",
                          letterSpacing: 0.8,
                        }}
                      >
                        {theme.name.toUpperCase()}
                      </span>
                      {isDefault && (
                        <span
                          style={{
                            fontSize: 8.5,
                            background: "var(--accent)",
                            color: "#ffffff",
                            padding: "2px 5px",
                            borderRadius: 4,
                            fontWeight: 800,
                            letterSpacing: 0.8,
                          }}
                        >
                          MAIN
                        </span>
                      )}
                      {isActive && (
                        <span
                          style={{
                            fontSize: 8.5,
                            background: theme.preview.accent,
                            color: "#000000",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: "bold",
                            letterSpacing: 1,
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.45 }}>
                      {theme.description}
                    </div>
                  </div>

                  {/* Color dots */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.accent, border: "1px solid rgba(0,0,0,0.15)" }} />
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.pipe, border: "1px solid rgba(0,0,0,0.15)" }} />
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.bg, border: "1px solid rgba(0,0,0,0.15)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* HOME THEMES LIST */}
        {tab === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {HOME_THEMES.map(theme => {
              const isActive = activeHomeTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => selectHomeTheme(theme.id)}
                  className="card-interactive"
                  style={{
                    padding: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    border: `2px solid ${isActive ? theme.preview.accent : "var(--border-subtle)"}`,
                    background: isActive ? "var(--bg-card-hover)" : "var(--bg-card)",
                    boxShadow: isActive ? `0 0 16px ${theme.preview.accent}44` : "var(--paper-shadow-sm)",
                  }}
                >
                  {/* Swatch showing mini UI */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: theme.preview.bg,
                      border: `1.5px solid ${theme.preview.border}`,
                      position: "relative",
                      overflow: "hidden",
                      padding: 5,
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Mini card */}
                    <div
                      style={{
                        background: theme.preview.card,
                        border: `1px solid ${theme.preview.border}`,
                        borderRadius: 4,
                        padding: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: theme.preview.accent }} />
                      <div style={{ flex: 1, height: 3, borderRadius: 1.5, background: theme.preview.text, opacity: 0.6 }} />
                    </div>
                    {/* Mini button */}
                    <div
                      style={{
                        background: theme.preview.accent,
                        borderRadius: 3,
                        height: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ width: 14, height: 2, borderRadius: 1, background: "#ffffff" }} />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 1,
                        right: 3,
                        fontSize: 12,
                        lineHeight: 1,
                      }}
                    >
                      {theme.icon}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          fontWeight: "bold",
                          color: isActive ? theme.preview.accent : "var(--text-primary)",
                          letterSpacing: 0.8,
                        }}
                      >
                        {theme.name.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 8.5,
                          background: "var(--bg-elevated)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border-subtle)",
                          padding: "2px 5px",
                          borderRadius: 4,
                          fontWeight: 800,
                          letterSpacing: 0.8,
                        }}
                      >
                        {theme.badge}
                      </span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 8.5,
                            background: theme.preview.accent,
                            color: theme.id === "neon" ? "#000000" : "#ffffff",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: "bold",
                            letterSpacing: 1,
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.45 }}>
                      {theme.description}
                    </div>
                  </div>

                  {/* Color dots */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.accent, border: "1px solid rgba(0,0,0,0.15)" }} />
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.card, border: "1px solid rgba(0,0,0,0.15)" }} />
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.bg, border: "1px solid rgba(0,0,0,0.15)" }} />
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
