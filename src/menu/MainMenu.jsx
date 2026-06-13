import { useState, useEffect } from "react";
import { getTopTracks, getAudioFeatures } from "../services/spotify";
import { getGameTopTracks, getLastPlayed, getBestScore } from "../services/storage";
import { computeDifficultyRating } from "../game/beatMapper";
import CurrentlyListening from "./NowPlaying";
import LastPlayed from "./LastPlayed";

const FF = "Orbitron, monospace";
const FM = "'DM Sans', -apple-system, sans-serif";

/* ── Color roles ──
   Green (#1DB954)  = interactive only — play buttons, CTAs, active nav
   Amber (#f5a623)  = achievement — scores, section "best runs"
   Grade colors     = rating identity — S gold, A green, B blue, C orange, D gray
   Neutral gray     = everything else — labels, borders, section headers
*/
const RATING_COLORS = { S: "#FFD700", A: "#4ade80", B: "#60a5fa", C: "#f59e0b", D: "#808090" };
const STAR_COLORS = { 1: "#4ade80", 2: "#f59e0b", 3: "#ff4466" };

function DifficultyStars({ stars, size = 8 }) {
  if (!stars) return null;
  const color = STAR_COLORS[stars] || "#808090";
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= stars ? color : "#404050", textShadow: i <= stars ? `0 0 4px ${color}44` : "none" }}>★</span>
      ))}
    </div>
  );
}

/* ── Quick Play Hero Card ── */
function QuickPlayCard({ track, onPlay }) {
  if (!track) return null;
  const albumArt = track?.album?.images?.[0]?.url || track?.album?.images?.[1]?.url;
  return (
    <div onClick={() => onPlay(track)}
      style={{
        position: "relative", borderRadius: 16, overflow: "hidden", cursor: "pointer",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-card)",
        transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
        {albumArt && (
          <img src={albumArt} alt=""
            style={{ width: 72, height: 72, borderRadius: 10, flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }} />
        )}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontFamily: FF, fontSize: 8, color: "#808090", letterSpacing: 3, marginBottom: 4 }}>QUICK PLAY</div>
          <div className="music-title" style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
          <div className="music-artist" style={{ fontSize: 12, marginTop: 2 }}>{track.artists?.map(a => a.name).join(", ")}</div>
        </div>
        {/* Play button — green is correct here, it's a CTA */}
        <div style={{
          width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #1DB954, #4ade80)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(29,185,84,0.4)",
          fontSize: 20, color: "#000", paddingLeft: 3,
        }}>▶</div>
      </div>
    </div>
  );
}

