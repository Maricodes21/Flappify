import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFlightAccuracy,
  calculateRating,
  calculateRhythmPoints,
  calculateRhythmAccuracy,
  calculateTotalScore,
} from "../src/game/scoring.js";

test("rhythm accuracy uses only rhythm judgements and stays bounded", () => {
  const state = {
    rhythmPerfects: 2,
    rhythmGreats: 1,
    rhythmGoods: 1,
    rhythmMisses: 1,
    rhythmExtraTaps: 1,
    pipePerfects: 100,
  };
  assert.equal(calculateRhythmAccuracy(state), 54);
  assert.ok(calculateRhythmAccuracy(state) <= 100);
});

test("flight accuracy is separate from rhythm accuracy", () => {
  const state = { pipePerfects: 1, pipeGreats: 1, pipeGoods: 1 };
  assert.equal(calculateFlightAccuracy(state), 72);
  assert.equal(calculateRhythmAccuracy(state), 0);
});

test("points count each rhythm judgement and pipe, without awarding time or accuracy points", () => {
  const state = {
    songDur: 100,
    gt: 60,
    rhythmPerfects: 2,
    rhythmGreats: 1,
    rhythmGoods: 3,
    rhythmMisses: 5,
    rhythmExtraTaps: 4,
    pipePerfects: 2,
    pipeGreats: 1,
    totalPipes: 3,
  };
  assert.equal(calculateRhythmPoints(state), 11);
  assert.equal(calculateTotalScore(state), 14);
  assert.equal(calculateTotalScore({ ...state, gt: 100, rhythmExtraTaps: 10 }), 14);
  assert.equal(calculateTotalScore({ gt: 100, songDur: 100 }), 0);
});

test("the performance grade is independent of the chart's raw points", () => {
  const shortChart = { songDur: 10, gt: 10, rhythmPerfects: 4, pipePerfects: 1, totalPipes: 1 };
  assert.equal(calculateTotalScore(shortChart), 13);
  assert.equal(calculateRating(shortChart, true), "S");
  assert.equal(calculateRating(shortChart, false), "A");
  assert.equal(calculateRating({ ...shortChart, rhythmPerfects: 0, rhythmMisses: 4 }, true), "C");
});
