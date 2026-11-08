// Local storage service for persisting scores, settings, and preferences
import { getScorePoints, POINTS_SCORE_VERSION } from "../game/scoring.js";
import {
  applyJourneyTrackClear,
  applyTrackResult,
  createEmptyProgression,
  createOrResumeJourney,
  getJourneyProgress,
  getNextJourneyTrack,
  getPlayerLevel as getXpPlayerLevel,
} from "../game/progression.js";

const PREFIX = "sf_";

function key(name) { return `${PREFIX}${name}`; }

// Blacklisted mock / legacy IDs and roundup items to prevent hardcoded or roundup items from ever appearing in playlists
const BLOCKED_TERMS = ["fitness", "top-episodes", "night-drive", "beautiful-mushroom", "daily-roundup", "daily roundup", "roundup", "daily_roundup"];
export function isBlockedItem(item) {
  if (!item) return false;
  if (item.isDailyRoundup) return true;
  const id = String(item.id || item.trackId || "").toLowerCase();
  const name = String(item.name || item.trackName || "").toLowerCase();
  if (id.includes("roundup") || name.includes("roundup")) return true;
  return BLOCKED_TERMS.some(term => id === term || id.includes(term) || name === term || name.includes(term));
}

// Cleanse existing storage on load
try {
  const rawPl = localStorage.getItem(key("local_playlists"));
  if (rawPl) {
    const list = JSON.parse(rawPl);
    const cleaned = list.filter(p => !isBlockedItem(p));
    if (cleaned.length !== list.length) {
      localStorage.setItem(key("local_playlists"), JSON.stringify(cleaned));
    }
  }
} catch {}

// --- Scores ---
export function saveScore(trackId, scoreData) {
  const scores = getAllScores();
  const existing = scores[trackId];
  const existingPoints = getScorePoints(existing);
  const best = existingPoints === null || scoreData.totalScore > existingPoints
    ? { ...scoreData, playedAt: Date.now() }
    : existing;
  const legacyScore = existingPoints === null ? existing?.totalScore ?? existing?.score : existing.legacyScore;
  const previouslyCleared = existing?.cleared || (existingPoints === null && existing?.songPct >= 100);
  scores[trackId] = {
    ...best,
    scoreVersion: POINTS_SCORE_VERSION,
    legacyScore,
    trackId,
    cleared: Boolean(scoreData.cleared || previouslyCleared),
    songPct: Math.max(scoreData.songPct || 0, existing?.songPct || 0),
    maxCombo: Math.max(scoreData.maxCombo || 0, existing?.maxCombo || 0),
    perfects: Math.max(scoreData.perfects || 0, existing?.perfects || 0),
    firstClearedAt: existing?.firstClearedAt || (scoreData.cleared ? Date.now() : null),
    playCount: (existing?.playCount || 0) + 1,
  };
  localStorage.setItem(key("scores"), JSON.stringify(scores));
  // Update total stats
  incrementTotalStat("totalPlays");
  if (scoreData.cleared) incrementTotalStat("totalClears");
  if (scoreData.rating === "S") incrementTotalStat("sRanks");
}

export function getBestScore(trackId) {
  const scores = getAllScores();
  return scores[trackId] || null;
}

export function getAllScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(key("scores")) || "{}");
    const sanitized = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!isBlockedItem({ id: k, trackName: v?.trackName })) {
        sanitized[k] = v;
      }
    }
    return sanitized;
  } catch { return {}; }
}

export function getTopScores(limit = 20) {
  const scores = getAllScores();
  return Object.values(scores)
    .filter(score => getScorePoints(score) !== null)
    .sort((a, b) => getScorePoints(b) - getScorePoints(a))
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
  return getTopScores(Infinity)
    .filter(s => s.trackName)
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
  const level = getXpPlayerLevel(getProgression().xp);
  const emoji = { Bronze: "●", Silver: "◆", Gold: "★", Platinum: "✦", Headliner: "♛" }[level.name] || "●";
  return { ...level, emoji };
}

// --- Versioned mastery and playlist journeys ---
function saveProgression(progression) {
  localStorage.setItem(key("progression_v1"), JSON.stringify(progression));
}

export function getProgression() {
  try {
    const parsed = JSON.parse(localStorage.getItem(key("progression_v1")) || "null");
    if (!parsed || parsed.schemaVersion !== 1) return createEmptyProgression();
    return parsed;
  } catch {
    return createEmptyProgression();
  }
}

function serializeJourneyTrack(track) {
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    duration_ms: track.duration_ms,
    preview_url: track.preview_url || null,
    artists: track.artists || [],
    album: track.album || null,
    explicit: Boolean(track.explicit),
  };
}

export function startOrResumeJourney(playlist, tracks) {
  const snapshot = tracks.filter(track => track?.id && track?.uri).map(serializeJourneyTrack);
  const update = createOrResumeJourney(getProgression(), playlist, snapshot);
  saveProgression(update.state);
  return update.journey;
}

