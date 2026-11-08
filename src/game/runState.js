export function getCountdownState(startedAtMs, nowMs, durationMs = 3000, ready = false) {
  const elapsedMs = Math.min(durationMs, Math.max(0, nowMs - startedAtMs));
  const progress = durationMs > 0 ? elapsedMs / durationMs : 1;
  return {
    elapsedMs,
    progress,
    minimumMet: elapsedMs >= durationMs,
    holding: elapsedMs >= durationMs && !ready,
  };
}

export function shouldCompleteRun(phase, gameTime, songDuration, runFinalized = false) {
  return phase === "playing"
    && !runFinalized
    && Number.isFinite(songDuration)
    && songDuration > 0
    && gameTime >= songDuration;
}
