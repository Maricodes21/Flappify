import { useState } from "react";
import { getSetting, saveSetting, getCalibration, saveCalibration, getPlayerLevel, getTotalStats } from "../services/storage";

export default function SettingsScreen({ onBack, onCalibrate, onNavigate, userProfile, onLogout }) {
  const [sfxVol, setSfxVol] = useState(getSetting("sfxVolume", 80));
  const [musicVol, setMusicVol] = useState(getSetting("musicVolume", 80));
  const [defaultDiff, setDefaultDiff] = useState(getSetting("defaultDifficulty", "normal"));
  const [showGrades, setShowGrades] = useState(getSetting("showGrades", true));
  const [colorblind, setColorblind] = useState(getSetting("colorblindMode", false));
  const [particleDensity, setParticleDensity] = useState(getSetting("particleDensity", 100));
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
                border: "2px solid var(--accent)"
              }} />
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: "bold" }}>{userProfile?.display_name || "Spotify User"}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                {level.emoji} {level.name} · {stats.totalPlays || 0} plays
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
                onChange={e => save("sfxVolume", parseInt(e.target.value), setSfxVol)}
                style={{ width: 100 }} />
              <span style={{ fontSize: 10, color: "var(--text-dim)", width: 28, textAlign: "right" }}>{sfxVol}%</span>
            </div>
          </SettingRow>
          <SettingRow label="Music Volume">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min="0" max="100" value={musicVol}
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
          <SettingRow label="Default Difficulty">
            <div style={{ display: "flex", gap: 4 }}>
              {["easy", "normal", "hard"].map(d => (
                <button key={d} onClick={() => save("defaultDifficulty", d, setDefaultDiff)}
                  style={{
                    background: defaultDiff === d ? "var(--accent)" : "none",
                    border: `1px solid ${defaultDiff === d ? "var(--accent)" : "var(--border-subtle)"}`,
                    color: defaultDiff === d ? "#000" : "var(--text-muted)",
                    padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                    fontSize: 9, fontFamily: "var(--font-body)", letterSpacing: 1
                  }}>
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="Show Timing Grades">
            <button className={`toggle-switch ${showGrades ? "active" : ""}`}
              onClick={() => save("showGrades", !showGrades, setShowGrades)} />
          </SettingRow>

          {/* Display */}
          <SectionHeader>DISPLAY</SectionHeader>
          <SettingRow label="Colorblind Mode">
            <button className={`toggle-switch ${colorblind ? "active" : ""}`}
              onClick={() => save("colorblindMode", !colorblind, setColorblind)} />
          </SettingRow>
          <SettingRow label="Particle Density">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min="0" max="100" value={particleDensity}
                onChange={e => save("particleDensity", parseInt(e.target.value), setParticleDensity)}
                style={{ width: 100 }} />
              <span style={{ fontSize: 10, color: "var(--text-dim)", width: 28, textAlign: "right" }}>{particleDensity}%</span>
            </div>
          </SettingRow>

          {/* Sprite */}
          <SectionHeader>SPRITE</SectionHeader>
          <SettingRow label="Customize Bird">
            <button className="btn-ghost" onClick={() => onNavigate("sprites")}
              style={{ padding: "4px 12px", fontSize: 10 }}>
              CUSTOMIZE →
            </button>
          </SettingRow>

          {/* Account Actions */}
          <SectionHeader>ACCOUNT</SectionHeader>
          <SettingRow label="Logout">
            <button className="btn-ghost" onClick={onLogout}
              style={{ padding: "4px 12px", fontSize: 10, borderColor: "var(--danger)", color: "var(--danger)" }}>
              LOGOUT
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
          <div>Spotify Flappy v2.0</div>
          <div style={{ marginTop: 4 }}>MUSIC-DRIVEN · BEAT-SYNCED · NEON-FUELED</div>
        </div>
      </div>
    </div>
  );
}
