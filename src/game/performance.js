// Keep gameplay timing independent of the amount of work spent drawing a frame.
// Quality changes affect only pixels/effects, never the audio or physics clock.
export function initialRenderQuality(mode = "auto", isMobile = false) {
  if (mode === "performance") return "low";
  if (mode === "quality") return "high";
  return isMobile ? "balanced" : "high";
}

export function renderPixelRatio(deviceRatio, quality) {
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const cap = quality === "low" ? 1.15 : quality === "balanced" ? 1.5 : 2;
  return Math.min(ratio, cap);
}

// Never upshift in the middle of a level; that causes visible resolution jumps.
export function nextRenderQuality(quality, averageFrameMs, averageDrawMs, samples) {
  if (samples < 90 || (averageFrameMs <= 22 && averageDrawMs <= 12)) return quality;
  if (quality === "high") return "balanced";
  if (quality === "balanced") return "low";
  return "low";
}
