import test from "node:test";
import assert from "node:assert/strict";
import { getCountdownState, shouldCompleteRun } from "../src/game/runState.js";

test("countdown lasts at least three seconds and holds when music is late", () => {
  assert.equal(getCountdownState(1_000, 3_999, 3_000, false).minimumMet, false);
  const late = getCountdownState(1_000, 4_500, 3_000, false);
  assert.equal(late.elapsedMs, 3_000);
  assert.equal(late.holding, true);
  assert.equal(getCountdownState(1_000, 4_500, 3_000, true).holding, false);
});

test("only an active, unfinished run can complete at song end", () => {
  assert.equal(shouldCompleteRun("playing", 180, 180, false), true);
  assert.equal(shouldCompleteRun("countdown", 180, 180, false), false);
  assert.equal(shouldCompleteRun("playing", 180, 180, true), false);
});