export function recordRunProgression(trackId, result, journeyId = null) {
  const trackUpdate = applyTrackResult(getProgression(), trackId, result);
  let state = trackUpdate.state;
  let journeyReward = { xp: 0, reasons: [], chapterCleared: false, journeyCleared: false };
  const activeJourney = state.journeys[state.activeJourneyId];
  const resolvedJourneyId = journeyId || (
    activeJourney?.tracks?.some(track => track.id === trackId)
      ? state.activeJourneyId
      : null
  );
  let journey = resolvedJourneyId ? state.journeys[resolvedJourneyId] : null;

  if (result.cleared && resolvedJourneyId) {
    const journeyUpdate = applyJourneyTrackClear(state, resolvedJourneyId, trackId);
    state = journeyUpdate.state;
    journey = journeyUpdate.journey;
    journeyReward = journeyUpdate.reward;
  }

  saveProgression(state);
  return {
    xp: trackUpdate.reward.xp + journeyReward.xp,
    reasons: [...trackUpdate.reward.reasons, ...journeyReward.reasons],
    firstClear: trackUpdate.reward.firstClear,
    starGain: trackUpdate.reward.starGain,
    mastery: trackUpdate.mastery,
    chapterCleared: journeyReward.chapterCleared,
    journeyCleared: journeyReward.journeyCleared,
    journey,
    nextTrack: getNextJourneyTrack(journey),
    playerLevel: getXpPlayerLevel(state.xp),
  };
}

export function getTrackMastery(trackId) {
  return getProgression().tracks[trackId] || null;
}

export function getActiveJourney() {
  const progression = getProgression();
  return progression.journeys[progression.activeJourneyId] || null;
}

export function getPlaylistJourney(playlistId) {
  if (isBlockedItem({ id: playlistId })) return null;
  return getProgression().journeys[playlistId] || null;
}

export function getProgressionOverview() {
  const progression = getProgression();
  const mastery = Object.values(progression.tracks);
  return {
    xp: progression.xp,
    level: getXpPlayerLevel(progression.xp),
    tracksCleared: mastery.filter(track => track.clears > 0).length,
    masteryStars: mastery.reduce((sum, track) => sum + (track.bestStars || 0), 0),
    weekly: progression.weekly,
    activeJourney: getActiveJourney(),
  };
}

export { getJourneyProgress };

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

export function saveHomeThemeChoice(themeId) {
  saveSetting("homeTheme", themeId);
}

export function getHomeThemeChoice() {
  return getSetting("homeTheme", "papercraft");
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

// --- Imported Tracks & Local Playlists ---
export function saveImportedTrack(track) {
  try {
    const list = getImportedTracks();
    const filtered = list.filter(t => t.id !== track.id);
    const updated = [track, ...filtered].slice(0, 100);
    localStorage.setItem(key("imported_tracks"), JSON.stringify(updated));
    return updated;
  } catch { return []; }
}

export function getImportedTracks() {
  try {
    const raw = localStorage.getItem(key("imported_tracks"));
    const list = raw ? JSON.parse(raw) : [];
    return list.filter(t => !isBlockedItem(t));
  } catch { return []; }
}

export function saveLocalPlaylist(playlist) {
  if (isBlockedItem(playlist)) return getLocalPlaylists();
  try {
    const list = getLocalPlaylists();
    const filtered = list.filter(p => p.id !== playlist.id && !isBlockedItem(p));
    const updated = [playlist, ...filtered].slice(0, 50);
    localStorage.setItem(key("local_playlists"), JSON.stringify(updated));
    return updated;
  } catch { return []; }
}

export function getLocalPlaylists() {
  try {
    const raw = localStorage.getItem(key("local_playlists"));
    const list = raw ? JSON.parse(raw) : [];
    return list.filter(p => !isBlockedItem(p));
  } catch { return []; }
}

export function deleteLocalPlaylist(playlistId) {
  try {
    const list = getLocalPlaylists();
    const updated = list.filter(p => p.id !== playlistId);
    localStorage.setItem(key("local_playlists"), JSON.stringify(updated));
    return updated;
  } catch { return []; }
}

// --- Completed Runs (100% finished songs) ---
export function getCompletedRuns() {
  const scores = getAllScores();
  return Object.values(scores).filter(s => s && (s.cleared || (getScorePoints(s) === null && s.songPct >= 100)));
}

// --- Daily Listening Tracks (Daily Roundup) ---
export function recordDailyListeningTrack(track) {
  if (!track || !track.id) return [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const keyName = key(`daily_${today}`);
    const raw = localStorage.getItem(keyName);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(t => t.id !== track.id);
    const updated = [{ ...track, recordedAt: Date.now() }, ...filtered].slice(0, 50);
    localStorage.setItem(keyName, JSON.stringify(updated));
    return updated;
  } catch { return []; }
}

export function getDailyListeningTracks(days = 3) {
  try {
    const results = [];
    const seen = new Set();
    const now = Date.now();
    for (let i = 0; i < days; i++) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      const raw = localStorage.getItem(key(`daily_${d}`));
      if (raw) {
        const list = JSON.parse(raw);
        for (const t of list) {
          if (t && t.id && !seen.has(t.id) && !isBlockedItem(t)) {
            seen.add(t.id);
            results.push(t);
          }
        }
      }
    }
    const lastPlayed = getLastPlayed();
    if (lastPlayed && lastPlayed.id && !seen.has(lastPlayed.id) && !isBlockedItem(lastPlayed)) {
      seen.add(lastPlayed.id);
      results.push(lastPlayed);
    }
    return results;
  } catch { return []; }
}
