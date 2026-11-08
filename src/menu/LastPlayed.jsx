import React from "react";
import { getLastPlayed, getBestScore } from "../services/storage";
import { formatScorePoints } from "../game/scoring";

const RATING_COLORS = { S: "#cf5d44", A: "#82a874", B: "#6ea4b8", C: "#d6a45b", D: "#9e9486" };

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

// Shows the last song the user played in-game with full Daily Roundup card sizing & styling
export default function LastPlayed({ onPlayTrack, onUploadRequest }) {
  const lastPlayed = getLastPlayed();
  const best = lastPlayed?.trackId ? getBestScore(lastPlayed.trackId) : null;
  const timeSince = lastPlayed?.playedAt ? getTimeAgo(lastPlayed.playedAt) : "";

  const handleClick = () => {
    if (!lastPlayed) {
      onUploadRequest?.();
      return;
    }
    if (lastPlayed.trackObj?.localUnavailable) {
      onUploadRequest?.();
    } else if (lastPlayed.trackObj) {
      onPlayTrack(lastPlayed.trackObj);
    } else {
      onUploadRequest?.();
    }
  };

  return (
    <button
      className="daily-roundup-card keep-moving-card"
      onClick={handleClick}
      title={lastPlayed?.trackName ? `Play ${lastPlayed.trackName}` : "Choose audio to play"}
      aria-label="Keep moving - Last played track"
    >
      <span className="craft-clip craft-clip--tr" aria-hidden="true" />
      <span className="craft-pin craft-pin--tl" aria-hidden="true" />

      <div className="daily-roundup-art-preview">
        {lastPlayed?.albumArt ? (
          <img src={lastPlayed.albumArt} alt="" className="daily-art-single" loading="lazy" />
        ) : (
          <div className="daily-art-placeholder">
            <span>🎵</span>
          </div>
        )}
      </div>

      <div className="daily-roundup-content">
        <span className="daily-roundup-tag">
          {timeSince ? `LAST PLAYED • ${timeSince.toUpperCase()}` : "LAST PLAYED"}
        </span>
        <strong className="daily-roundup-title" title={lastPlayed?.trackName || "Ready to Fly"}>
          {lastPlayed?.trackName || "Ready to Fly"}
        </strong>
        <p className="daily-roundup-desc">
          {lastPlayed ? (
            <>
              {lastPlayed.artistName || "Local audio"}
              {best ? ` · Best: ${formatScorePoints(best)} (${best.rating || "C"}${best.songPct != null ? ` · ${best.songPct}%` : ""})` : " · Ready for another run"}
            </>
          ) : (
            "Select an audio file or connect Spotify to record your rhythm runs and streaks."
          )}
        </p>
        <div className="daily-roundup-action">
          <span className="daily-play-btn">
            {!lastPlayed
              ? "CHOOSE TRACK ↗"
              : lastPlayed.trackObj?.localUnavailable
                ? "RE-UPLOAD ↗"
                : "REPLAY ▶"}
          </span>
          <span className="daily-date-label">
            {best?.rating ? `RANK ${best.rating}` : "KEEP MOVING"}
          </span>
        </div>
      </div>
    </button>
  );
}
