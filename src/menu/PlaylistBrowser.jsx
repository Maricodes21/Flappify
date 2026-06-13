import { useState, useEffect } from "react";
import { getPlaylists } from "../services/spotify";
import { getBestScore } from "../services/storage";

/* ── design tokens ── */
const FM = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FF = "Orbitron, monospace";

/* Pastel tints for playlist cards based on index */
const TINTS = [
  "rgba(0,255,200,0.06)",  /* cyan-green */
  "rgba(160,100,255,0.06)", /* purple */
  "rgba(255,100,150,0.06)", /* pink */
  "rgba(255,200,60,0.06)",  /* gold */
  "rgba(100,180,255,0.06)", /* blue */
  "rgba(255,140,60,0.06)",  /* orange */
];

/* ── Mini completion ring (SVG) ── */
function CompletionRing({ played, total, size = 28 }) {
  if (!total) return null;
  const pct = Math.min(played / total, 1);
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = circ * pct;
  const color = pct >= 1 ? "#4ade80" : pct >= 0.5 ? "#f59e0b" : "var(--accent)";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${stroke} ${circ - stroke}`}
          strokeLinecap="round" />
      </svg>
      <span style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 8, fontFamily: FF, fontWeight: 700, color,
      }}>
        {pct >= 1 ? "✓" : `${Math.round(pct * 100)}%`}
      </span>
    </div>
  );
}

export default function PlaylistBrowser({ token, onSelectPlaylist, onBack }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlaylists(token, 50).then(p => {
      setPlaylists(p);
      setLoading(false);
    });
  }, [token]);

  /* Check how many tracks from each playlist the user has played */
  const getPlayedCount = (playlist) => {
    /* We can only estimate from stored scores — count any track IDs we've scored */
    try {
      const scores = JSON.parse(localStorage.getItem("flappy_scores") || "{}");
      /* We don't have track IDs for playlists here, so show track count only */
      return 0;
    } catch { return 0; }
  };

  /* Pick first playlist with most tracks as "featured" */
  const featured = playlists.length > 0
    ? playlists.reduce((a, b) => (b.tracks?.total || 0) > (a.tracks?.total || 0) ? b : a, playlists[0])
    : null;
  const rest = playlists.filter(p => p.id !== featured?.id);

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="btn-ghost" onClick={onBack}
            style={{ padding: "8px 16px", fontSize: 12, minWidth: 56, minHeight: 44 }}>
            ← BACK
          </button>
          <h2 style={{
            fontFamily: FF, fontSize: 16, margin: 0,
            color: "var(--text-primary)", letterSpacing: 2,
          }}>YOUR PLAYLISTS</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
            <div style={{
              fontSize: 32, animation: "spin-slow 2s linear infinite",
              display: "inline-block", marginBottom: 12,
            }}>🎵</div>
            <div style={{ fontSize: 11, fontFamily: FF, letterSpacing: 2 }}>LOADING PLAYLISTS...</div>
          </div>
        ) : (
          <>
            {/* ── Featured playlist (hero card) ── */}
            {featured && (
              <button onClick={() => onSelectPlaylist(featured)}
                style={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 16,
                  width: "100%", padding: 16, borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(0,255,200,0.08), rgba(100,80,255,0.06))",
                  border: "1px solid rgba(0,255,200,0.15)",
                  marginBottom: 20, transition: "transform 0.1s ease, border-color 0.15s ease",
                }}
                onPointerDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
                onPointerLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                {featured.images?.[0] && (
                  <img src={featured.images[0].url} alt="" style={{
                    width: 80, height: 80, borderRadius: 10, flexShrink: 0,
                    objectFit: "cover", border: "1px solid rgba(0,255,200,0.2)",
                  }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: FF, fontSize: 9, letterSpacing: 2,
                    color: "var(--accent)", marginBottom: 4, textTransform: "uppercase",
                  }}>FEATURED PLAYLIST</div>
                  <div style={{
                    fontFamily: FM, fontSize: 15, fontWeight: 700,
                    color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{featured.name}</div>
                  <div style={{
                    fontFamily: FM, fontSize: 12, color: "var(--text-muted)", marginTop: 4,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{
                      fontFamily: FF, fontSize: 11, color: "var(--accent)", fontWeight: 700,
                    }}>{featured.tracks?.total || 0}</span>
                    <span>tracks</span>
                  </div>
                </div>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,255,200,0.12)", color: "var(--accent)",
                  fontSize: 20, flexShrink: 0,
                }}>▶</div>
              </button>
            )}

            {/* ── Playlist grid ── */}
            {rest.length > 0 && (
              <>
                <div style={{
                  fontFamily: FF, fontSize: 10, color: "var(--text-dim)",
                  letterSpacing: 2, marginBottom: 10,
                }}>ALL PLAYLISTS</div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: 12,
                }}>
                  {rest.map((p, i) => {
                    const tint = TINTS[i % TINTS.length];
                    const trackCount = p.tracks?.total || 0;
                    return (
                      <button key={p.id} onClick={() => onSelectPlaylist(p)}
                        style={{
                          all: "unset", boxSizing: "border-box", cursor: "pointer",
                          padding: 10, borderRadius: 12,
                          background: tint,
                          border: "1px solid var(--border-subtle)",
                          transition: "transform 0.1s ease, border-color 0.15s ease",
                          animationDelay: `${i * 25}ms`,
                        }}
                        onPointerDown={e => e.currentTarget.style.transform = "scale(0.97)"}
                        onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
                        onPointerLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        onPointerEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                      >
                        {p.images?.[0] && (
                          <img src={p.images[0].url} alt="" loading="lazy" style={{
                            width: "100%", borderRadius: 8, display: "block",
                            aspectRatio: "1", marginBottom: 8, objectFit: "cover",
                          }} />
                        )}
                        <div style={{
                          fontFamily: FM, fontSize: 12, fontWeight: 600,
                          color: "var(--text-primary)",
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>{p.name}</div>

                        <div style={{
                          display: "flex", alignItems: "center", gap: 6, marginTop: 6,
                        }}>
                          <span style={{
                            fontFamily: FF, fontSize: 10, color: "var(--accent)", fontWeight: 700,
                          }}>{trackCount}</span>
                          <span style={{
                            fontSize: 10, color: "var(--text-dim)", fontFamily: FM,
                          }}>tracks</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Empty state ── */}
            {playlists.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.35 }}>📋</div>
                <div style={{
                  fontFamily: FM, fontSize: 13, color: "var(--text-muted)",
                }}>No playlists found in your library</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
