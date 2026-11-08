# Flappyfy Web

This repository is the canonical Flappyfy game source. The Expo/mobile project embeds the production build from this repository; mobile-only authentication, audio, and WebView code belongs in the mobile repository, while gameplay changes belong here.

## Current gameplay baseline

- Local audio files are the primary path and receive full-file beat and energy analysis.
- ListenBrainz and Last.fm provide an optional taste layer; their tracks are resolved against the temporary playback provider.
- Spotify catalog playback is isolated as a private prototype path and is not required for local play.
- One deterministic transport positions pipes and rhythm dots.
- Spotify preparation and the three-second countdown run together and wait for confirmed playback.
- Perfect, Great, and Good rhythm hits earn 3, 2, and 1 point. Each pipe cleared earns 1 point. Rhythm accuracy, flight accuracy, song completion, and XP are tracked separately.
- Personal bests and Top Tracks use the new points scale. Older scores are labeled Legacy score until a new run sets a points best.
- Songs can be cleared, replayed, and advanced as playlist journeys.
- Track mastery, XP, weekly progress, and resumable journeys persist in the browser.
- The pre-game screen identifies whether a chart is full-track, preview-derived, tempo-guided, or estimated.

## Run locally

```bash
npm install
npm test
npm run dev
```

Copy `.env.example` to `.env` to preconfigure a Spotify Client ID and optional Last.fm API key. The Spotify prototype requires Premium. Add the local URL shown by Vite as an allowed redirect URI in the Spotify developer dashboard before signing in. ListenBrainz works from a public username without an API token.

Local audio is read through an in-memory browser URL and is not uploaded or written to browser storage. The generated score/chart metadata may persist, but the player asks for the file again after the session ends.

## Production build

```bash
npm run build
```

Vite outputs a standalone page at `dist/index.html`. The mobile wrapper can copy that artifact with its `npm run sync:web` command.

Serve the full `dist` directory over HTTPS to make Flappyfy installable from Chrome on Android. To test the production build with Android Studio's emulator, run `npm run preview`, forward the preview port with `adb reverse tcp:4173 tcp:4173`, and open `http://127.0.0.1:4173/` in Chrome. Use Chrome's **Add to home screen** menu to install the app.

## Music-platform status

Spotify remains suitable only for a small private prototype unless Spotify grants written approval: its current Developer Policy prohibits games and synchronization of Spotify recordings with visual media. Last.fm can provide listening history and taste signals, but not playback, beat analysis, or music rights.

The recommended product architecture separates listening identity, licensed playback, and level analysis. See [MUSIC_PROVIDER_DECISION.md](./MUSIC_PROVIDER_DECISION.md).
