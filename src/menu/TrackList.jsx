import { useState, useEffect } from "react";
import { getPlaylistTracks } from "../services/spotify";
import { getBestScore, getJourneyProgress, getTrackMastery, startOrResumeJourney } from "../services/storage";
import { formatScorePoints, getScorePoints } from "../game/scoring";

const RATING_COLORS = { S: "#cf5d44", A: "#82a874", B: "#6ea4b8", C: "#d6a45b", D: "#9e9486" };
const STAR_COLORS = { 1: "#82a874", 2: "#d6a45b", 3: "#cf5d44" };
const PAGE_SIZE = 30;

function DifficultyStars({ stars }) {
  if (!stars) return null;
  const color = STAR_COLORS[stars] || "#9e9486";
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ fontSize: 8, color: i <= stars ? color : "rgba(43,35,28,0.2)" }}>★</span>
      ))}
    </div>
  );
}

export default function TrackList({ token, playlist, onPickTrack, onBack }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("default");
  const [journey, setJourney] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!playlist) return;
    setLoading(true);
    setPage(1);
    if (playlist.isLocal || Array.isArray(playlist.tracks?.items)) {
      const localTracks = playlist.tracks?.items || playlist.tracks || [];
      setTracks(localTracks);
      setJourney(startOrResumeJourney(playlist, localTracks));
      setLoading(false);
      return;
    }
    getPlaylistTracks(token, playlist.id, 500).then(t => {
      setTracks(t);
      setJourney(startOrResumeJourney(playlist, t));
      setLoading(false);
    });
  }, [token, playlist]);

  useEffect(() => {
    setPage(1);
  }, [sort]);

  const sorted = [...tracks];
  if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "score") sorted.sort((a, b) => {
    const sa = getScorePoints(getBestScore(a.id)) ?? -1;
    const sb = getScorePoints(getBestScore(b.id)) ?? -1;
    return sb - sa;
  });
  if (sort === "difficulty") sorted.sort((a, b) => {
    const da = getBestScore(a.id)?.difficultyStars || 0;
    const db = getBestScore(b.id)?.difficultyStars || 0;
    return db - da;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedTracks = sorted.slice(startIndex, startIndex + PAGE_SIZE);

  const journeyProgress = getJourneyProgress(journey);
  const completedTrackIds = new Set(journey?.completedTrackIds || []);
  const nextTrack = journey?.tracks?.[journey.currentIndex] || null;

  const renderPaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "14px 0",
          padding: "8px 12px",
          background: "var(--bg-card)",
          border: "1.5px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--paper-shadow-sm)",
          boxSizing: "border-box",
        }}
      >
        <button
          className="btn-ghost"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={safePage <= 1}
          style={{
            padding: "6px 14px",
            fontSize: 10,
            fontWeight: 800,
            cursor: safePage <= 1 ? "not-allowed" : "pointer",
            opacity: safePage <= 1 ? 0.35 : 1,
            letterSpacing: 0.8,
          }}
        >
          ← PREV
        </button>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", letterSpacing: 0.5, textAlign: "center" }}>
          PAGE {safePage} OF {totalPages}
          <span style={{ fontSize: 9.5, color: "var(--text-muted)", marginLeft: 6 }}>
            ({startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, sorted.length)} of {sorted.length})
          </span>
        </div>
        <button
          className="btn-ghost"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
          style={{
            padding: "6px 14px",
            fontSize: 10,
            fontWeight: 800,
            cursor: safePage >= totalPages ? "not-allowed" : "pointer",
            opacity: safePage >= totalPages ? 0.35 : 1,
            letterSpacing: 0.8,
          }}
        >
          NEXT →
        </button>
      </div>
    );
  };

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div className="playlist-track-list-container">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "7px 14px", fontSize: 12 }}>← BACK</button>
          <h2 className="neon-heading" style={{ fontSize: 14, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {playlist?.name?.toUpperCase()}
          </h2>
        </div>

        {/* Sort options */}
        <div style={{ display: "flex", gap: 4, marginBottom: 12, marginTop: 12, flexWrap: "wrap" }}>
          {[{ k: "default", l: "DEFAULT" }, { k: "name", l: "A-Z" }, { k: "score", l: "BEST SCORE" }, { k: "difficulty", l: "DIFFICULTY" }].map(s => (
            <button
              key={s.k}
              onClick={() => setSort(s.k)}
              style={{
                background: sort === s.k ? "var(--accent)" : "var(--bg-card)",
                border: "1.5px solid var(--border-subtle)",
                color: sort === s.k ? "#ffffff" : "var(--text-primary)",
                padding: "5px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 9,
                fontFamily: "var(--font-music)",
                fontWeight: 800,
                letterSpacing: 1,
                boxShadow: "var(--paper-shadow-sm)",
              }}
            >
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
          <div>
            {journey && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(46,83,57,0.12), rgba(207,123,82,0.08))",
                  border: "1.5px solid var(--border-subtle)",
                  boxShadow: "var(--paper-shadow-sm)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 9, color: "var(--accent)", letterSpacing: 2 }}>JOURNEY CHECKPOINT</div>
                    <div style={{ marginTop: 5, fontSize: 12, color: "var(--text-primary)" }}>
                      {journeyProgress.completed} of {journeyProgress.total} tracks cleared
                    </div>
                  </div>
                  {nextTrack && (
                    <button
                      onClick={() => onPickTrack(nextTrack, { journeyId: playlist.id })}
                      style={{
                        minHeight: 40,
                        padding: "0 14px",
                        border: "1.5px solid var(--border-subtle)",
                        borderRadius: 8,
                        background: "var(--accent)",
                        color: "#ffffff",
                        fontFamily: "var(--font-music)",
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: 1,
                        cursor: "pointer",
                        boxShadow: "var(--paper-shadow-sm)",
                      }}
                    >
                      RESUME →
                    </button>
                  )}
                </div>
                <div style={{ height: 6, marginTop: 11, borderRadius: 999, overflow: "hidden", background: "rgba(43,35,28,0.12)", border: "1px solid rgba(43,35,28,0.2)" }}>
                  <div style={{ width: `${journeyProgress.percent}%`, height: "100%", background: "var(--accent)", transition: "width 280ms ease" }} />
                </div>
              </div>
            )}

            {/* Top Pagination Bar */}
            {renderPaginationControls()}

            <div className="playlist-track-grid">
              {paginatedTracks.map((t, i) => {
                const best = getBestScore(t.id);
                const mastery = getTrackMastery(t.id);
                const dr = best?.difficultyStars ? { stars: best.difficultyStars } : null;
                const cleared = completedTrackIds.has(t.id);
                const albumArt = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
                return (
                  <div
                    key={t.id || i}
                    className="card-interactive playlist-track-card"
                    onClick={() => onPickTrack(t, { journeyId: playlist.id })}
                    style={{
                      padding: 8,
                      animationDelay: `${i * 15}ms`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      position: "relative",
                    }}
                  >
                    {/* Album art */}
                    <div
                      style={{
                        width: "100%",
                        height: "auto",
                        aspectRatio: "1",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: cleared ? "2px solid #2e5339" : best ? `2px solid ${RATING_COLORS[best.rating] || "var(--border-subtle)"}` : "1.5px solid var(--border-subtle)",
                        boxShadow: "var(--paper-shadow-sm)",
                        marginBottom: 6,
                        position: "relative",
                      }}
                    >
                      {albumArt ? (
                        <img src={albumArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🎵</div>
                      )}
                      {cleared && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "#2e5339",
                            color: "#ffffff",
                            fontSize: 8,
                            fontWeight: "bold",
                            padding: "2px 4px",
                            borderRadius: 4,
                            fontFamily: "var(--font-music)",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    {/* Track name */}
                    <div
                      style={{
                        fontSize: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%",
                        textAlign: "center",
                        letterSpacing: 0.3,
                        marginBottom: 2,
                        fontWeight: 600,
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: "var(--text-dim)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%",
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      {t.artists?.map(a => a.name).join(", ")}
                    </div>

                    {/* Difficulty stars */}
                    <DifficultyStars stars={mastery?.bestStars || dr?.stars} />

                    {/* Score & Rating */}
                    {best && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-display)", fontWeight: "bold" }}>
                          {formatScorePoints(best)}
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

            {/* Bottom Pagination Bar */}
            {renderPaginationControls()}
          </div>
        )}
      </div>
    </div>
  );
}
