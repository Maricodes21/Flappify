import { useState, useEffect, useRef } from "react";
import { getCurrentlyPlaying } from "../services/spotify";

// Only shows when user is ACTIVELY playing on Spotify (not paused)
export default function CurrentlyListening({ token, onPlayTrack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const poll = async () => {
    const result = await getCurrentlyPlaying(token);
    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, 10000);
    return () => clearInterval(timerRef.current);
  }, [token]);

  if (loading) {
    return (
      <div className="glass-card fade-in" style={{ padding: 16, textAlign: "center" }}>
        <div style={{ color: "var(--text-dim)", fontSize: 11, letterSpacing: 1 }}>DETECTING PLAYBACK...</div>
      </div>
    );
  }

  // Only show when actively playing (not paused or stopped)
  if (!data || !data.track || !data.isPlaying) {
    return null; // Hidden when nothing is actively playing
  }

  const { track, progressMs, durationMs } = data;
  const pct = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;
  const albumArt = track.album?.images?.[0]?.url;
  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass-card fade-in" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
      {/* Live indicator */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {albumArt && (
          <img src={albumArt} alt="" style={{
            width: 56, height: 56, borderRadius: 8,
            border: "1px solid var(--accent)",
            boxShadow: "0 0 16px var(--accent-glow-subtle)"
          }} />
        )}
        <div style={{
          position: "absolute", top: -4, right: -4,
          width: 10, height: 10, borderRadius: "50%",
          background: "var(--accent)",
          boxShadow: "0 0 8px var(--accent-glow)",
          animation: "pulse-glow 2s ease-in-out infinite"
        }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ fontSize: 8, color: "var(--accent)", fontFamily: "var(--font-display)", letterSpacing: 2, marginBottom: 3 }}>
          ♪ LISTENING NOW
        </div>
        <div style={{ fontSize: 12, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>
          {track.name}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
          {track.artists?.map(a => a.name).join(", ")}
        </div>

        {/* Progress */}
        <div className="progress-bar" style={{ marginBottom: 3 }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--text-dim)" }}>
          <span>{formatTime(progressMs)}</span>
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      {/* Single PLAY CTA */}
      <button className="btn-primary" onClick={() => onPlayTrack(track)}
        style={{ padding: "10px 16px", fontSize: 10, letterSpacing: 1, borderRadius: 8, flexShrink: 0 }}>
        PLAY ▶
      </button>
    </div>
  );
}
