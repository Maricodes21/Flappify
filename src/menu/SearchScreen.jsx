import { useState, useRef, useCallback } from "react";
import { searchTracks, getAudioFeatures } from "../services/spotify";
import { getBestScore } from "../services/storage";
import { computeDifficultyRating } from "../game/beatMapper";

/* ── design tokens ── */
const FM = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FF = "Orbitron, monospace";
const RATING_COLORS = { S: "#FFD700", A: "#4ade80", B: "#60a5fa", C: "#f59e0b", D: "#888" };
const DIFF_DOTS = [
  { label: "Easy",   color: "#4ade80", range: [0, 1] },
  { label: "Medium", color: "#f59e0b", range: [1.5, 2] },
  { label: "Hard",   color: "#ff4466", range: [2.5, 3] },
];

function DiffDot({ stars }) {
  if (!stars) return null;
  const tier = stars <= 1 ? DIFF_DOTS[0] : stars <= 2 ? DIFF_DOTS[1] : DIFF_DOTS[2];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, color: tier.color, fontFamily: FF, fontWeight: 700,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: tier.color, display: "inline-block", flexShrink: 0,
      }} />
      {tier.label}
    </span>
  );
}

/* ── suggested / trending (pre-search state) ── */
const SUGGESTED_QUERIES = [
  { emoji: "🔥", label: "Trending hits" },
  { emoji: "🎵", label: "Pop classics" },
  { emoji: "🎸", label: "Rock anthems" },
  { emoji: "🎧", label: "Electronic beats" },
  { emoji: "🎹", label: "Lo-fi chill" },
];

export default function SearchScreen({ token, onPickTrack, onBack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [diffRatings, setDiffRatings] = useState({});
  const debounceRef = useRef(null);

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    searchTracks(token, q, 20).then(async r => {
      setResults(r);
      setLoading(false);
      /* background-fetch difficulty ratings */
      const ratings = {};
      const batchSize = 5;
      for (let i = 0; i < r.length; i += batchSize) {
        const batch = r.slice(i, i + batchSize);
        await Promise.all(batch.map(async track => {
          try {
            const feat = await getAudioFeatures(token, track.id);
            if (feat) ratings[track.id] = computeDifficultyRating(feat, null);
          } catch { /* ignore */ }
        }));
      }
      setDiffRatings(prev => ({ ...prev, ...ratings }));
    });
  }, [token]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const quickSearch = (label) => {
    setQuery(label);
    doSearch(label);
  };

  /* ── format duration ── */
  const fmt = (ms) => {
    if (!ms) return "";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button className="btn-ghost" onClick={onBack}
            style={{ padding: "8px 16px", fontSize: 12, minWidth: 56, minHeight: 44 }}>
            ← BACK
          </button>
          <h2 style={{
            fontFamily: FF, fontSize: 16, margin: 0,
            color: "var(--text-primary)", letterSpacing: 2,
          }}>SEARCH</h2>
        </div>

        {/* ── Search input ── */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <input value={query} onChange={handleChange} placeholder="Search for a song..."
            autoFocus
            style={{
              width: "100%", padding: "14px 14px 14px 40px", borderRadius: 10,
              border: "1px solid var(--border-subtle)", background: "var(--bg-card)",
              color: "var(--text-primary)", fontSize: 14, fontFamily: FM,
              outline: "none", transition: "border-color 0.15s ease",
            }}
            onFocus={e => e.target.style.borderColor = "var(--accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border-subtle)"}
          />
          <span style={{
            position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
            fontSize: 16, color: "var(--text-dim)", pointerEvents: "none",
          }}>🔍</span>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{
            textAlign: "center", padding: 30, color: "var(--text-dim)",
            fontSize: 12, fontFamily: FF, letterSpacing: 2,
          }}>
            SEARCHING...
          </div>
        )}

        {/* ── Results list ── */}
        {!loading && results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {results.map(t => {
              const best = getBestScore(t.id);
              const dr = diffRatings[t.id] || (best?.difficultyStars ? { stars: best.difficultyStars } : null);
              const imgUrl = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
              return (
                <button key={t.id} onClick={() => onPickTrack(t)}
                  style={{
                    all: "unset", boxSizing: "border-box", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 10, minHeight: 64,
                    background: "var(--bg-card)",
                    borderLeft: best
                      ? `3px solid ${RATING_COLORS[best.rating] || "var(--border-subtle)"}`
                      : "3px solid transparent",
                    transition: "background 0.15s ease, transform 0.1s ease",
                    width: "100%",
                  }}
                  onPointerDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                  onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
                  onPointerLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  {/* Album art — 52px */}
                  {imgUrl && (
                    <img src={imgUrl} alt="" loading="lazy" style={{
                      width: 52, height: 52, borderRadius: 8, flexShrink: 0,
                      objectFit: "cover",
                      border: `1px solid ${best ? RATING_COLORS[best.rating] || "var(--border-subtle)" : "var(--border-subtle)"}`,
                    }} />
                  )}

                  {/* Track info */}
                  <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FM, fontSize: 13, fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{t.name}</div>

                    <div style={{
                      fontFamily: FM, fontSize: 11, color: "var(--text-muted)",
                      marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{t.artists?.map(a => a.name).join(", ")}</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <DiffDot stars={dr?.stars} />
                      {t.duration_ms && (
                        <span style={{
                          fontSize: 10, color: "var(--text-dim)", fontFamily: FF,
                        }}>{fmt(t.duration_ms)}</span>
                      )}
                    </div>
                  </div>

                  {/* Score + play */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {best && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontSize: 12, color: "#f5a623",
                          fontFamily: FF, fontWeight: "bold",
                        }}>
                          {best.totalScore || best.score || 0}
                        </div>
                        {best.rating && (
                          <div style={{
                            fontSize: 13, fontWeight: "bold",
                            color: RATING_COLORS[best.rating],
                          }}>{best.rating}</div>
                        )}
                      </div>
                    )}

                    {/* Play button — 44x44 minimum tap target */}
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(0, 255, 200, 0.08)",
                      color: "var(--accent)", fontSize: 18, flexShrink: 0,
                      transition: "background 0.15s ease",
                    }}>▶</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Empty result ── */}
        {!loading && searched && results.length === 0 && query.trim() && (
          <div style={{
            textAlign: "center", padding: 40,
            color: "var(--text-dim)", fontSize: 13, fontFamily: FM,
          }}>
            No results found for "{query}"
          </div>
        )}

        {/* ── Pre-search state ── */}
        {!searched && !loading && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.35 }}>🎶</div>
              <div style={{
                color: "var(--text-muted)", fontSize: 13, fontFamily: FM,
              }}>Search for any song on Spotify to play</div>
            </div>

            {/* Quick-search chips */}
            <div style={{
              fontFamily: FF, fontSize: 10, color: "var(--text-dim)",
              letterSpacing: 2, marginBottom: 10, textTransform: "uppercase",
            }}>Quick search</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTED_QUERIES.map(sq => (
                <button key={sq.label} onClick={() => quickSearch(sq.label)}
                  style={{
                    all: "unset", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "10px 16px", borderRadius: 20,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: FM, fontSize: 12, color: "var(--text-secondary)",
                    minHeight: 44, transition: "border-color 0.15s ease, background 0.15s ease",
                  }}
                  onPointerEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(0,255,200,0.04)"; }}
                  onPointerLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.background = "var(--bg-card)"; }}
                >
                  <span>{sq.emoji}</span>
                  <span>{sq.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
