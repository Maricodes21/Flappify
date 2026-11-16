// The chart and physics use a fixed world. Only the rendered viewport changes.
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GAME_CHROME_HEIGHT = 88;
export const PLAYER_X = 128;

export function getGameViewport(width, height, fill, minimumWidth = GAME_WIDTH) {
  if (!fill) return { width: GAME_WIDTH, height: GAME_HEIGHT, top: 0, fill };
  const scale = Math.min(width / minimumWidth, height / GAME_HEIGHT);
  const viewHeight = height / scale;
  return { width: width / scale, height: viewHeight, top: GAME_HEIGHT - viewHeight, fill };
}

export function getGameHeight() {
  return GAME_HEIGHT;
}
