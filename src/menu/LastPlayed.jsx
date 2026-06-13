import { getLastPlayed, getBestScore } from "../services/storage";

const RATING_COLORS = { S: "#FFD700", A: "#4ade80", B: "#60a5fa", C: "#f59e0b", D: "#888" };

// Shows the last song the user played in-game
export default function LastPlayed({ onPlayTrack }) {
  const lastPlayed = getLastPlayed();

  if (!lastPlayed) {
    return (
      <div className="glass-card fade-in" style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.4 }}>🎮</div>
        <div style={{ color: "var(--text-dim)", fontSize: 11 }}>No songs played yet — pick one below!</div>
      </div>
    );
  }

  const best = lastPlayed.trackId ? getBestScore(lastPlayed.trackId) : null;
  const timeSince = lastPlayed.playedAt ? getTimeAgo(lastPlayed.playedAt) : "";

  return (
    <div className="glass-card fade-in" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center",
      borderLeft: best ? `3px solid ${RATING_COLORS[best.rating] || "var(--glass-border)"}` : undefined }}>
      {/* Album art */}
      <div style={{ flexShrink: 0 }}>
        {lastPlayed.albumArt ? (
          <img src={lastPlayed.albumArt} alt="" style={{
            width: 56, height: 56, borderRadius: 8,
            border: "1px solid var(--glass-border)"
          }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 8,
            background: "var(--bg-card)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 24
          }}>🎵</div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-display)", letterSpacing: 2, marginBottom: 3 }}>
          LAST PLAYED {timeSince && `· ${timeSince}`}
        </div>
        <div style={{ fontSize: 12, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>
          {lastPlayed.trackName || "Unknown Track"}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
          {lastPlayed.artistName || ""}
        </div>
        {/* Score info */}
        {best && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 9 }}>
            <span style={{ color: "#f5a623", fontFamily: "var(--font-display)", letterSpacing: 1 }}>
              {best.totalScore || best.score || 0} PTS
            </span>
            {best.rating && (
              <span style={{ color: RATING_COLORS[best.rating], fontWeight: "bold" }}>
                {best.rating}
              </span>
            )}
            {best.songPct != null && (
              <span style={{ color: "var(--text-dim)" }}>{best.songPct}%</span>
            )}
          </div>
        )}
      </div>

      {/* Play again */}
      {lastPlayed.trackObj && (
        <button className="btn-primary" onClick={() => onPlayTrack(lastPlayed.trackObj)}
          style={{ padding: "8px 14px", fontSize: 9, letterSpacing: 1, borderRadius: 6, flexShrink: 0 }}>
          REPLAY ▶
        </button>
      )}
    </div>
  );
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
