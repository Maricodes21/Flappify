const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const POINTS_SCORE_VERSION = 2;
export const RHYTHM_POINTS = { perfect: 3, great: 2, good: 1 };

export function getScorePoints(record) {
  return record?.scoreVersion === POINTS_SCORE_VERSION ? record.totalScore ?? 0 : null;
}

export function formatScorePoints(record) {
  const points = getScorePoints(record);
  return points === null ? "Legacy score" : `${points.toLocaleString()} pts`;
}

export function calculateSongProgress(gameState) {
  const duration = gameState.songDur || 210;
  const elapsed = gameState.gt || 0;
  return elapsed >= duration ? 100 : clamp(Math.round((elapsed / duration) * 100), 0, 99);
}

export function calculateRhythmAccuracy(gameState) {
  const perfect = gameState.rhythmPerfects || 0;
  const great = gameState.rhythmGreats || 0;
  const good = gameState.rhythmGoods || 0;
  const misses = gameState.rhythmMisses ?? gameState.dotsMissed ?? 0;
  const extras = gameState.rhythmExtraTaps || 0;
  const attempts = perfect + great + good + misses + extras;
  if (attempts === 0) return 0;
  const earned = perfect + great * 0.8 + good * 0.45;
  return clamp(Math.round((earned / attempts) * 100), 0, 100);
}

export function calculateFlightAccuracy(gameState) {
  const perfect = gameState.pipePerfects || 0;
  const great = gameState.pipeGreats || 0;
  const good = gameState.pipeGoods || 0;
  const attempts = perfect + great + good;
  if (attempts === 0) return 0;
  const earned = perfect + great * 0.75 + good * 0.4;
  return clamp(Math.round((earned / attempts) * 100), 0, 100);
}

export function calculateRhythmPoints(gameState) {
  return (gameState.rhythmPerfects || 0) * RHYTHM_POINTS.perfect
    + (gameState.rhythmGreats || 0) * RHYTHM_POINTS.great
    + (gameState.rhythmGoods || 0) * RHYTHM_POINTS.good;
}

export function calculateTotalScore(gameState) {
  return calculateRhythmPoints(gameState) + (gameState.totalPipes || 0);
}

export function calculateRating(gameState, cleared = false) {
  const rhythm = calculateRhythmAccuracy(gameState);
  const flight = calculateFlightAccuracy(gameState);
  const progress = calculateSongProgress(gameState);
  const performance = rhythm * 55 + flight * 20 + progress * 25;
  if (cleared && rhythm >= 90 && performance >= 9000) return "S";
  if (rhythm >= 80 && performance >= 7800) return "A";
  if (rhythm >= 65 && performance >= 6000) return "B";
  if (performance >= 3500) return "C";
  return "D";
}
