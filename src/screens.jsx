import { useState, useEffect, useRef, useCallback } from "react";

const FF = "Orbitron, monospace";
const FM = "'DM Sans', -apple-system, sans-serif";
const FM_MONO = "'Space Mono', monospace";

export function SetupScreen({ clientId, setClientId, login }) {
  return (
    <div style={{ minHeight: "100vh", background: "#050508", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: FM, padding: 24 }}>
      <style>{`
        @keyframes pulse-glow{0%,100%{box-shadow:0 0 24px 2px rgba(29,185,84,0.3)}50%{box-shadow:0 0 40px 8px rgba(29,185,84,0.55)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .sf-logo{animation:float 3s ease-in-out infinite;display:inline-block;font-size:56px}
        .sf-btn{transition:all 0.2s}.sf-btn:hover{background:#22dd66!important;transform:translateY(-2px);box-shadow:0 6px 28px rgba(29,185,84,0.5)!important}
        .sf-input:focus{border-color:#1DB954!important;box-shadow:0 0 0 2px rgba(29,185,84,0.2);outline:none}
        code{color:#1DB954;font-size:10px;word-break:break-all;display:block;margin-top:4px;background:rgba(29,185,84,0.08);padding:4px 8px;border-radius:4px}
      `}</style>
      <div className="sf-logo">🎵</div>
      <h1 style={{ fontFamily: FF, fontSize: 28, fontWeight: 900, color: "#1DB954", margin: "12px 0 4px", letterSpacing: 2, textShadow: "0 0 20px rgba(29,185,84,0.6)" }}>FLAPPYFY</h1>
      <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: 14, padding: 28, width: "100%", maxWidth: 420, animation: "pulse-glow 4s ease-in-out infinite" }}>
        <p style={{ color: "#a0a0b0", fontSize: 13, lineHeight: 1.9, marginBottom: 16, fontFamily: FM }}>
          <span style={{ color: "#1DB954", fontWeight: 700 }}>Step 1 —</span> Go to{" "}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "#1DB954" }}>developer.spotify.com/dashboard</a><br />
          <span style={{ color: "#1DB954", fontWeight: 700 }}>Step 2 —</span> Create app → Settings → Redirect URIs → Add:
          <code>{typeof window !== "undefined" ? location.origin + location.pathname : ""}</code>
          <span style={{ color: "#1DB954", fontWeight: 700 }}>Step 3 —</span> Paste your Client ID below
        </p>
        <input className="sf-input" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" onKeyDown={e => e.key === "Enter" && login()}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #252535", background: "#080810", color: "#fff", fontSize: 14, fontFamily: FM_MONO, letterSpacing: 1.5, boxSizing: "border-box", transition: "border-color 0.2s" }} />
        <button className="sf-btn" onClick={login}
          style={{ marginTop: 14, width: "100%", padding: 14, background: "#1DB954", border: "none", borderRadius: 10, color: "#000", fontWeight: "bold", fontSize: 14, cursor: "pointer", fontFamily: FF, letterSpacing: 2, boxShadow: "0 4px 20px rgba(29,185,84,0.35)" }}>
          CONNECT SPOTIFY →
        </button>
      </div>
      <p style={{ color: "#353545", fontSize: 11, marginTop: 24, letterSpacing: 0.5, textAlign: "center", fontFamily: FM }}>
        BPM → Speed · Energy → Gap Size · Album Art → Colors · Drops → Shockwaves
      </p>
    </div>
  );
}

