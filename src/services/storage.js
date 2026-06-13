// Local storage service for persisting scores, settings, and preferences
const PREFIX = "sf_";

function key(name) { return `${PREFIX}${name}`; }

// --- Scores ---
export function saveScore(trackId, scoreData) {
  const scores = getAllScores();
  const existing = scores[trackId];
  // Only save if better than existing
  if (!existing || scoreData.score > existing.score) {
    scores[trackId] = {
      ...scoreData,
      trackId,
      playedAt: Date.now()
    };
  }
  // Always increment play count
  if (!scores[trackId].playCount) scores[trackId].playCount = 0;
  scores[trackId].playCount = (scores[trackId].playCount || 0) + 1;
  localStorage.setItem(key("scores"), JSON.stringify(scores));
  // Update total stats
  incrementTotalStat("totalPlays");
  if (scoreData.rating === "S") incrementTotalStat("sRanks");
}

export function getBestScore(trackId) {
  const scores = getAllScores();
  return scores[trackId] || null;
}

export function getAllScores() {
  try {
    return JSON.parse(localStorage.getItem(key("scores")) || "{}");
  } catch { return {}; }
}

export function getTopScores(limit = 20) {
  const scores = getAllScores();
  return Object.values(scores)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getMostPlayed(limit = 10) {
  const scores = getAllScores();
  return Object.values(scores)
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
    .slice(0, limit);
}

// --- Game Top Tracks (in-game played, ranked by totalScore) ---
export function getGameTopTracks(limit = 5) {
  const scores = getAllScores();
  return Object.values(scores)
    .filter(s => s.trackName) // only entries with track info
    .sort((a, b) => (b.totalScore || b.score || 0) - (a.totalScore || a.score || 0))
    .slice(0, limit);
}

// --- Last Played (in-game) ---
export function saveLastPlayed(trackData) {
  localStorage.setItem(key("lastPlayed"), JSON.stringify({
    ...trackData,
    playedAt: Date.now()
  }));
}

export function getLastPlayed() {
  try {
    const data = localStorage.getItem(key("lastPlayed"));
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

// --- Total Stats ---
function incrementTotalStat(statName) {
  const stats = getTotalStats();
  stats[statName] = (stats[statName] || 0) + 1;
  localStorage.setItem(key("totalStats"), JSON.stringify(stats));
}

export function getTotalStats() {
  try {
    return JSON.parse(localStorage.getItem(key("totalStats")) || "{}");
  } catch { return {}; }
}

export function getPlayerLevel() {
  const stats = getTotalStats();
  const plays = stats.totalPlays || 0;
  if (plays >= 500) return { name: "Crown", emoji: "👑", threshold: 500 };
  if (plays >= 151) return { name: "Diamond", emoji: "💎", threshold: 151 };
  if (plays >= 51) return { name: "Gold", emoji: "🥇", threshold: 51 };
  if (plays >= 11) return { name: "Silver", emoji: "🥈", threshold: 11 };
  return { name: "Bronze", emoji: "🥉", threshold: 0 };
}

// --- Settings ---
export function saveSetting(name, value) {
  const settings = getSettings();
  settings[name] = value;
  localStorage.setItem(key("settings"), JSON.stringify(settings));
}

export function getSetting(name, defaultVal = null) {
  const settings = getSettings();
  return settings[name] ?? defaultVal;
}

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(key("settings")) || "{}");
  } catch { return {}; }
}

// --- Sprite ---
export function saveSpriteChoice(spriteId) {
  localStorage.setItem(key("sprite"), spriteId);
}

export function getSpriteChoice() {
  return localStorage.getItem(key("sprite")) || "classic";
}

// --- Calibration ---
export function saveCalibration(offset) {
  localStorage.setItem(key("calibration_offset"), offset.toString());
}

export function getCalibration() {
  const v = localStorage.getItem(key("calibration_offset"));
  return v ? parseFloat(v) : 0;
}

// --- Theme ---
export function saveThemeChoice(themeId) {
  saveSetting("theme", themeId);
}

export function getThemeChoice() {
  return getSetting("theme", "classic");
}

// --- Ghost Runs ---
export function saveGhostRun(trackId, data, totalScore) {
  try {
    const k = `sf_ghost_${trackId}`;
    const existing = localStorage.getItem(k);
    const existingScore = existing ? JSON.parse(existing).totalScore || 0 : 0;
    if (totalScore > existingScore) {
      localStorage.setItem(k, JSON.stringify({ totalScore, data }));
    }
  } catch {}
}

export function getGhostRun(trackId) {
  try {
    const k = `sf_ghost_${trackId}`;
    const d = localStorage.getItem(k);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}
