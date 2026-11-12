# Flappyfy

Flappyfy is a rhythm-based flight game that turns a local audio file into a playable level. Choose a song, tap in time to collect rhythm targets, and steer through pipes until the track ends. The browser analyzes the file to place targets and obstacles around its beats and changes in energy.

![A Flappyfy run in progress with a live score, rhythm targets, and an approaching pipe](docs/screenshots/gameplay.png)

## Play locally

You’ll need Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`, choose **Drop in your track**, and select an audio file your browser can decode. Choose **Start Run**, then tap the play area or press **Space** to flap. Use the pause button or **Esc** to pause. On a phone, rotate to landscape for the full play area.

- Perfect, Great, and Good rhythm hits earn **3, 2, and 1 point** respectively. Each cleared pipe earns **1 point**.
- The results screen breaks down rhythm accuracy, flight accuracy, song completion, grade, and XP. Personal bests, track mastery, and playlist progress are saved in the browser.
- Audio playback and analysis stay in the browser session. The app can look up track metadata using information from the file. Re-select a local audio file to replay it in a new session.

| Home | Results |
| --- | --- |
| ![Flappyfy home screen with local audio, playlists, and best runs](docs/screenshots/home.png) | ![Completed Flappyfy run with total points, accuracy, and mastery stars](docs/screenshots/results.png) |

Screenshots show the running web build playing a generated test track.

## Build and install

```sh
npm test
npm run build
npm run preview
```

The production build is in `dist/`. Serve that directory over HTTPS and open it in Android Chrome to install it from the browser menu.

To test the local preview in an Android Studio emulator, run `adb reverse tcp:4173 tcp:4173` and open `http://127.0.0.1:4173/` inside the emulator.

## Music integrations

Local play works without a Spotify or Last.fm account. Last.fm can use a listening profile for recommendations when a `VITE_LASTFM_API_KEY` is configured.

The Spotify catalog integration is experimental. It requires Spotify Premium, an authorized Spotify developer app, and a matching redirect URI. See [`.env.example`](.env.example) for the local configuration and the [Spotify Developer Policy](https://developer.spotify.com/policy) for its restrictions on games and synchronization.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/game/` | Audio analysis, rhythm maps, timing, scoring, progression, rendering, and game audio |
| `src/menu/` and `src/settings/` | Home, library, search, playlists, and customization |
| `src/services/` | Browser storage and music integrations |
| `public/` | Web app manifest and install icons |
| `test/` | Node.js tests |
| `docs/screenshots/` | Screenshots from the production build |
