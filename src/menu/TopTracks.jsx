import { useState, useEffect } from "react";
import { getTopTracks, getAudioFeatures } from "../services/spotify";
import { getBestScore } from "../services/storage";
import { computeDifficultyRating } from "../game/beatMapper";

const RATING_COLORS = { S: "#FFD700", A: "#4ade80", B: "#60a5fa", C: "#f59e0b", D: "#888" };
const STAR_COLORS = { 1: "#4ade80", 2: "#f59e0b", 3: "#ff4466" };

const TIME_RANGES = [
  { key: "short_term", label: "LAST MONTH" },
  { key: "medium_term", label: "6 MONTHS" },
  { key: "long_term", label: "ALL TIME" },
];

function DifficultyStars({ stars }) {
  if (!stars) return null;
  const color = STAR_COLORS[stars] || "#888";
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ fontSize: 9, color: i <= stars ? color : "#333", textShadow: i <= stars ? `0 0 4px ${color}55` : "none" }}>★</span>
      ))}
    </div>
  );
}

export default function TopTracks({ token, onPickTrack, onBack }) {
  const [tracks, setTracks] = useState([]);
  const [timeRange, setTimeRange] = useState("short_term");
  const [loading, setLoading] = useState(true);
  const [diffRatings, setDiffRatings] = useState({});

  useEffect(() => {
    setLoading(true);
    getTopTracks(token, timeRange, 20).then(async t => {
      setTracks(t);
      setLoading(false);
      // Fetch difficulty ratings for all tracks
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
  }, [token, timeRange]);

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "7px 14px", fontSize: 12 }}>← BACK</button>
          <h2 className="neon-heading" style={{ fontSize: 16, margin: 0 }}>YOUR TOP TRACKS</h2>
        </div>

        {/* Time range toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {TIME_RANGES.map(tr => (
            <button key={tr.key} onClick={() => setTimeRange(tr.key)}
              style={{
                background: timeRange === tr.key ? "var(--accent)" : "none",
                border: `1px solid ${timeRange === tr.key ? "var(--accent)" : "var(--border-subtle)"}`,
                color: timeRange === tr.key ? "#000" : "var(--text-muted)",
                padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                fontSize: 9, fontFamily: "var(--font-body)", fontWeight: timeRange === tr.key ? "bold" : "normal",
                letterSpacing: 1, transition: "all var(--transition-fast)"
              }}>
              {tr.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
            <div style={{ fontSize: 32, animation: "spin-slow 2s linear infinite", display: "inline-block", marginBottom: 12 }}>🎵</div>
            <div style={{ fontSize: 11, letterSpacing: 2 }}>LOADING...</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {tracks.map((t, i) => {
              const best = getBestScore(t.id);
              const dr = diffRatings[t.id] || (best && best.difficultyStars ? { stars: best.difficultyStars } : null);
              const albumArt = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
              return (
                <div key={t.id} className="card-interactive" onClick={() => onPickTrack(t)}
                  style={{
                    padding: 8, animationDelay: `${i * 30}ms`,
                    display: "flex", flexDirection: "column", alignItems: "center",
                  }}>
                  {/* Album art */}
                  <div style={{
                    width: 80, height: 80, borderRadius: 8, overflow: "hidden",
                    border: best ? `2px solid ${RATING_COLORS[best.rating] || "var(--border-subtle)"}` : "2px solid var(--border-subtle)",
                    boxShadow: best?.rating === "S" ? "0 0 12px rgba(255,215,0,0.3)" : "0 4px 12px rgba(0,0,0,0.4)",
                    marginBottom: 6,
                  }}>
                    {albumArt ? (
                      <img src={albumArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🎵</div>
                    )}
                  </div>

                  {/* Track name */}
                  <div style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center", letterSpacing: 0.3, marginBottom: 2 }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 8, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center", marginBottom: 4 }}>
                    {t.artists?.map(a => a.name).join(", ")}
                  </div>

                  {/* Difficulty stars */}
                  <DifficultyStars stars={dr?.stars} />

                  {/* Score & Rating */}
                  {best && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-display)", fontWeight: "bold" }}>
                        {best.totalScore || best.score || 0}
                      </span>
                      {best.rating && (
                        <span style={{ fontSize: 9, fontWeight: "bold", color: RATING_COLORS[best.rating] }}>
                          {best.rating}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Progress bar */}
                  {best?.songPct != null && (
                    <div style={{ width: 50, marginTop: 3 }}>
                      <div style={{ height: 2, background: "var(--border-subtle)", borderRadius: 1, overflow: "hidden" }}>
                        <div style={{ width: `${best.songPct}%`, height: "100%", background: RATING_COLORS[best.rating] || "var(--accent)", borderRadius: 1 }} />
                      </div>
                      <div style={{ fontSize: 7, color: "var(--text-dim)", textAlign: "center", marginTop: 1 }}>{best.songPct}%</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && tracks.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)", fontSize: 12 }}>
            No top tracks found for this time range
          </div>
        )}
      </div>
    </div>
  );
}
