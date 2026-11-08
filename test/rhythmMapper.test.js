import test from "node:test";
import assert from "node:assert/strict";
import { generateSyntheticAnalysis } from "../src/game/beatMapper.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/game/dimensions.js";
import { buildPlayablePulses, buildRhythmSchedule, deriveRhythmPhysics } from "../src/game/rhythmMapper.js";

test("the web game uses a deterministic 16:9 landscape world", () => {
  assert.equal(GAME_WIDTH, 960);
  assert.equal(GAME_HEIGHT, 540);
  assert.equal(GAME_WIDTH / GAME_HEIGHT, 16 / 9);
});

test("playable pulse normalization keeps slow and fast songs readable", () => {
  const slow = generateSyntheticAnalysis(60, 30);
  const fast = generateSyntheticAnalysis(180, 30);
  const slowPulses = buildPlayablePulses(slow.beats, slow.bars, 60);
  const fastPulses = buildPlayablePulses(fast.beats, fast.bars, 180);

  for (const pulses of [slowPulses, fastPulses]) {
    const intervals = pulses.slice(1).map((pulse, index) => pulse.time - pulses[index].time);
    assert.ok(Math.max(...intervals) <= 0.87, "pulse gaps should not become idle");
    assert.ok(Math.min(...intervals) >= 0.45, "pulse stream should not become a visual cluster");
  }
});

test("normal maps cap gate density and align each gate with a playable target", () => {
  for (const [bpm, energy] of [[80, 0.9], [120, 0.9], [160, 0.9]]) {
    const analysis = generateSyntheticAnalysis(bpm, 60);
    const map = buildRhythmSchedule(analysis, { tempo: bpm, energy }, "normal", { gapM: 1, spdM: 1 }, 175);
    assert.ok(map.schedule.length <= 45, `${bpm} BPM generated too many gates`);
    assert.equal(map.trailDots.length, 0, "decorative path should not masquerade as collectible dots");

    for (const gate of map.schedule) {
      const target = map.beatDots[gate.targetDotIndex];
      assert.equal(gate.hitTime, target.time);
      assert.ok(Math.abs((gate.gapY + gate.gapSize / 2) - target.y) < 1);
      assert.ok(Math.abs(gate.spawnTime - (gate.hitTime - map.approachTime)) < 0.0001);
    }
    const gateCenters = map.schedule.map(gate => gate.gapY + gate.gapSize / 2);
    assert.ok(Math.max(...gateCenters) - Math.min(...gateCenters) >= 35, "gates should express the phrase direction");

    const distances = map.schedule.slice(1).map((gate, index) => (
      (gate.hitTime - map.schedule[index].hitTime) * map.speed * 60
    ));
    if (distances.length) assert.ok(Math.min(...distances) >= 400, "widescreen gates should have clear visual separation");
  }
});

test("authored tap impulses lead ballistically to the next rhythm target", () => {
  const analysis = generateSyntheticAnalysis(120, 30);
  const map = buildRhythmSchedule(analysis, { tempo: 120, energy: 0.7 }, "normal", { gapM: 1, spdM: 1 }, 175);
  const physics = deriveRhythmPhysics(buildPlayablePulses(analysis.beats, analysis.bars, 120), "normal");

  for (let index = 0; index < Math.min(20, map.beatDots.length - 1); index++) {
    const current = map.beatDots[index];
    const next = map.beatDots[index + 1];
    const frames = (next.time - current.time) * 60;
    const predictedY = current.y + current.flapVelocity * frames + 0.5 * physics.gravity * frames * (frames + 1);
    assert.ok(Math.abs(predictedY - next.y) < 0.001);
  }
});
