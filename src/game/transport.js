export const WORLD_TICKS_PER_SECOND = 60;

export function worldDistanceAt(timeSeconds, speed) {
  if (!Number.isFinite(timeSeconds) || !Number.isFinite(speed)) return 0;
  return timeSeconds * speed * WORLD_TICKS_PER_SECOND;
}

export function eventXAt(eventTime, gameTime, speed, originX) {
  return originX + worldDistanceAt(eventTime, speed) - worldDistanceAt(gameTime, speed);
}

export function visibleTimeWindow(gameTime, speed, originX, leftX, rightX) {
  const pixelsPerSecond = speed * WORLD_TICKS_PER_SECOND;
  if (!Number.isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) {
    return { start: gameTime, end: gameTime };
  }
  return {
    start: gameTime + (leftX - originX) / pixelsPerSecond,
    end: gameTime + (rightX - originX) / pixelsPerSecond,
  };
}

export function spatialDistance(aX, aY, bX, bY) {
  return Math.hypot(aX - bX, aY - bY);
}

export function projectTransportPosition(anchor, nowMs) {
  if (!anchor?.lastPollTime) return anchor?.lastPosition || 0;
  return anchor.lastPosition + Math.max(0, nowMs - anchor.lastPollTime) / 1000;
}

export function advanceTransportPosition(position, target, elapsedSeconds) {
  if (position === 0 && target <= 0) return 0;
  // Adjust playback sync gradually while the chart continues moving forward.
  const minAdvance = elapsedSeconds * 0.8;
  const maxAdvance = elapsedSeconds * 1.2;
  return position + Math.min(maxAdvance, Math.max(minAdvance, target - position));
}

export function reconcileTransportAnchor(anchor, observedPosition, nowMs, slew = 0.18, hardLimitSeconds = 3) {
  if (!anchor?.lastPollTime) {
    return { ...anchor, lastPosition: observedPosition, lastPollTime: nowMs };
  }
  const predicted = projectTransportPosition(anchor, nowMs);
  const error = observedPosition - predicted;
  const corrected = Math.abs(error) >= hardLimitSeconds
    ? observedPosition
    : predicted + error * slew;
  return { ...anchor, lastPosition: corrected, lastPollTime: nowMs };
}
