import { POINTS_SCORE_VERSION } from "./scoring.js";

export const PROGRESSION_SCHEMA_VERSION = 1;
export const JOURNEY_CHAPTER_SIZE = 4;

const RATING_ORDER = { D: 0, C: 1, B: 2, A: 3, S: 4 };
const PLAYER_LEVELS = [
  { name: "Bronze", threshold: 0 },
  { name: "Silver", threshold: 300 },
  { name: "Gold", threshold: 900 },
  { name: "Platinum", threshold: 1_800 },
  { name: "Headliner", threshold: 3_200 },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createEmptyProgression() {
  return {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    xp: 0,
    tracks: {},
    journeys: {},
    activeJourneyId: null,
    weekly: null,
  };
}

export function getWeekKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function ensureWeekly(state, timestamp) {
  const weekKey = getWeekKey(timestamp);
  if (state.weekly?.weekKey !== weekKey) {
    state.weekly = {
      weekKey,
      newTrackClears: 0,
      masteryImprovements: 0,
      chaptersCleared: 0,
    };
  }
}

export function getPlayerLevel(xp = 0) {
  let index = 0;
  for (let i = 0; i < PLAYER_LEVELS.length; i++) {
    if (xp >= PLAYER_LEVELS[i].threshold) index = i;
  }
  const current = PLAYER_LEVELS[index];
  const next = PLAYER_LEVELS[index + 1] || null;
  return {
    ...current,
    nextName: next?.name || null,
    nextThreshold: next?.threshold || null,
    progress: next
      ? (xp - current.threshold) / (next.threshold - current.threshold)
      : 1,
  };
}

export function masteryStarsForResult(result) {
  if (!result.cleared) return 0;
  if ((result.rhythmAccuracy || 0) >= 90 && (result.flightAccuracy || 0) >= 85 && result.rating === "S") return 3;
  if ((result.rhythmAccuracy || 0) >= 70 && (result.flightAccuracy || 0) >= 60) return 2;
  return 1;
}

export function applyTrackResult(inputState, trackId, result, timestamp = Date.now()) {
  const state = clone(inputState || createEmptyProgression());
  ensureWeekly(state, timestamp);
  const existing = state.tracks[trackId] || {
    attempts: 0,
    clears: 0,
    bestStars: 0,
    bestScore: 0,
    bestRhythmAccuracy: 0,
    bestFlightAccuracy: 0,
    bestRating: "D",
  };
  const stars = masteryStarsForResult(result);
  const firstClear = Boolean(result.cleared && existing.clears === 0);
  const starGain = Math.max(0, stars - existing.bestStars);
  const ratingGain = Math.max(0, (RATING_ORDER[result.rating] || 0) - (RATING_ORDER[existing.bestRating] || 0));

  const reward = {
    xp: 0,
    firstClear,
    starGain,
    ratingImproved: ratingGain > 0,
    reasons: [],
  };
  if (firstClear) {
    reward.xp += 100;
    reward.reasons.push("First clear +100 XP");
    state.weekly.newTrackClears += 1;
  }
  if (starGain > 0) {
    reward.xp += starGain * 50;
    reward.reasons.push(`Mastery +${starGain * 50} XP`);
  }
  if (ratingGain > 0 && !firstClear) {
    reward.xp += ratingGain * 25;
    reward.reasons.push(`Grade improved +${ratingGain * 25} XP`);
  }
  if (starGain > 0 || (ratingGain > 0 && !firstClear)) state.weekly.masteryImprovements += 1;

  state.xp += reward.xp;
  state.tracks[trackId] = {
    ...existing,
    attempts: existing.attempts + 1,
    clears: existing.clears + (result.cleared ? 1 : 0),
    bestStars: Math.max(existing.bestStars, stars),
    bestScore: Math.max(existing.scoreVersion === POINTS_SCORE_VERSION ? existing.bestScore : 0, result.totalScore || 0),
    scoreVersion: POINTS_SCORE_VERSION,
    bestRhythmAccuracy: Math.max(existing.bestRhythmAccuracy, result.rhythmAccuracy || 0),
    bestFlightAccuracy: Math.max(existing.bestFlightAccuracy, result.flightAccuracy || 0),
    bestRating: (RATING_ORDER[result.rating] || 0) > (RATING_ORDER[existing.bestRating] || 0)
      ? result.rating
      : existing.bestRating,
    firstClearAt: existing.firstClearAt || (result.cleared ? timestamp : null),
    lastPlayedAt: timestamp,
    track: result.track || existing.track || null,
  };

  return { state, reward, mastery: state.tracks[trackId] };
}

export function createOrResumeJourney(inputState, playlist, tracks, timestamp = Date.now()) {
  const state = clone(inputState || createEmptyProgression());
  ensureWeekly(state, timestamp);
  let journey = state.journeys[playlist.id];
  if (!journey) {
    journey = {
      id: playlist.id,
      name: playlist.name,
      image: playlist.images?.[0]?.url || null,
      startedAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      completedTrackIds: [],
      tracks: clone(tracks),
      currentIndex: 0,
      rewardedChapters: [],
    };
  } else {
    journey.updatedAt = timestamp;
    journey.name = playlist.name || journey.name;
    journey.image = playlist.images?.[0]?.url || journey.image;
  }
  state.journeys[playlist.id] = journey;
  state.activeJourneyId = playlist.id;
  return { state, journey };
}

function completedChapterIndexes(journey) {
  const completed = new Set(journey.completedTrackIds);
  const indexes = [];
  for (let start = 0; start < journey.tracks.length; start += JOURNEY_CHAPTER_SIZE) {
    const chapter = journey.tracks.slice(start, start + JOURNEY_CHAPTER_SIZE);
    if (chapter.length > 0 && chapter.every(track => completed.has(track.id))) {
      indexes.push(Math.floor(start / JOURNEY_CHAPTER_SIZE));
    }
  }
  return indexes;
}

export function applyJourneyTrackClear(inputState, journeyId, trackId, timestamp = Date.now()) {
  const state = clone(inputState || createEmptyProgression());
  ensureWeekly(state, timestamp);
  const journey = state.journeys[journeyId];
  const reward = { xp: 0, chapterCleared: false, journeyCleared: false, reasons: [] };
  if (!journey || journey.completedTrackIds.includes(trackId)) return { state, journey, reward };

  journey.completedTrackIds.push(trackId);
  const completeSet = new Set(journey.completedTrackIds);
  journey.currentIndex = journey.tracks.findIndex(track => !completeSet.has(track.id));
  if (journey.currentIndex < 0) journey.currentIndex = journey.tracks.length;
  journey.updatedAt = timestamp;

  for (const chapterIndex of completedChapterIndexes(journey)) {
    if (!journey.rewardedChapters.includes(chapterIndex)) {
      journey.rewardedChapters.push(chapterIndex);
      reward.xp += 75;
      reward.chapterCleared = true;
      reward.reasons.push("Chapter cleared +75 XP");
      state.weekly.chaptersCleared += 1;
    }
  }

  if (journey.currentIndex >= journey.tracks.length && !journey.completedAt) {
    journey.completedAt = timestamp;
    reward.xp += 250;
    reward.journeyCleared = true;
    reward.reasons.push("Journey cleared +250 XP");
  }
  state.xp += reward.xp;
  return { state, journey, reward };
}

export function getNextJourneyTrack(journey) {
  if (!journey || journey.currentIndex >= journey.tracks.length) return null;
  return journey.tracks[journey.currentIndex] || null;
}

export function getJourneyProgress(journey) {
  const total = journey?.tracks?.length || 0;
  const completed = journey?.completedTrackIds?.length || 0;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}