export function PlaylistScreen({ playlists, loadTracks }) {
  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#fff", fontFamily: FM, padding: "24px 20px" }}>
      <style>{`.pl-card{transition:all 0.25s cubic-bezier(0.4,0,0.2,1)}.pl-card:hover{border-color:#1DB954!important;transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.5)!important}`}</style>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <h2 style={{ fontFamily: FF, color: "#1DB954", textAlign: "center", marginBottom: 6, letterSpacing: 2, textShadow: "0 0 16px rgba(29,185,84,0.5)", fontSize: 16 }}>SELECT PLAYLIST</h2>
        <p style={{ textAlign: "center", color: "#707080", fontSize: 12, marginBottom: 24, fontFamily: FM }}>Choose your soundtrack</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12 }}>
          {playlists.map(p => (
            <div key={p.id} className="pl-card" onClick={() => loadTracks(p)}
              style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: 10, padding: 10, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
              {p.images?.[0] && <img src={p.images[0].url} style={{ width: "100%", borderRadius: 6, display: "block", aspectRatio: "1" }} alt="" />}
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#707080", marginTop: 2 }}>{p.tracks?.total} tracks</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackScreen({ tracks, selPl, pickTrack, setScreen }) {
  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#fff", fontFamily: FM, padding: "24px 20px" }}>
      <style>{`
        .tk-row{transition:all 0.2s cubic-bezier(0.4,0,0.2,1)}.tk-row:hover{border-color:#1DB954!important;background:#12121c!important}
        .back-btn{transition:all 0.2s}.back-btn:hover{border-color:#1DB954!important;color:#1DB954!important}
      `}</style>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <button className="back-btn" onClick={() => setScreen("playlists")}
            style={{ background: "none", border: "1px solid #252535", color: "#707080", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontFamily: FM, fontSize: 12, fontWeight: 500 }}>
            ← Back
          </button>
          <h2 style={{ fontFamily: FF, color: "#1DB954", margin: 0, fontSize: 14, letterSpacing: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selPl?.name?.toUpperCase()}
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {tracks.map(t => (
            <div key={t.id} className="tk-row" onClick={() => pickTrack(t)}
              style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: 8, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, minHeight: 56 }}>
              {t.album?.images?.[2] && <img src={t.album.images[2].url} style={{ width: 44, height: 44, borderRadius: 6, flexShrink: 0 }} alt="" />}
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div className="music-title" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                <div className="music-artist" style={{ fontSize: 11, marginTop: 2 }}>{t.artists?.map(a => a.name).join(", ")}</div>
              </div>
              <div style={{ marginLeft: "auto", color: "#1DB954", fontSize: 20, flexShrink: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>▶</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen({ loadMsg }) {
  return (
    <div style={{ minHeight: "100vh", background: "#050508", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FM }}>
      <style>{`@keyframes spin-slow{to{transform:rotate(360deg)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, animation: "spin-slow 2s linear infinite", display: "inline-block" }}>🎵</div>
        <div style={{ fontFamily: FF, color: "#1DB954", fontSize: 13, letterSpacing: 3, marginTop: 20, textShadow: "0 0 16px rgba(29,185,84,0.6)" }}>ANALYZING TRACK</div>
        <div style={{ color: "#707080", fontSize: 12, marginTop: 10, animation: "blink 1.4s ease-in-out infinite", fontFamily: FM }}>{loadMsg}</div>
      </div>
    </div>
  );
}

export function CalibrationScreen({ features, palette, onComplete, onSkip }) {
  const [phase, setPhase] = useState("intro");
  const [taps, setTaps] = useState([]);
  const [beatCount, setBeatCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const animRef = useRef(null);
  const startTimeRef = useRef(0);
  const bpm = features?.tempo || 120;
  const beatInterval = 60 / bpm;
  const totalBeats = 12;

  const startCalibration = useCallback(() => {
    setPhase("tapping");
    setTaps([]);
    setBeatCount(0);
    startTimeRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (phase !== "tapping") return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const currentBeat = Math.floor(elapsed / beatInterval);
      if (currentBeat >= totalBeats) {
        if (taps.length >= 4) {
          const offsets = taps.map(t => {
            const nearestBeat = Math.round(t / beatInterval) * beatInterval;
            return t - nearestBeat;
          });
          const avgOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
          setOffset(Math.round(avgOffset * 1000));
          setPhase("done");
        } else {
          setPhase("done");
          setOffset(0);
        }
        return;
      }
      setBeatCount(currentBeat);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { alive = false; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, beatInterval, taps]);

  const handleTap = useCallback(() => {
    if (phase === "intro") { startCalibration(); return; }
    if (phase !== "tapping") return;
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    setTaps(prev => [...prev, elapsed]);
  }, [phase, startCalibration]);

  const pulseProgress = phase === "tapping" ?
    ((performance.now() - startTimeRef.current) / 1000 / beatInterval) % 1 : 0;

  return (
    <div onClick={handleTap}
      style={{ minHeight: "100vh", background: "#050508", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: FM, padding: 24,
        cursor: "pointer", userSelect: "none" }}>
      <style>{`
        @keyframes pulse-ring{0%{transform:scale(0.8);opacity:0.8}50%{transform:scale(1.2);opacity:0.3}100%{transform:scale(0.8);opacity:0.8}}
        .cal-pulse{animation:pulse-ring ${beatInterval}s ease-in-out infinite}
      `}</style>

      <h2 style={{ fontFamily: FF, color: palette?.base || "#1DB954", letterSpacing: 2, marginBottom: 8,
        textShadow: `0 0 16px ${palette?.glow || "rgba(29,185,84,0.5)"}`, fontSize: 16 }}>
        CALIBRATION
      </h2>

      {phase === "intro" && (
        <>
          <p style={{ color: "#a0a0b0", fontSize: 13, textAlign: "center", maxWidth: 340, lineHeight: 1.7, marginBottom: 24, fontFamily: FM }}>
            Tap along with the visual pulse to calibrate audio timing for your device.
          </p>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `2px solid ${palette?.base || "#1DB954"}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 24 }}
            className="cal-pulse">
            🎯
          </div>
          <p style={{ color: palette?.base || "#1DB954", fontSize: 12, fontFamily: FF, letterSpacing: 2 }}>
            TAP TO START
          </p>
          <button onClick={e => { e.stopPropagation(); onSkip(); }}
            style={{ marginTop: 24, background: "none", border: "1px solid #252535", color: "#707080",
              padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontFamily: FM, fontSize: 12, fontWeight: 500 }}>
            Skip →
          </button>
        </>
      )}

      {phase === "tapping" && (
        <>
          <div style={{ width: 120, height: 120, borderRadius: "50%",
            background: `radial-gradient(circle, ${palette?.bright || "#4ade80"}, ${palette?.base || "#1DB954"})`,
            opacity: 0.3 + Math.max(0, 1 - pulseProgress) * 0.7,
            transform: `scale(${0.7 + Math.max(0, 1 - pulseProgress) * 0.5})`,
            transition: "none",
            boxShadow: `0 0 ${30 + (1 - pulseProgress) * 30}px ${palette?.glow || "rgba(29,185,84,0.5)"}`,
            marginBottom: 24 }} />
          <p style={{ color: "#a0a0b0", fontSize: 12, fontFamily: FM }}>
            Beat {Math.min(beatCount + 1, totalBeats)} / {totalBeats} · {taps.length} taps recorded
          </p>
          <p style={{ color: "#707080", fontSize: 11, marginTop: 8, fontFamily: FM }}>Tap with the pulse</p>
        </>
      )}

      {phase === "done" && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <p style={{ color: "#a0a0b0", fontSize: 13, marginBottom: 8, fontFamily: FM }}>
            {taps.length >= 4 ? `Offset: ${offset > 0 ? "+" : ""}${offset}ms` : "Not enough taps — using no offset"}
          </p>
          <button onClick={e => { e.stopPropagation(); onComplete(offset / 1000); }}
            style={{ marginTop: 12, padding: "10px 32px", background: palette?.base || "#1DB954",
              border: "none", borderRadius: 10, color: "#000", fontWeight: "bold", fontSize: 13,
              cursor: "pointer", fontFamily: FF, letterSpacing: 2 }}>
            APPLY
          </button>
          <button onClick={e => { e.stopPropagation(); onComplete(0); }}
            style={{ marginTop: 8, background: "none", border: "1px solid #252535", color: "#707080",
              padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontFamily: FM, fontSize: 12 }}>
            Skip
          </button>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   GameScreen — Redesigned per critique:
   • Difficulty selector REMOVED from tap zone (pre-game only)
   • Song progress bar added (top edge)
   • Consolidated HUD: no duplicate BPM/best
   • Feedback shows near sprite (renderer handles this)
   • Bottom bar only has pause + score (no interactive buttons)
   ═══════════════════════════════════════════════════════════ */
export function GameScreen({ W, H, canvasRef, track, features, palette, score, best, combo, difficulty, setDifficulty, flap, setScreen, togglePause, paused, onCalibrate, calibrationOffset, onBackToMenu, trackKey }) {
  const [showPreGame, setShowPreGame] = useState(true);
  const [songProgress, setSongProgress] = useState(0);

  // Reset pre-game interstitial whenever a new track is picked
  useEffect(() => { setShowPreGame(true); }, [trackKey]);

  // Update song progress from game state
  useEffect(() => {
    if (showPreGame) return;
    const interval = setInterval(() => {
      const el = document.querySelector("canvas");
      if (el && el.__gameState) {
        const g = el.__gameState;
        if (g.songDur > 0 && g.gt > 0) {
          setSongProgress(Math.min(100, (g.gt / g.songDur) * 100));
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [showPreGame]);

  /* ── Always render both the canvas (hidden) and whichever UI is active ──
     The canvas MUST be in the DOM at all times so the game loop in
     SpotifyFlappy.jsx can grab canvasRef.current and call initGame().
     During the pre-game interstitial the canvas sits offscreen (0×0),
     then expands once the user taps GO. */

  return (
    <div style={{ minHeight: "100vh", background: "#050508", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FM, userSelect: "none", WebkitTapHighlightColor: "transparent", position: "relative" }}>

      {/* ── Canvas (always mounted so game loop can init) ── */}
      {/* When pre-game is showing, canvas is 1x1 offscreen so it exists in DOM
          but doesn't interfere with layout. When gameplay starts, it renders normally. */}
      <canvas ref={canvasRef} width={W} height={H}
        onClick={e => { if (!showPreGame) flap(); }}
        style={{
          position: showPreGame ? "fixed" : "static",
          left: showPreGame ? -9999 : undefined,
          top: showPreGame ? -9999 : undefined,
          width: showPreGame ? 1 : undefined,
          height: showPreGame ? 1 : undefined,
          opacity: showPreGame ? 0 : 1,
          pointerEvents: showPreGame ? "none" : "auto",
          display: "block", cursor: showPreGame ? "default" : "pointer",
          borderLeft: showPreGame ? "none" : `1px solid ${palette?.base || "#1DB954"}22`,
          borderRight: showPreGame ? "none" : `1px solid ${palette?.base || "#1DB954"}22`,
          order: 0,
        }} />

      {/* ═══ Pre-game interstitial overlay ═══ */}
      {showPreGame && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" }}>
          <style>{`
            .diff-btn{transition:all 0.2s cubic-bezier(0.4,0,0.2,1);min-width:100px;min-height:48px}
            .diff-btn:hover{transform:translateY(-2px)}
            .go-btn{transition:all 0.2s}.go-btn:hover{transform:scale(1.05);box-shadow:0 8px 40px rgba(29,185,84,0.5)!important}
          `}</style>

          {/* Album art + track info */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {track?.album?.images?.[0] && (
              <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
                <img src={track.album.images[0].url} alt=""
                  style={{ width: 140, height: 140, borderRadius: 14, border: `2px solid ${palette?.base || "#1DB954"}44`,
                    boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 40px ${palette?.glow || "rgba(29,185,84,0.15)"}` }} />
                {/* BPM badge */}
                <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
                  background: "#0d0d14", border: `1px solid ${palette?.base || "#1DB954"}66`, borderRadius: 20,
                  padding: "3px 12px", fontFamily: FF, fontSize: 11, color: palette?.base || "#1DB954",
                  letterSpacing: 1, whiteSpace: "nowrap" }}>
                  {features?.tempo ? `${Math.round(features.tempo)} BPM` : "—"}
                </div>
              </div>
            )}
            <div className="music-title" style={{ fontSize: 18, marginBottom: 4, maxWidth: 300 }}>{track?.name}</div>
            <div className="music-artist" style={{ fontSize: 13 }}>{track?.artists?.map(a => a.name).join(", ")}</div>
            {best > 0 && (
              <div style={{ marginTop: 8, fontFamily: FF, fontSize: 10, color: "#707080", letterSpacing: 2 }}>
                BEST: <span style={{ color: "#FFD700" }}>{best}</span>
              </div>
            )}
          </div>

          {/* GO button */}
          <button className="go-btn"
            onClick={() => { setShowPreGame(false); }}
            style={{
              width: 200, padding: "16px 0",
              background: `linear-gradient(135deg, ${palette?.base || "#1DB954"}, ${palette?.bright || "#4ade80"})`,
              border: "none", borderRadius: 14, color: "#000", fontWeight: 900,
              fontSize: 20, cursor: "pointer", fontFamily: FF, letterSpacing: 4,
              boxShadow: `0 6px 30px ${palette?.glow || "rgba(29,185,84,0.4)"}`,
            }}>
            GO ▶
          </button>

          {/* Calibration + Back */}
          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <button onClick={onCalibrate}
              style={{ background: "none", border: "1px solid #1a1a28", color: calibrationOffset ? palette?.base || "#1DB954" : "#505060",
                padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: FM, fontSize: 11, fontWeight: 500 }}>
              ⚙ Calibrate{calibrationOffset ? ` (${(calibrationOffset * 1000).toFixed(0)}ms)` : ""}
            </button>
            <button onClick={() => { if (onBackToMenu) onBackToMenu(); else setScreen("menu"); }}
              style={{ background: "none", border: "1px solid #1a1a28", color: "#505060",
                padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: FM, fontSize: 11, fontWeight: 500 }}>
              ← Menu
            </button>
          </div>
        </div>
      )}

      {/* ═══ Gameplay UI (shown after GO) ═══ */}
      {!showPreGame && (
        <>
          {/* ── Song Progress Bar (thin, top edge) ── */}
          <div style={{ width: W, height: 3, background: "#1a1a28", borderRadius: "10px 10px 0 0", overflow: "hidden", order: -2 }}>
            <div style={{
              height: "100%", width: `${songProgress}%`,
              background: `linear-gradient(90deg, ${palette?.base || "#1DB954"}, ${palette?.bright || "#4ade80"})`,
              transition: "width 0.5s ease", borderRadius: "2px",
            }} />
          </div>

          {/* ── Compact Top Bar: track info + pause ── */}
          <div style={{ width: W, background: "#0a0a12", borderLeft: "1px solid #1a1a28", borderRight: "1px solid #1a1a28", padding: "6px 12px", display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box", order: -1 }}>
            {track?.album?.images?.[2] && (
              <img src={track.album.images[2].url} style={{ width: 30, height: 30, borderRadius: 4, flexShrink: 0, border: `1px solid ${palette?.base || "#1DB954"}33` }} alt="" />
            )}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div className="music-title" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track?.name}</div>
              <div className="music-artist" style={{ fontSize: 9, marginTop: 1 }}>{track?.artists?.map(a => a.name).join(", ")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FF, fontSize: 10, color: "#b0b0c0", letterSpacing: 1 }}>{features?.tempo ? Math.round(features.tempo) : "—"}<span style={{ fontSize: 8, color: "#606070" }}> BPM</span></div>
              </div>
              <button onClick={e => { e.stopPropagation(); togglePause(); }}
                id="pause-btn"
                style={{ background: paused ? palette?.base || "#1DB954" : "none", border: `1px solid ${paused ? palette?.base || "#1DB954" : "#252535"}`,
                  color: paused ? "#000" : "#a0a0b0", padding: "5px 9px", borderRadius: 6,
                  cursor: "pointer", fontSize: 14, lineHeight: 1, transition: "all 0.15s",
                  minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {paused ? "▶" : "⏸"}
              </button>
            </div>
          </div>

          {/* ── Minimal Footer: score only (NO interactive buttons in tap zone) ── */}
          <div style={{
            width: W, background: "#0a0a12", borderLeft: "1px solid #1a1a28", borderRight: "1px solid #1a1a28",
            borderRadius: "0 0 10px 10px", padding: "5px 14px",
            display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box",
          }}>
            <div style={{ fontFamily: FF, fontSize: 12, color: "#f5a623", letterSpacing: 1 }}>
              {score.toLocaleString()}
              {combo > 1 && <span style={{ fontSize: 9, color: "#FFD700", marginLeft: 6 }}>×{combo}</span>}
            </div>
          </div>

          {/* ── Pause overlay: Menu + Resume buttons ── */}
          {paused && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 20,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "rgba(5,5,8,0.7)", backdropFilter: "blur(4px)",
            }}>
              <div style={{ fontFamily: FF, fontSize: 28, color: "#fff", letterSpacing: 4, marginBottom: 24, textShadow: `0 0 20px ${palette?.glow || "rgba(29,185,84,0.5)"}` }}>PAUSED</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 180 }}>
                <button onClick={e => { e.stopPropagation(); togglePause(); }}
                  style={{
                    padding: "14px 0", borderRadius: 10, border: "none", cursor: "pointer",
                    background: `linear-gradient(135deg, ${palette?.base || "#1DB954"}, ${palette?.bright || "#4ade80"})`,
                    color: "#000", fontFamily: FF, fontSize: 13, fontWeight: 900, letterSpacing: 2,
                    boxShadow: `0 4px 20px ${palette?.glow || "rgba(29,185,84,0.4)"}`,
                  }}>
                  RESUME ▶
                </button>
                <button onClick={e => { e.stopPropagation(); if (onBackToMenu) onBackToMenu(); else setScreen("menu"); }}
                  style={{
                    padding: "12px 0", borderRadius: 10,
                    background: "none", border: "1px solid #353545",
                    color: "#b0b0c0", fontFamily: FM, fontSize: 12, fontWeight: 600, letterSpacing: 1,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                  ← Back to Menu
                </button>
              </div>
              <div style={{ marginTop: 16, fontFamily: FM, fontSize: 10, color: "#606070" }}>
                press ESC or tap ⏸ to resume
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
