import test from "node:test";
import assert from "node:assert/strict";
import {
  applyJourneyTrackClear,
  applyTrackResult,
  createEmptyProgression,
  createOrResumeJourney,
  getJourneyProgress,
} from "../src/game/progression.js";

const masteredClear = {
  cleared: true,
  rhythmAccuracy: 94,
  flightAccuracy: 90,
  rating: "S",
  totalScore: 95,
};

test("first mastery clear awards once and cannot be farmed by replaying", () => {
  const first = applyTrackResult(createEmptyProgression(), "track-1", masteredClear, 1_700_000_000_000);
  assert.equal(first.mastery.bestStars, 3);
  assert.equal(first.reward.xp, 250);
  const replay = applyTrackResult(first.state, "track-1", masteredClear, 1_700_000_100_000);
  assert.equal(replay.reward.xp, 0);
  assert.equal(replay.state.xp, 250);
});

test("journey checkpoints advance and chapter rewards are idempotent", () => {
  const tracks = [1, 2, 3, 4, 5].map(id => ({ id: `track-${id}` }));
  let { state } = createOrResumeJourney(createEmptyProgression(), { id: "playlist", name: "Mix" }, tracks, 1);
  for (let i = 1; i <= 4; i++) {
    ({ state } = applyJourneyTrackClear(state, "playlist", `track-${i}`, i + 1));
  }
  assert.equal(state.xp, 75);
  const duplicate = applyJourneyTrackClear(state, "playlist", "track-4", 10);
  assert.equal(duplicate.state.xp, 75);
  assert.deepEqual(getJourneyProgress(duplicate.journey), { completed: 4, total: 5, percent: 80 });
});

test("a points best replaces a legacy mastery score while retaining mastery and XP", () => {
  const state = createEmptyProgression();
  state.xp = 250;
  state.tracks["track-1"] = {
    attempts: 3, clears: 1, bestStars: 3, bestScore: 950_000,
    bestRhythmAccuracy: 94, bestFlightAccuracy: 90, bestRating: "S",
  };
  const result = { cleared: false, totalScore: 4, rhythmAccuracy: 30, flightAccuracy: 40, rating: "D" };
  const update = applyTrackResult(state, "track-1", result);
  assert.equal(update.mastery.bestScore, 4);
  assert.equal(update.mastery.bestStars, 3);
  assert.equal(update.state.xp, 250);
  assert.equal(applyTrackResult(update.state, "track-1", { ...result, totalScore: 0 }).mastery.bestScore, 4);
});