/* ── Compact Run Card ── */
function RunCard({ track, score, rating, stars, songPct, onPlay }) {
  const albumArt = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url;
  const ratingColor = RATING_COLORS[rating] || "#404050";
  return (
    <div onClick={() => onPlay && onPlay(track)}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
        background: `linear-gradient(90deg, ${ratingColor}0C, var(--bg-card) 50%)`,
        border: "1px solid var(--border-subtle)",
        borderLeft: `4px solid ${ratingColor}`, borderRadius: 8,
        cursor: onPlay ? "pointer" : "default",
        transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
        minHeight: 52,
      }}
      onMouseEnter={e => { if (onPlay) { e.currentTarget.style.background = "var(--bg-card-hover)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderLeftColor = ratingColor; }}}
      onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(90deg, ${ratingColor}0C, var(--bg-card) 50%)`; e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.borderLeftColor = ratingColor; }}
    >
      {albumArt && <img src={albumArt} alt="" style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0 }} />}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div className="music-title" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track?.name || "Track"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          {songPct != null && (
            <span style={{ fontFamily: FF, fontSize: 7, color: "#606070", letterSpacing: 0.5 }}>{songPct}%</span>
          )}
        </div>
      </div>
      {/* Score in amber, grade in its own color */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {score != null && (
          <div style={{ fontFamily: FF, fontSize: 11, color: "#f5a623", fontWeight: "bold" }}>
            {score?.toLocaleString()}
          </div>
        )}
        {rating && (
          <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 900, color: ratingColor, lineHeight: 1 }}>
            {rating}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MainMenu({ token, onPickTrack, onNavigate, userProfile }) {
  const [quickTracks, setQuickTracks] = useState([]);
  const [gameTopTracks, setGameTopTracks] = useState([]);
  const [lastPlayed, setLastPlayed] = useState(null);

  useEffect(() => {
    getTopTracks(token, "short_term", 6).then(tracks => setQuickTracks(tracks));
    setGameTopTracks(getGameTopTracks(5));
    const lp = getLastPlayed();
    if (lp) setLastPlayed(lp);
  }, [token]);

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 84 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* ── Logo & Welcome ── */}
        <div style={{ textAlign: "center", marginBottom: 24, position: "relative" }}>
          <div style={{
            position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)",
            width: 220, height: 70,
            background: "radial-gradient(ellipse, rgba(29,185,84,0.4) 0%, transparent 70%)",
            filter: "blur(24px)", opacity: 0.35, pointerEvents: "none",
          }} />
          <h1 className="neon-heading" style={{
            fontSize: 22, fontWeight: 900, marginBottom: 4,
            background: "linear-gradient(135deg, #4ade80, #00f0ff, #1DB954, #ff2d95)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundSize: "300% 300%",
            animation: "gradient-shift 6s ease infinite",
          }}>
            FLAPPYFY
          </h1>
          {userProfile && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {userProfile.images?.[0]?.url && (
                <img src={userProfile.images[0].url} alt="" style={{
                  width: 24, height: 24, borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.15)",
                }} />
              )}
              <span style={{ fontSize: 12, color: "#b0b0c0", fontFamily: FM }}>
                {userProfile.display_name}
              </span>
            </div>
          )}
        </div>

        {/* ── Hero: Quick Play (last played or top track) ── */}
        <div style={{ marginBottom: 20 }}>
          <CurrentlyListening token={token} onPlayTrack={onPickTrack} />
          <div style={{ height: 10 }} />
          <LastPlayed onPlayTrack={onPickTrack} />
          {!lastPlayed && quickTracks.length > 0 && (
            <QuickPlayCard track={quickTracks[0]} onPlay={onPickTrack} />
          )}
        </div>

        {/* ── Best Runs — amber header (achievement) ── */}
        {gameTopTracks.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{
              fontFamily: FF, fontSize: 10, letterSpacing: 3,
              color: "#f5a623", marginBottom: 8,
              borderBottom: "1px solid #1a1a28", paddingBottom: 6,
            }}>
              YOUR BEST RUNS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {gameTopTracks.map((t, i) => (
                <RunCard key={t.trackId || i}
                  track={t.trackObj || { name: t.trackName, album: { images: [{ url: t.albumArt }] } }}
                  score={t.totalScore || t.score}
                  rating={t.rating}
                  stars={t.difficultyStars}
                  songPct={t.songPct}
                  onPlay={t.trackObj ? () => onPickTrack(t.trackObj) : null}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Browse: Pick a Level — neutral header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: FF, fontSize: 10, letterSpacing: 3,
            color: "#808090", marginBottom: 10,
            borderBottom: "1px solid #1a1a28", paddingBottom: 6,
          }}>
            PICK A LEVEL
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { id: "playlists", icon: "📋", label: "PLAYLISTS", desc: "Your collections" },
              { id: "search", icon: "🔍", label: "SEARCH", desc: "Find any song" },
              { id: "top-tracks", icon: "🔥", label: "TOP TRACKS", desc: "Your favorites" },
            ].map(item => (
              <div key={item.id} className="card-interactive"
                onClick={() => onNavigate(item.id)}
                style={{
                  padding: "16px 8px", textAlign: "center",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}>
                <span style={{ fontSize: 26 }}>{item.icon}</span>
                <span style={{ fontFamily: FF, fontSize: 8, letterSpacing: 1.5, color: "#b0b0c0" }}>{item.label}</span>
                <span style={{ fontSize: 9, color: "#606070", fontFamily: FM }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Spotify Favorites — neutral header ── */}
        {quickTracks.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: FF, fontSize: 10, letterSpacing: 3,
              color: "#808090", marginBottom: 10,
              borderBottom: "1px solid #1a1a28", paddingBottom: 6,
            }}>
              SPOTIFY FAVORITES
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory" }}>
              {quickTracks.map(t => {
                const best = getBestScore(t.id);
                const albumArt = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
                const borderColor = best ? RATING_COLORS[best.rating] || "#1a1a28" : "#1a1a28";
                return (
                  <div key={t.id} onClick={() => onPickTrack(t)}
                    style={{
                      flexShrink: 0, width: 100, scrollSnapAlign: "start",
                      cursor: "pointer", textAlign: "center",
                      transition: "transform 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                  >
                    <div style={{
                      width: 80, height: 80, borderRadius: 10, overflow: "hidden", margin: "0 auto",
                      border: `2px solid ${borderColor}`,
                      boxShadow: best?.rating === "S" ? "0 0 14px rgba(255,215,0,0.3)" : "0 4px 12px rgba(0,0,0,0.5)",
                    }}>
                      {albumArt ? (
                        <img src={albumArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "#0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎵</div>
                      )}
                    </div>
                    <div className="music-title" style={{ fontSize: 10, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90, margin: "6px auto 0" }}>{t.name}</div>
                    <div className="music-artist" style={{ fontSize: 9, marginTop: 1 }}>{t.artists?.[0]?.name}</div>
                    {/* Grade letter in its own color */}
                    {best && (
                      <div style={{ fontFamily: FF, fontSize: 9, color: RATING_COLORS[best.rating] || "#808090", fontWeight: "bold", marginTop: 2 }}>
                        {best.rating}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div className="bottom-nav">
        <button className="bottom-nav-btn active" onClick={() => {}}>
          <span className="nav-icon">🏠</span>
          HOME
        </button>
        <button className="bottom-nav-btn" onClick={() => onNavigate("sprites")}>
          <span className="nav-icon">🎨</span>
          SPRITES
        </button>
        <button className="bottom-nav-btn disabled" title="Coming soon">
          <span className="nav-icon">👥</span>
          FRIENDS
        </button>
        <button className="bottom-nav-btn disabled" title="Coming soon">
          <span className="nav-icon">🏆</span>
          RANKS
        </button>
        <button className="bottom-nav-btn" onClick={() => onNavigate("settings")}>
          <span className="nav-icon">⚙️</span>
          SETTINGS
        </button>
      </div>
    </div>
  );
}
