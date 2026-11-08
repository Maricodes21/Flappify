import test from "node:test";
import assert from "node:assert/strict";
import { advanceTransportPosition, eventXAt, projectTransportPosition, reconcileTransportAnchor, visibleTimeWindow, worldDistanceAt } from "../src/game/transport.js";

test("event positions are independent of pipe spawn count", () => {
  const args = { eventTime: 5, gameTime: 2, speed: 3, originX: 80 };
  const beforeSpawn = eventXAt(args.eventTime, args.gameTime, args.speed, args.originX);
  const afterSixSpawns = eventXAt(args.eventTime, args.gameTime, args.speed, args.originX);
  assert.equal(beforeSpawn, afterSixSpawns);
  assert.equal(beforeSpawn, 620);
});

test("world distance is monotonic for a constant positive speed", () => {
  assert.ok(worldDistanceAt(2, 3) > worldDistanceAt(1, 3));
});

test("visible time window maps back to the requested viewport", () => {
  const window = visibleTimeWindow(10, 2, 80, -60, 540);
  assert.equal(eventXAt(window.start, 10, 2, 80), -60);
  assert.equal(eventXAt(window.end, 10, 2, 80), 540);
});

test("small playback drift is slewed instead of visibly snapped", () => {
  const anchor = { lastPosition: 10, lastPollTime: 1_000, polling: false };
  const reconciled = reconcileTransportAnchor(anchor, 11.2, 2_000);
  assert.equal(reconciled.lastPosition, 11.036);
  assert.equal(projectTransportPosition(reconciled, 2_500), 11.536);
});

test("the chart never rewinds or jumps forward when a playback sample is corrected", () => {
  const elapsed = 1 / 60;
  const firstFrame = advanceTransportPosition(1, 1 + elapsed, elapsed);
  const staleSampleFrame = advanceTransportPosition(firstFrame, 0.75, elapsed);
  const catchupFrame = advanceTransportPosition(staleSampleFrame, 1.3, elapsed);

  assert.ok(staleSampleFrame > firstFrame);
  assert.ok(catchupFrame - staleSampleFrame <= elapsed * 1.21);
  assert.ok(eventXAt(2, staleSampleFrame, 3, 80) < eventXAt(2, firstFrame, 3, 80));
});

test("the chart waits at zero until the calibrated audio clock starts", () => {
  assert.equal(advanceTransportPosition(0, -0.1, 1 / 60), 0);
  assert.equal(advanceTransportPosition(0, 0, 1 / 60), 0);
  assert.ok(advanceTransportPosition(0, 0.02, 1 / 60) > 0);
});
