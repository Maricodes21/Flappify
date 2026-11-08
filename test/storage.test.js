import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  clear() {
    this.values.clear();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();

const { getBestScore, getCompletedRuns, getTopScores, saveScore } = await import("../src/services/storage.js");
const { formatScorePoints } = await import("../src/game/scoring.js");

test.beforeEach(() => localStorage.clear());

test("a new personal best preserves the cumulative play count", () => {
  saveScore("track-1", { totalScore: 10, cleared: false, rating: "D" });
  saveScore("track-1", { totalScore: 20, cleared: false, rating: "C" });

  const saved = getBestScore("track-1");
  assert.equal(saved.totalScore, 20);
  assert.equal(saved.playCount, 2);
});

test("a later personal best does not erase an earlier clear", () => {
  saveScore("track-1", { totalScore: 10, cleared: false, rating: "D" });
  saveScore("track-1", { totalScore: 9, cleared: true, rating: "D" });
  const firstClearAt = getBestScore("track-1").firstClearedAt;
  saveScore("track-1", { totalScore: 30, cleared: false, rating: "C" });

  const saved = getBestScore("track-1");
  assert.equal(saved.cleared, true);
  assert.equal(saved.firstClearedAt, firstClearAt);
  assert.equal(saved.playCount, 3);
});

test("legacy scores stay in clear history but cannot outrank a points best", () => {
  localStorage.setItem("sf_scores", JSON.stringify({
    "track-1": { trackId: "track-1", totalScore: 950_000, cleared: true, firstClearedAt: 123, songPct: 100, playCount: 3 },
  }));

  assert.equal(formatScorePoints(getCompletedRuns()[0]), "Legacy score");
  assert.deepEqual(getTopScores(), []);

  saveScore("track-1", { totalScore: 0, cleared: false });
  saveScore("track-1", { totalScore: 7, cleared: false });
  const saved = getBestScore("track-1");
  assert.equal(formatScorePoints(saved), "7 pts");
  assert.equal(saved.legacyScore, 950_000);
  assert.equal(saved.playCount, 5);
  assert.equal(saved.firstClearedAt, 123);
  assert.equal(getTopScores()[0].totalScore, 7);
});
