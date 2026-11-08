import { useState, useEffect, useRef, useCallback } from "react";

const FF = "Orbitron, monospace";
const FM = "'DM Sans', -apple-system, sans-serif";
const FM_MONO = "'Space Mono', monospace";

export function SpotifyIcon({ size = 20, color = "#000" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.305c-.215.353-.674.466-1.027.252-2.812-1.718-6.353-2.107-10.523-1.154-.403.092-.806-.157-.898-.56-.092-.403.157-.806.56-.898 4.567-1.043 8.49-.604 11.636 1.333.353.214.466.674.252 1.027zm1.468-3.265c-.27.439-.844.577-1.283.308-3.22-1.979-8.128-2.552-11.936-1.396-.496.15-1.025-.133-1.176-.628-.15-.496.133-1.025.628-1.176 4.354-1.321 9.775-.682 13.459 1.583.439.27.577.844.308 1.283zm.126-3.41c-3.86-2.292-10.226-2.503-13.89-1.391-.592.179-1.22-.162-1.399-.754-.18-.592.162-1.22.754-1.399 4.218-1.28 11.233-1.036 15.672 1.597.532.316.708 1.006.392 1.538-.316.532-1.006.708-1.538.392z" />
    </svg>
  );
}

export function SetupScreen({
  login,
  authError,
  onBack,
  userProfile,
  isConnected = false,
  onLogout
}) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
    } catch (e) {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="screen-scroll fade-in" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-primary)", fontFamily: FM, padding: "72px 24px 40px", boxSizing: "border-box" }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .sf-brand-badge{width:64px;height:64px;border-radius:50%;background:#274e37;display:grid;place-items:center;margin-bottom:14px;border:2px solid var(--border-subtle);box-shadow:var(--paper-shadow)}
        .sf-login-btn{transition:all 0.15s ease;display:flex;align-items:center;justify-content:center;gap:10px}
        .sf-login-btn:hover{background:#335f41!important;transform:translateY(-1px);box-shadow:var(--paper-shadow)!important}
        .sf-login-btn:active{transform:translate(1px, 1px)}
        .sf-secondary-btn{transition:all 0.15s;background:var(--bg-card);border:1.5px solid var(--border-subtle);color:var(--text-primary);box-shadow:var(--paper-shadow-sm)}
        .sf-secondary-btn:hover{background:#fff;transform:translateY(-1px);box-shadow:var(--paper-shadow)}
        .sf-feature-item{display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:10px;background:var(--bg-elevated);border:1px solid rgba(43,35,28,0.18)}
        .sf-feature-icon{width:32px;height:32px;border-radius:8px;background:#edd5be;color:#274e37;display:grid;place-items:center;font-size:16px;flex-shrink:0;border:1px solid var(--border-subtle)}
      `}</style>
      <button className="btn-ghost" onClick={onBack} style={{ position: "fixed", top: 20, left: 20, padding: "9px 14px", minHeight: 44, zIndex: 10 }}>← HOME</button>

      <div className="sf-brand-badge">
        <SpotifyIcon size={38} color="#ffffff" />
      </div>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 6px", letterSpacing: 1, textAlign: "center" }}>
        {isConnected ? "SPOTIFY CONNECTED" : "LOG IN WITH SPOTIFY"}
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 24px", textAlign: "center", maxWidth: 420, lineHeight: 1.5 }}>
        {isConnected
          ? "Your Spotify account is connected. You can play your library and catalog tracks."
          : "Connect your Spotify account to sync your playlists, top tracks, and play with real music."}
      </p>

      <div style={{ background: "var(--bg-card)", border: "1.5px solid var(--border-subtle)", borderRadius: 16, padding: "24px 22px", width: "100%", maxWidth: 460, boxShadow: "var(--paper-shadow)", boxSizing: "border-box" }}>
        {isConnected && userProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: 14, borderRadius: 12, background: "rgba(46,83,57,0.08)", border: "1.5px solid var(--border-subtle)", boxSizing: "border-box" }}>
              {userProfile.images?.[0]?.url ? (
                <img src={userProfile.images[0].url} alt="" style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #274e37" }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#274e37", color: "#fff", display: "grid", placeItems: "center", fontWeight: "bold", fontSize: 18 }}>
                  {userProfile.display_name?.slice(0, 1) || "S"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: "bold", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {userProfile.display_name || "Spotify User"}
                </div>
                <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                  Active Spotify Session
                </div>
              </div>
            </div>

            <button className="sf-btn sf-login-btn btn-primary" onClick={onBack}
              style={{ width: "100%", padding: 14, borderRadius: 10, fontSize: 13, cursor: "pointer", letterSpacing: 1.5 }}>
              CONTINUE TO GAME →
            </button>

            {onLogout && (
              <button className="sf-secondary-btn" onClick={onLogout}
                style={{ width: "100%", padding: 12, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, borderColor: "var(--border-subtle)", color: "#b83c2e" }}>
                LOG OUT / SWITCH ACCOUNT
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div className="sf-feature-item">
                <div className="sf-feature-icon">♫</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--text-primary)" }}>Playlists & Top Tracks</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Fly through levels built directly from your favorite songs</div>
                </div>
              </div>

              <div className="sf-feature-item">
                <div className="sf-feature-icon">⚡</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--text-primary)" }}>Rhythm Beat-Sync</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Pipes and obstacles dynamically sync to audio tempo and energy</div>
                </div>
              </div>

              <div className="sf-feature-item">
                <div className="sf-feature-icon">🔒</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--text-primary)" }}>Direct Spotify Sign-In</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Authenticate securely with Spotify using PKCE (no password shared)</div>
                </div>
              </div>
            </div>

            {authError && <div className="spotify-auth-error" role="alert" aria-live="polite" style={{ marginBottom: 14 }}>{authError}</div>}

            <button className="sf-btn sf-login-btn btn-primary" onClick={handleLogin} disabled={isLoggingIn}
              style={{ width: "100%", padding: 15, borderRadius: 10, fontSize: 13, cursor: isLoggingIn ? "wait" : "pointer", letterSpacing: 1.5, opacity: isLoggingIn ? 0.75 : 1 }}>
              <SpotifyIcon size={20} color="#ffffff" />
              {isLoggingIn ? "CONNECTING..." : "LOG IN WITH SPOTIFY"}
            </button>

            <button className="sf-secondary-btn" onClick={onBack}
              style={{ width: "100%", padding: 12, marginTop: 10, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
              SKIP FOR NOW
            </button>
          </>
        )}
      </div>

      <p style={{ color: "#5d6070", fontSize: 11, marginTop: 20, letterSpacing: 0.5, textAlign: "center", fontFamily: FM, maxWidth: 380, lineHeight: 1.6 }}>
        Local audio uploads never require Spotify. Spotify login is used for catalog streaming and personalized playlists.
      </p>
    </div>
  );
}

export function TasteSetupScreen({ initialProfiles, onSave, onBack, spotifyConnected, onConnectSpotify }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const update = (field, value) => setProfiles(current => ({ ...current, [field]: value }));
  const lastFmAvailable = Boolean(initialProfiles.lastFmApiKey);

  return (
    <main className="screen-scroll fade-in" style={{ paddingBottom: 48 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "9px 14px", minHeight: 44 }}>← HOME</button>
          <div>
            <div style={{ fontFamily: FF, fontSize: 9, color: "#00f0ff", letterSpacing: 2.5 }}>TASTE LAYER</div>
            <h1 style={{ margin: "4px 0 0", fontFamily: FF, fontSize: 19, letterSpacing: 1 }}>MAKE IT FEEL LIKE YOURS</h1>
          </div>
        </header>

        <section className="taste-explainer" aria-label="How music sources work">
          <div className="taste-flow-step taste-flow-step--active">
            <strong>YOUR HISTORY</strong><small>Spotify works now; Last.fm is the private build's optional taste source.</small>
          </div>
          <div className="taste-flow-line" aria-hidden="true" />
          <div className="taste-flow-step">
            <strong>CATALOG MATCH</strong><small>For now, Spotify finds the playable version.</small>
          </div>
          <div className="taste-flow-line" aria-hidden="true" />
          <div className="taste-flow-step">
            <strong>LIGHT MAP</strong><small>The level uses a plausible generated rhythm map.</small>
          </div>
        </section>

        <section className="glass-card taste-primary-source" style={{ padding: 18, marginTop: 18 }}>
          <label className="taste-toggle-row">
            <input type="checkbox" checked={profiles.useSpotifyTaste !== false} onChange={event => update("useSpotifyTaste", event.target.checked)} />
            <span><strong>USE MY SPOTIFY TASTE</strong><small>Build the home recommendations from your Spotify top tracks. No username to find.</small></span>
          </label>
          {!spotifyConnected && (
            <button className="btn-primary" onClick={onConnectSpotify} style={{ width: "100%", minHeight: 46, marginTop: 14, fontSize: 10 }}>
              LOG IN WITH SPOTIFY TO USE THIS →
            </button>
          )}
        </section>

        <section className="taste-optional-card taste-lastfm-card">
          <div className="taste-source-heading"><strong>OPTIONAL LAST.FM TASTE</strong><small>Use it on its own when your listening history lives on Last.fm.</small></div>
          <div className="taste-optional-body">
          <label className="taste-field">
            <span>LAST.FM USERNAME OR PROFILE LINK</span>
            <input value={profiles.lastFmUser || ""} onChange={event => update("lastFmUser", event.target.value)} placeholder="Paste a last.fm/user/... profile link" autoComplete="off" />
            <small>{lastFmAvailable ? "This build has the shared Last.fm connection configured." : "You can save your profile now; Last.fm recommendations activate when the private build adds its shared key."}</small>
            <span className="taste-help-links"><a href="https://www.last.fm/join" target="_blank" rel="noreferrer">CREATE ACCOUNT ↗</a><a href="https://www.last.fm/home" target="_blank" rel="noreferrer">OPEN LAST.FM ↗</a></span>
          </label>
          </div>
        </section>

        <button className="btn-primary" onClick={() => onSave({ ...profiles, listenBrainzUser: "" })} style={{ width: "100%", minHeight: 50, marginTop: 14, fontSize: 11 }}>
          SAVE TASTE PROFILE →
        </button>

        <section className="provider-status-card" style={{ marginTop: 14 }}>
          <div>
            <span className={`provider-dot ${spotifyConnected ? "is-connected" : ""}`} />
            <div><strong>Spotify catalog + playback</strong><small>{spotifyConnected ? "Connected — Spotify taste is ready" : "Log in once for catalog tracks and automatic taste"}</small></div>
          </div>
          {!spotifyConnected && <button className="btn-ghost" onClick={onConnectSpotify}>LOG IN</button>}
        </section>
      </div>
    </main>
  );
}

export function PlaylistScreen({ playlists, loadTracks }) {
  return (
    <div className="screen-scroll fade-in" style={{ padding: "24px 20px 80px" }}>
      <style>{`.pl-card{transition:transform 0.15s ease, box-shadow 0.15s ease}.pl-card:hover{transform:translateY(-2px);box-shadow:var(--paper-shadow)!important}`}</style>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)", textAlign: "center", marginBottom: 6, letterSpacing: 1.5, fontSize: 18, fontWeight: 900 }}>SELECT PLAYLIST</h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginBottom: 24, fontFamily: FM }}>Choose your soundtrack</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12 }}>
          {playlists.map(p => (
            <div key={p.id} className="pl-card" onClick={() => loadTracks(p)}
              style={{ background: "var(--bg-card)", border: "1.5px solid var(--border-subtle)", borderRadius: 10, padding: 10, cursor: "pointer", boxShadow: "var(--paper-shadow-sm)" }}>
              {p.images?.[0] && <img src={p.images[0].url} style={{ width: "100%", borderRadius: 6, display: "block", aspectRatio: "1", border: "1px solid rgba(43,35,28,0.2)" }} alt="" />}
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.tracks?.total} tracks</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrackScreen({ tracks, selPl, pickTrack, setScreen }) {
  return (
    <div className="screen-scroll fade-in" style={{ padding: "24px 20px 80px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <button className="btn-ghost" onClick={() => setScreen("playlists")}
            style={{ padding: "7px 14px", fontSize: 12 }}>
            ← Back
          </button>
          <h2 style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)", margin: 0, fontSize: 15, letterSpacing: 1.2, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selPl?.name?.toUpperCase()}
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
          {tracks.map(t => {
            const albumArt = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
            return (
              <div key={t.id} className="card-interactive" onClick={() => pickTrack(t)}
                style={{
                  padding: 8, display: "flex", flexDirection: "column", alignItems: "center",
                  background: "var(--bg-card)", border: "1.5px solid var(--border-subtle)", borderRadius: 10, cursor: "pointer", boxShadow: "var(--paper-shadow-sm)"
                }}>
                <div style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", marginBottom: 6, border: "1px solid rgba(43,35,28,0.2)" }}>
                  {albumArt ? (
                    <img src={albumArt} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "#e8dcc6", display: "grid", placeItems: "center", color: "#211c17" }}>♫</div>
                  )}
                </div>
                <div className="music-title" style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center", marginBottom: 2 }}>{t.name}</div>
                <div className="music-artist" style={{ fontSize: 8, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>{t.artists?.map(a => a.name).join(", ")}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen({ loadMsg }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FM }}>
      <style>{`@keyframes spin-slow{to{transform:rotate(360deg)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, animation: "spin-slow 2s linear infinite", display: "inline-block" }}>🎵</div>
        <div style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)", fontSize: 16, fontWeight: 900, letterSpacing: 1, marginTop: 20 }}>ANALYZING TRACK</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 10, animation: "blink 1.4s ease-in-out infinite", fontFamily: FM, fontWeight: 600 }}>{loadMsg}</div>
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
      className="sf-calibration-screen"
      style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", color: "var(--text-primary)", fontFamily: FM, padding: 24,
        cursor: "pointer", userSelect: "none" }}>
      <style>{`
        @keyframes pulse-ring{0%{transform:scale(0.8);opacity:0.8}50%{transform:scale(1.2);opacity:0.3}100%{transform:scale(0.8);opacity:0.8}}
        .cal-pulse{animation:pulse-ring ${beatInterval}s ease-in-out infinite}
      `}</style>

      <h2 style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)", letterSpacing: 1, marginBottom: 8,
        fontSize: 20, fontWeight: 900 }}>
        CALIBRATION
      </h2>

      {phase === "intro" && (
        <>
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", maxWidth: 340, lineHeight: 1.7, marginBottom: 24, fontFamily: FM, fontWeight: 600 }}>
            Tap along with the visual pulse to calibrate audio timing for your device.
          </p>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: "2px solid var(--border-subtle)", background: "var(--bg-card)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 24, boxShadow: "var(--paper-shadow)" }}
            className="cal-pulse">
            🎯
          </div>
          <p style={{ color: "var(--accent)", fontSize: 13, fontFamily: "var(--font-music)", fontWeight: 900, letterSpacing: 2 }}>
            TAP TO START
          </p>
          <button onClick={e => { e.stopPropagation(); onSkip(); }}
            style={{ marginTop: 24, background: "var(--bg-card)", border: "1.5px solid var(--border-subtle)", color: "var(--text-primary)",
              padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: FM, fontSize: 12, fontWeight: 700, boxShadow: "var(--paper-shadow-sm)" }}>
            Skip →
          </button>
        </>
      )}

      {phase === "tapping" && (
        <>
          <div style={{ width: 120, height: 120, borderRadius: "50%",
            background: "var(--accent)",
            opacity: 0.3 + Math.max(0, 1 - pulseProgress) * 0.7,
            transform: `scale(${0.7 + Math.max(0, 1 - pulseProgress) * 0.5})`,
            transition: "none",
            border: "2px solid var(--border-subtle)",
            boxShadow: "var(--paper-shadow)",
            marginBottom: 24 }} />
          <p style={{ color: "var(--text-primary)", fontSize: 12, fontFamily: FM, fontWeight: 700 }}>
            Beat {Math.min(beatCount + 1, totalBeats)} / {totalBeats} · {taps.length} taps recorded
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 8, fontFamily: FM }}>Tap with the pulse</p>
        </>
      )}

      {phase === "done" && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <p style={{ color: "var(--text-primary)", fontSize: 13, marginBottom: 8, fontFamily: FM, fontWeight: 700 }}>
            {taps.length >= 4 ? `Offset: ${offset > 0 ? "+" : ""}${offset}ms` : "Not enough taps — using no offset"}
          </p>
          <button onClick={e => { e.stopPropagation(); onComplete(offset / 1000); }}
            style={{ marginTop: 12, padding: "10px 32px", background: "var(--accent)",
              border: "1.5px solid #1a3324", borderRadius: 10, color: "#fff", fontWeight: 900, fontSize: 13,
              cursor: "pointer", fontFamily: "var(--font-music)", letterSpacing: 2, boxShadow: "var(--paper-shadow-sm)" }}>
            APPLY
          </button>
          <button onClick={e => { e.stopPropagation(); onComplete(0); }}
            style={{ marginTop: 8, background: "var(--bg-card)", border: "1.5px solid var(--border-subtle)", color: "var(--text-primary)",
              padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: FM, fontSize: 12, fontWeight: 700, boxShadow: "var(--paper-shadow-sm)" }}>
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
   • Bottom bar shows run context without interactive controls
   ═══════════════════════════════════════════════════════════ */
export function GameScreen({ W, H, canvasRef, track, features, chartAnalysis, palette, score, best, combo, difficulty, setDifficulty, flap, setScreen, togglePause, paused, phase, resumePending, pauseFeedback, onCalibrate, calibrationOffset, onBackToMenu, onRetry, onNextTrack, nextJourneyTrack, runReward, trackKey, isAudioReady = true, audioPrepMessage = "" }) {
  const [showPreGame, setShowPreGame] = useState(true);
  const [songProgress, setSongProgress] = useState(0);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissRotateHint, setDismissRotateHint] = useState(false);

  // Reset pre-game interstitial whenever a new track is picked
  useEffect(() => {
    setShowPreGame(true);
    setDismissRotateHint(false);
  }, [trackKey]);

  // Monitor device orientation on mobile
  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.matchMedia("(orientation: portrait)").matches || (window.innerHeight > window.innerWidth);
      const isMobileSize = Math.min(window.innerWidth, window.innerHeight) <= 768;
      setIsPortraitMobile(isPortrait && isMobileSize);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  const handleStartRun = useCallback(() => {
    setShowPreGame(false);
    flap();
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    } catch {}
  }, [flap]);

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
    <div
      className="sf-game-shell"
      onPointerDown={event => {
        if (showPreGame || event.target === canvasRef.current || event.target.closest?.("button")) return;
        flap();
      }}
      style={{ "--game-frame-width": `min(calc(100vw - 40px), 1280px, calc(${((100 * W) / H).toFixed(3)}dvh - ${((116 * W) / H).toFixed(1)}px))`, height: "100dvh", minHeight: "100dvh", overflow: "hidden", touchAction: "none", background: "#050508", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FM, userSelect: "none", WebkitTapHighlightColor: "transparent", position: "relative" }}>

      {/* ── Orientation hint banner for mobile users entering in portrait ── */}
      {isPortraitMobile && !dismissRotateHint && (
        <aside className="sf-rotate-banner" role="status" aria-label="Rotate device recommendation">
          <div className="sf-rotate-content">
            <div className="sf-rotate-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="3" />
                <path d="M12 18h.01" strokeWidth="3" />
                <path d="M19 12a7 7 0 0 1-7 7" stroke="#1DB954" strokeWidth="2.5" strokeDasharray="3 3" />
                <path d="M22 12l-3-3-3 3" stroke="#1DB954" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="sf-rotate-text">
              <strong>ROTATE FOR WIDESCREEN</strong>
              <small>Turn sideways for the full landscape rhythm stage</small>
            </div>
          </div>
          <button
            type="button"
            className="sf-rotate-dismiss"
            onClick={e => { e.stopPropagation(); setDismissRotateHint(true); }}
            aria-label="Dismiss rotation prompt"
          >
            ✕
          </button>
        </aside>
      )}

      {/* ── Canvas (always mounted so game loop can init) ── */}
      {/* When pre-game is showing, canvas is 1x1 offscreen so it exists in DOM
          but doesn't interfere with layout. When gameplay starts, it renders normally. */}
      <canvas ref={canvasRef} width={W} height={H} className="sf-game-canvas"
        role="button"
        aria-label="Tap to flap"
        onPointerDown={event => {
          if (showPreGame) return;
          event.preventDefault();
          flap();
        }}
        style={{
          position: showPreGame ? "fixed" : "static",
          left: showPreGame ? -9999 : undefined,
          top: showPreGame ? -9999 : undefined,
          width: showPreGame ? 1 : "var(--game-frame-width)",
          height: showPreGame ? 1 : "auto",
          opacity: showPreGame ? 0 : 1,
          pointerEvents: showPreGame ? "none" : "auto",
          display: "block", boxSizing: "border-box", flexShrink: 0, touchAction: "none", cursor: showPreGame ? "default" : "pointer",
          borderLeft: showPreGame ? "none" : `1px solid ${palette?.base || "#1DB954"}22`,
          borderRight: showPreGame ? "none" : `1px solid ${palette?.base || "#1DB954"}22`,
          order: 0,
        }} />

      {/* ═══ Pre-game interstitial overlay ═══ */}
      {showPreGame && (
        <section className="sf-pregame" aria-label="Track ready">
          <div className="sf-pregame-art-panel">
            <span className="sf-pregame-kicker">WIDESCREEN RHYTHM STAGE</span>
            {track?.album?.images?.[0] ? (
              <div className="sf-pregame-artwork">
                <img src={track.album.images[0].url} alt=""
                  style={{ border: `2px solid ${palette?.base || "#1DB954"}44`,
                    boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 40px ${palette?.glow || "rgba(29,185,84,0.15)"}` }} />
                <div className="sf-pregame-bpm" style={{ borderColor: `${palette?.base || "#1DB954"}66`, color: palette?.base || "#1DB954" }}>
                  {features?.tempo ? `${Math.round(features.tempo)} BPM` : "—"}
                </div>
              </div>
            ) : (
              <div className="sf-pregame-artwork sf-pregame-artwork--fallback" style={{ borderColor: `${palette?.base || "#1DB954"}66`, boxShadow: `0 0 42px ${palette?.glow || "rgba(29,185,84,.25)"}`, color: palette?.bright || "#4ade80" }}>
                ♫
                <div className="sf-pregame-bpm" style={{ borderColor: `${palette?.base || "#1DB954"}66`, color: palette?.base || "#1DB954" }}>
                  {features?.tempo ? `${Math.round(features.tempo)} BPM` : "—"}
                </div>
              </div>
            )}
          </div>

          <div className="sf-pregame-copy">
            <span className="sf-pregame-mode">{track?.playbackProvider === "local" ? "FULL AUDIO SYNC" : "SPOTIFY CATALOG RUN"}</span>
            <h1 className="music-title">{track?.name}</h1>
            <div className="music-artist">{track?.artists?.map(a => a.name).join(", ")}</div>
            {chartAnalysis && (
              <div title={chartAnalysis.detail} style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                padding: "5px 9px", borderRadius: 999,
                border: `1px solid ${chartAnalysis.trackDerived ? "rgba(0,240,255,0.35)" : "rgba(245,166,35,0.4)"}`,
                background: chartAnalysis.trackDerived ? "rgba(0,240,255,0.07)" : "rgba(245,166,35,0.08)",
                color: chartAnalysis.trackDerived ? "#64f4ff" : "#f5b84b",
                fontFamily: FF, fontSize: 8, letterSpacing: 1.2,
              }}>
                <span aria-hidden="true">{chartAnalysis.trackDerived ? "◆" : "◇"}</span>
                {chartAnalysis.label}
              </div>
            )}
            <div className="sf-pregame-detail">
              {track?.playbackProvider === "local"
                ? `Local playback · ${track.metadataSource || "file metadata"} · audio is not uploaded`
                : `${track?.discoverySource ? `${track.discoverySource} discovery · ` : ""}Spotify playback · generated timing where analysis is unavailable`}
            </div>
            {best > 0 && (
              <div className="sf-pregame-best">
                BEST: <span style={{ color: "#FFD700" }}>{best}</span>
              </div>
            )}

            <div className="sf-pregame-actions">
              {!isAudioReady ? (
                <button
                  className="go-btn is-preparing"
                  disabled
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1.5px solid rgba(255,255,255,0.18)",
                    color: "rgba(255,255,255,0.6)",
                    cursor: "wait",
                    boxShadow: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span className="spin-slow" style={{ fontSize: 16 }}>♫</span>
                  {audioPrepMessage || "PREPARING AUDIO..."}
                </button>
              ) : (
                <button
                  className="go-btn"
                  onClick={handleStartRun}
                  style={{
                    background: `linear-gradient(135deg, ${palette?.base || "#1DB954"}, ${palette?.bright || "#4ade80"})`,
                    boxShadow: `0 6px 30px ${palette?.glow || "rgba(29,185,84,0.4)"}`,
                  }}
                >
                  {audioPrepMessage ? "RETRY AUDIO ▶" : "START RUN ▶"}
                </button>
              )}
              {isAudioReady && audioPrepMessage && (
                <small role="status" style={{ color: "#ff9aaa", fontSize: 10, marginTop: 8 }}>
                  {audioPrepMessage}
                </small>
              )}
              <div className="sf-pregame-secondary-actions">
                <button onClick={onCalibrate} style={{ color: calibrationOffset ? palette?.base || "#1DB954" : undefined }}>
                  ⚙ Calibrate{calibrationOffset ? ` (${(calibrationOffset * 1000).toFixed(0)}ms)` : ""}
                </button>
                <button onClick={() => { if (onBackToMenu) onBackToMenu(); else setScreen("menu"); }}>
                  ← Menu
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Gameplay UI (shown after GO) ═══ */}
      {!showPreGame && (
        <>
          {/* ── Song Progress Bar (thin, top edge) ── */}
          <div className="sf-game-progress" style={{ width: "var(--game-frame-width)", height: 4, background: "#1a1a28", borderRadius: "10px 10px 0 0", overflow: "hidden", order: -2 }}>
            <div className="sf-game-progress-fill" style={{
              height: "100%", width: `${songProgress}%`,
              background: `linear-gradient(90deg, ${palette?.base || "#1DB954"}, ${palette?.bright || "#4ade80"})`,
              transition: "width 0.5s ease", borderRadius: "2px",
            }} />
          </div>

          {/* ── Compact Top Bar: track info + pause ── */}
          <header className="sf-game-topbar" style={{ width: "var(--game-frame-width)", minHeight: 48, background: "#0a0a12", borderLeft: "1px solid #1a1a28", borderRight: "1px solid #1a1a28", padding: "6px 12px", display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box", order: -1 }}>
            {track?.album?.images?.[2] && (
              <img src={track.album.images[2].url} style={{ width: 30, height: 30, borderRadius: 4, flexShrink: 0, border: `1px solid ${palette?.base || "#1DB954"}33` }} alt="" />
            )}
            <div className="sf-game-track-info" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div className="music-title" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track?.name}</div>
              <div className="music-artist" style={{ fontSize: 11, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track?.artists?.map(a => a.name).join(", ")}</div>
            </div>
            <div className="sf-game-topbar-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FF, fontSize: 11, color: "#d0d0dc", letterSpacing: 1 }}>{features?.tempo ? Math.round(features.tempo) : "—"}<span style={{ fontSize: 9, color: "#808090" }}> BPM</span></div>
              </div>
              {phase !== "playing" && !paused ? (
                <button onClick={e => { e.stopPropagation(); if (onBackToMenu) onBackToMenu(); else setScreen("menu"); }}
                  id="home-btn"
                  aria-label="Back to home"
                  style={{ background: "none", border: `1px solid ${palette?.base || "#1DB954"}66`,
                    color: palette?.base || "#1DB954", padding: "8px 10px", borderRadius: 8,
                    cursor: "pointer", fontFamily: FF, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                    minWidth: 64, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ← HOME
                </button>
              ) : (
                <button onClick={e => { e.stopPropagation(); togglePause(); }}
                  id="pause-btn"
                  aria-label={resumePending ? "Resuming music" : paused ? "Resume game" : "Pause game"}
                  disabled={resumePending}
                  style={{ background: paused ? palette?.base || "#1DB954" : "none", border: `1px solid ${paused ? palette?.base || "#1DB954" : "#252535"}`,
                    color: paused ? "#000" : "#d0d0dc", padding: "8px", borderRadius: 8,
                    cursor: "pointer", fontSize: 14, lineHeight: 1, transition: "all 0.15s",
                    opacity: resumePending ? 0.65 : 1,
                    minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {resumePending ? "…" : paused ? "▶" : "⏸"}
                </button>
              )}
            </div>
          </header>

          {/* ── Minimal Footer: run context only (NO interactive buttons in tap zone) ── */}
          <footer className="sf-game-footer" style={{
            width: "var(--game-frame-width)", minHeight: 32, background: "#0a0a12", borderLeft: "1px solid #1a1a28", borderRight: "1px solid #1a1a28",
            borderRadius: "0 0 10px 10px", padding: "6px 14px",
            display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box",
          }}>
            <div style={{ fontFamily: FF, fontSize: 11, color: "#a0a0b0", letterSpacing: 1 }}>
              PIPES <span style={{ color: "#f5a623", fontSize: 13 }}>{score.toLocaleString()}</span>
            </div>
            <div style={{ fontFamily: FF, fontSize: 11, color: "#a0a0b0", letterSpacing: 1 }}>
              BEST <span style={{ color: "#FFD700", fontSize: 13 }}>{best.toLocaleString()}</span>
              {combo > 1 && <span style={{ fontSize: 10, color: "#4ade80", marginLeft: 8 }}>×{combo}</span>}
            </div>
          </footer>

          {/* ── Pause overlay: Menu + Resume buttons ── */}
          {paused && (
            <div className="sf-game-pause-overlay" style={{
              position: "absolute", inset: 0, zIndex: 20,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "rgba(5,5,8,0.7)", backdropFilter: "blur(4px)",
            }}>
              <div className="sf-pause-title" style={{ fontFamily: FF, fontSize: 28, color: "#fff", letterSpacing: 4, marginBottom: 24, textShadow: `0 0 20px ${palette?.glow || "rgba(29,185,84,0.5)"}` }}>
                {resumePending ? "SYNCING" : "PAUSED"}
              </div>
              <div className="sf-pause-btn-group" style={{ display: "flex", flexDirection: "column", gap: 10, width: 180 }}>
                <button onClick={e => { e.stopPropagation(); togglePause(); }}
                  disabled={resumePending}
                  style={{
                    padding: "14px 0", borderRadius: 10, border: "none", cursor: "pointer",
                    background: `linear-gradient(135deg, ${palette?.base || "#1DB954"}, ${palette?.bright || "#4ade80"})`,
                    color: "#000", fontFamily: FF, fontSize: 13, fontWeight: 900, letterSpacing: 2,
                    opacity: resumePending ? 0.65 : 1,
                    boxShadow: `0 4px 20px ${palette?.glow || "rgba(29,185,84,0.4)"}`,
                  }}>
                  {resumePending ? "RESUMING…" : "RESUME ▶"}
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
              <div className="sf-pause-feedback" style={{ marginTop: 16, fontFamily: FM, fontSize: 12, color: "#9090a0" }}>
                {pauseFeedback || "Tap RESUME or the pause button to continue"}
              </div>
            </div>
          )}

          {(phase === "dead" || phase === "completed") && (
            <div className="sf-game-results-actions" style={{
              position: "absolute", left: "50%", top: "calc(50% + 170px)", zIndex: 25,
              width: "calc(100% - 32px)", maxWidth: 360, transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              pointerEvents: "none",
            }}>
              {runReward?.xp > 0 && (
                <div className="sf-reward-pill" aria-live="polite" style={{
                  padding: "7px 12px", borderRadius: 999,
                  background: "rgba(5,5,8,0.88)", border: `1px solid ${palette?.base || "#1DB954"}66`,
                  color: palette?.bright || "#4ade80", fontFamily: FF, fontSize: 10, letterSpacing: 1.2,
                }}>
                  +{runReward.xp} XP · {runReward.reasons?.join(" · ")}
                </div>
              )}
              <div style={{
                display: "flex", gap: 8, pointerEvents: "auto",
                width: phase === "completed" && nextJourneyTrack ? "100%" : 200,
                maxWidth: "100%",
              }}>
                <button onClick={event => { event.stopPropagation(); onBackToMenu(); }}
                  style={{ flex: "1 1 0", minWidth: 0, minHeight: 44, borderRadius: 10, border: "1px solid #454555", background: "rgba(5,5,8,0.94)", color: "#d0d0dc", fontFamily: FF, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
                  HOME
                </button>
                <button onClick={event => { event.stopPropagation(); onRetry(); }}
                  style={{ flex: "1 1 0", minWidth: 0, minHeight: 44, borderRadius: 10, border: `1px solid ${palette?.base || "#1DB954"}`, background: "rgba(5,5,8,0.94)", color: palette?.bright || "#4ade80", fontFamily: FF, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
                  REPLAY
                </button>
                {phase === "completed" && nextJourneyTrack && (
                  <button onClick={event => { event.stopPropagation(); onNextTrack(); }}
                    style={{ flex: "1.25 1 0", minWidth: 0, minHeight: 44, borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${palette?.base || "#1DB954"}, ${palette?.bright || "#4ade80"})`, color: "#000", fontFamily: FF, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
                    NEXT SONG →
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
