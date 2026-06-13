import { useState, useEffect } from "react";
import { getPlaylistTracks, getAudioFeatures } from "../services/spotify";
import { getBestScore } from "../services/storage";
import { computeDifficultyRating } from "../game/beatMapper";

const RATING_COLORS = { S: "#FFD700", A: "#4ade80", B: "#60a5fa", C: "#f59e0b", D: "#888" };
const STAR_COLORS = { 1: "#4ade80", 2: "#f59e0b", 3: "#ff4466" };

function DifficultyStars({ stars }) {
  if (!stars) return null;
  const color = STAR_COLORS[stars] || "#888";
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ fontSize: 8, color: i <= stars ? color : "#333" }}>★</span>
      ))}
    </div>
  );
}

export default function TrackList({ token, playlist, onPickTrack, onBack }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("default");
  const [diffRatings, setDiffRatings] = useState({});

  useEffect(() => {
    if (!playlist) return;
    setLoading(true);
    getPlaylistTracks(token, playlist.id, 50).then(async t => {
      setTracks(t);
      setLoading(false);
      // Fetch difficulty ratings in batches
      const ratings = {};
      const batchSize = 5;
      for (let i = 0; i < t.length; i += batchSize) {
        const batch = t.slice(i, i + batchSize);
        await Promise.all(batch.map(async track => {
          try {
            const feat = await getAudioFeatures(token, track.id);
            if (feat) ratings[track.id] = computeDifficultyRating(feat, null);
          } catch {}
        }));
      }
      setDiffRatings(prev => ({ ...prev, ...ratings }));
    });
  }, [token, playlist]);

  const sorted = [...tracks];
  if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "score") sorted.sort((a, b) => {
    const sa = getBestScore(a.id)?.totalScore || getBestScore(a.id)?.score || 0;
    const sb = getBestScore(b.id)?.totalScore || getBestScore(b.id)?.score || 0;
    return sb - sa;
  });
  if (sort === "difficulty") sorted.sort((a, b) => {
    const da = diffRatings[a.id]?.stars || 0;
    const db = diffRatings[b.id]?.stars || 0;
    return db - da;
  });

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "7px 14px", fontSize: 12 }}>← BACK</button>
          <h2 className="neon-heading" style={{ fontSize: 14, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {playlist?.name?.toUpperCase()}
          </h2>
        </div>

        {/* Sort options */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, marginTop: 12 }}>
          {[{ k: "default", l: "DEFAULT" }, { k: "name", l: "A-Z" }, { k: "score", l: "BEST SCORE" }, { k: "difficulty", l: "DIFFICULTY" }].map(s => (
            <button key={s.k} onClick={() => setSort(s.k)}
              style={{
                background: sort === s.k ? "var(--accent)" : "none",
                border: `1px solid ${sort === s.k ? "var(--accent)" : "var(--border-subtle)"}`,
                color: sort === s.k ? "#000" : "var(--text-muted)",
                padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                fontSize: 9, fontFamily: "var(--font-body)", letterSpacing: 1,
                transition: "all var(--transition-fast)"
              }}>
              {s.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
            <div style={{ fontSize: 32, animation: "spin-slow 2s linear infinite", display: "inline-block", marginBottom: 12 }}>🎵</div>
            <div style={{ fontSize: 11, letterSpacing: 2 }}>LOADING TRACKS...</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sorted.map(t => {
              const best = getBestScore(t.id);
              const dr = diffRatings[t.id] || (best && best.difficultyStars ? { stars: best.difficultyStars } : null);
              return (
                <div key={t.id} className="card-interactive" onClick={() => onPickTrack(t)}
                  style={{
                    padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
                    borderLeft: best ? `3px solid ${RATING_COLORS[best.rating] || "var(--border-subtle)"}` : "3px solid transparent",
                  }}>
                  {t.album?.images?.[2] && (
                    <img src={t.album.images[2].url} alt="" style={{
                      width: 44, height: 44, borderRadius: 6, flexShrink: 0,
                      border: `1px solid ${best ? RATING_COLORS[best.rating] || "var(--border-subtle)" : "var(--border-subtle)"}`,
                    }} />
                  )}
                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{t.artists?.map(a => a.name).join(", ")}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <DifficultyStars stars={dr?.stars} />
                      {dr && <span style={{ fontSize: 7, color: "var(--text-dim)", letterSpacing: 0.5 }}>{dr.label || ""}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {best && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-display)", fontWeight: "bold", letterSpacing: 1 }}>
                          {best.totalScore || best.score || 0}
                        </div>
                        {best.rating && (
                          <div style={{ fontSize: 12, fontWeight: "bold", color: RATING_COLORS[best.rating] || "var(--text-dim)" }}>
                            {best.rating}
                          </div>
                        )}
                        {best.songPct != null && (
                          <div style={{ width: 36, marginTop: 2 }}>
                            <div style={{ height: 2, background: "var(--border-subtle)", borderRadius: 1, overflow: "hidden" }}>
                              <div style={{ width: `${best.songPct}%`, height: "100%", background: RATING_COLORS[best.rating] || "var(--accent)" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ color: "var(--accent)", fontSize: 18 }}>▶</div>
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
