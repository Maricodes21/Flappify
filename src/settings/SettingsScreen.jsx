import { useState } from "react";
import { getSetting, saveSetting, getCalibration, saveCalibration, getPlayerLevel, getTotalStats } from "../services/storage";

export default function SettingsScreen({ onBack, onCalibrate, onNavigate, onDifficultyChange, userProfile, onLogout, spotifyConnected, onConnectSpotify, onOpenTaste }) {
  const [sfxVol, setSfxVol] = useState(getSetting("sfxVolume", 80));
  const [musicVol, setMusicVol] = useState(getSetting("musicVolume", 80));
  const [defaultDiff, setDefaultDiff] = useState(getSetting("defaultDifficulty", "normal"));
  const [showGrades, setShowGrades] = useState(getSetting("showGrades", true));
  const [colorblind, setColorblind] = useState(getSetting("colorblindMode", false));
  const [showTrailDots, setShowTrailDots] = useState(getSetting("showTrailDots", true));
  const [showTrailingLine, setShowTrailingLine] = useState(getSetting("showTrailingLine", true));
  const calibOffset = getCalibration();
  const level = getPlayerLevel();
  const stats = getTotalStats();

  const save = (name, value, setter) => {
    setter(value);
    saveSetting(name, value);
  };

  const handleClearData = () => {
    if (confirm("Clear all local data? This will reset scores, settings, and sprite selection.")) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("sf_"));
      keys.forEach(k => localStorage.removeItem(k));
      window.location.reload();
    }
  };

  const SettingRow = ({ label, children }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      {children}
    </div>
  );

  const SectionHeader = ({ children }) => (
    <div className="section-title" style={{ marginTop: 20, marginBottom: 8 }}>
      {children}
    </div>
  );

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "7px 14px", fontSize: 12 }}>← BACK</button>
          <h2 className="neon-heading" style={{ fontSize: 16, margin: 0 }}>SETTINGS</h2>
        </div>

        {/* Account */}
        <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {userProfile?.images?.[0]?.url && (
              <img src={userProfile.images[0].url} alt="" style={{
                width: 48, height: 48, borderRadius: "50%",
                border: "2px solid var(--border-subtle)"
              }} />
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: "bold" }}>{userProfile?.display_name || "Local Player"}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                {level.emoji} {level.name} · {stats.totalPlays || 0} plays · {spotifyConnected ? "Spotify connected" : "local mode"}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: "4px 16px" }}>
          {/* Audio */}
          <SectionHeader>AUDIO</SectionHeader>
          <SettingRow label="SFX Volume">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min="0" max="100" value={sfxVol}
                aria-label="Sound effects volume"
                onChange={e => save("sfxVolume", parseInt(e.target.value), setSfxVol)}
                style={{ width: 100 }} />
              <span style={{ fontSize: 10, color: "var(--text-dim)", width: 28, textAlign: "right" }}>{sfxVol}%</span>
            </div>
          </SettingRow>
          <SettingRow label="Music Volume">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min="0" max="100" value={musicVol}
                aria-label="Music volume"
                onChange={e => save("musicVolume", parseInt(e.target.value), setMusicVol)}
                style={{ width: 100 }} />
              <span style={{ fontSize: 10, color: "var(--text-dim)", width: 28, textAlign: "right" }}>{musicVol}%</span>
            </div>
          </SettingRow>
          <SettingRow label="Calibration">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: calibOffset ? "var(--accent)" : "var(--text-dim)" }}>
                {calibOffset ? `${(calibOffset * 1000).toFixed(0)}ms` : "none"}
              </span>
              <button className="btn-ghost" onClick={onCalibrate}
                style={{ padding: "4px 10px", fontSize: 10 }}>
                CALIBRATE
              </button>
            </div>
          </SettingRow>

          {/* Gameplay */}
          <SectionHeader>GAMEPLAY</SectionHeader>
          <SettingRow label="Run Difficulty">
            <div style={{ display: "flex", gap: 4 }}>
              {["easy", "normal", "hard"].map(d => (
                <button key={d} onClick={() => {
                  save("defaultDifficulty", d, setDefaultDiff);
                  onDifficultyChange?.(d);
                }}
                  aria-pressed={defaultDiff === d}
                  style={{
                    background: defaultDiff === d ? "var(--accent)" : "var(--bg-card)",
                    border: "1.5px solid var(--border-subtle)",
                    color: defaultDiff === d ? "#fff" : "var(--text-primary)",
                    padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                    fontSize: 9, fontFamily: "var(--font-music)", fontWeight: 800, letterSpacing: 1,
                    boxShadow: "var(--paper-shadow-sm)"
                  }}>
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="Show Timing Grades">
            <button className={`toggle-switch ${showGrades ? "active" : ""}`}
              type="button" aria-label="Show timing grades" aria-pressed={showGrades}
              onClick={() => save("showGrades", !showGrades, setShowGrades)} />
          </SettingRow>

          {/* Display */}
          <SectionHeader>DISPLAY</SectionHeader>
          <SettingRow label="Colorblind Mode">
            <button className={`toggle-switch ${colorblind ? "active" : ""}`}
              type="button" aria-label="Colorblind grade cues" aria-pressed={colorblind}
              onClick={() => save("colorblindMode", !colorblind, setColorblind)} />
          </SettingRow>
          <SettingRow label="Trailing Line">
            <button className={`toggle-switch ${showTrailingLine ? "active" : ""}`}
              type="button" aria-label="Show trailing rhythm line" aria-pressed={showTrailingLine}
              onClick={() => save("showTrailingLine", !showTrailingLine, setShowTrailingLine)} />
          </SettingRow>
          <SettingRow label="Trail Dots">
            <button className={`toggle-switch ${showTrailDots ? "active" : ""}`}
              type="button" aria-label="Show trail dots" aria-pressed={showTrailDots}
              onClick={() => save("showTrailDots", !showTrailDots, setShowTrailDots)} />
          </SettingRow>

          {/* Customizations */}
          <SectionHeader>CUSTOMIZATIONS</SectionHeader>
          <SettingRow label="Customize Bird">
            <button className="btn-ghost" onClick={() => onNavigate("sprites")}
              style={{ padding: "4px 12px", fontSize: 10 }}>
              CUSTOMIZE →
            </button>
          </SettingRow>

          {/* Account Actions */}
          <SectionHeader>ACCOUNT</SectionHeader>
          <SettingRow label="Taste Sources">
            <button className="btn-ghost" onClick={onOpenTaste}
              style={{ padding: "4px 12px", fontSize: 10 }}>
              MANAGE →
            </button>
          </SettingRow>
          <SettingRow label="Spotify Account">
            <button className="btn-ghost" onClick={spotifyConnected ? onLogout : onConnectSpotify}
              style={{ padding: "4px 12px", fontSize: 10, borderColor: spotifyConnected ? "var(--danger)" : "var(--accent)", color: spotifyConnected ? "var(--danger)" : "var(--accent)" }}>
              {spotifyConnected ? "LOG OUT" : "LOG IN"}
            </button>
          </SettingRow>
          <SettingRow label="Clear Local Data">
            <button className="btn-ghost" onClick={handleClearData}
              style={{ padding: "4px 12px", fontSize: 10, borderColor: "var(--danger)", color: "var(--danger)" }}>
              CLEAR
            </button>
          </SettingRow>
        </div>

        {/* About */}
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 10 }}>
          <div>Flappyfy Web v2.0</div>
          <div style={{ marginTop: 4 }}>LOCAL FULL SYNC · TASTE-LED DISCOVERY</div>
        </div>
      </div>
    </div>
  );
}
