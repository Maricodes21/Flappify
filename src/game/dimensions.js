// The web build uses one deterministic 16:9 world. CSS scales the complete
// stage to fit the browser, so gameplay coordinates never change mid-run.
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GAME_CHROME_HEIGHT = 88;
export const PLAYER_X = 128;

export function getGameHeight() {
  return GAME_HEIGHT;
}
