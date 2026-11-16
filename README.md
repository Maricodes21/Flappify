# Flappyfy

Flappyfy is a browser rhythm game built around the music you listen to. The Spotify prototype brings your playlists, top tracks, and recent listening into the game. You can also pick a song from your device. Tap to collect rhythm targets and fly through pipes until the track ends.

## Spotify listening

- **Library** brings together your Spotify playlists, recent tracks, and top tracks from different listening periods.
- **Search** finds songs in the Spotify catalog. **Daily Roundup** combines recent Spotify listening with tracks you’ve played in Flappyfy.
- **Playlist journeys** let you clear tracks one at a time, earn XP at chapter checkpoints, and resume where you left off.

| Spotify playlists | Recent listening |
| --- | --- |
| ![Spotify playlist library with sample playlists](docs/screenshots/spotify-library.png) | ![Spotify listening history with sample tracks and time-range filters](docs/screenshots/spotify-listening.png) |

These screens show the running app with sample Spotify data. The catalog playback prototype uses the Spotify Web Playback SDK and requires Premium, an authorized developer app, and a matching redirect URI. The track screen identifies whether timing comes from analysis, a preview, available tempo data, or an estimate. Copy [`.env.example`](.env.example) to `.env` to configure the integration. See the [Spotify connection screen](docs/screenshots/spotify-connect.png) and the [Spotify Developer Policy](https://developer.spotify.com/policy).

Last.fm listening profiles can also inform recommendations when a `VITE_LASTFM_API_KEY` is configured.

## Level designs

Tracks can open on different flight paths even at the same tempo. The path switches between rolling arcs, climbs, and shorter turns as the song moves through sections. Easy, Normal, and Hard vary pipe openings, approach times, and hit windows. In-game themes also change the look of the stage and its pipes.

**Neon Synthwave · Normal**

![Neon Synthwave stage with a live score, rhythm targets, and an approaching pipe](docs/screenshots/gameplay.png)

| K-Pop Kawaii · Easy | Pop-Art Comic · Hard |
| --- | --- |
| ![K-Pop Kawaii stage with a wide pipe opening and pastel scenery](docs/screenshots/kawaii.png) | ![Pop-Art Comic stage with a tighter opening and comic-style pipes](docs/screenshots/pop-art.png) |

Gameplay screenshots show three generated test tracks played through the web build.

## Play locally

You’ll need Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`. Choose **Log in with Spotify** for the configured prototype, or **Drop in your track** for a file your browser can decode. Choose **Start Run**, then tap the play area or press **Space** to flap. Use the pause button or **Esc** to pause.

- Perfect, Great, and Good rhythm hits earn **3, 2, and 1 point** respectively. Each cleared pipe earns **1 point**.
- The results screen breaks down rhythm accuracy, flight accuracy, song completion, grade, and XP. Personal bests, track mastery, and playlist progress are saved in the browser.
- Audio playback and analysis stay in the browser session. The app can look up track metadata using information from the file. Re-select a local audio file to replay it in a new session.

## Desktop web

Desktop uses a sidebar and a widescreen stage with keyboard and pointer controls.

| Home dashboard | Widescreen gameplay |
| --- | --- |
| ![Desktop home dashboard with sidebar, playlists, and best runs](docs/screenshots/home.png) | ![Desktop gameplay with a widescreen canvas](docs/screenshots/desktop-gameplay.png) |

## Android phones and tablets

Touch devices use bottom navigation. In portrait, the stage fills the area above a large **Tap to flap** button. In landscape, the stage extends across the display so you can see more of the course. The scene stays in proportion, and you can rotate during a run.

| Phone home | Phone portrait gameplay | Phone results |
| --- | --- | --- |
| ![Android PWA home with bottom navigation](docs/screenshots/mobile-home.png) | ![Portrait stage with dedicated flap button](docs/screenshots/mobile-gameplay.png) | ![Portrait run results and replay controls](docs/screenshots/mobile-results.png) |

| Phone landscape | Tablet home | Tablet gameplay |
| --- | --- | --- |
| ![Android PWA gameplay in landscape](docs/screenshots/mobile-landscape.png) | ![Android tablet-size home with bottom navigation](docs/screenshots/tablet-home.png) | ![Portrait gameplay on the tablet-sized Android display](docs/screenshots/tablet-gameplay.png) |

The desktop captures are from Chrome. The Android captures are from the installed PWA running in the Android Studio emulator, including a tablet-sized display configuration. [Phone track setup](docs/screenshots/mobile-ready.png)

## Build and install

```sh
npm test
npm run build
npm run preview
```

The production build is in `dist/`. Serve the whole directory over HTTPS. In Android Chrome, open the app, choose **Install app** from the browser menu, and launch Flappyfy from the home screen.

To test the local preview in an Android Studio emulator, run `adb reverse tcp:4173 tcp:4173` and open `http://127.0.0.1:4173/` in emulator Chrome. For Spotify sign-in, register that exact redirect URL for the emulator, or the HTTPS app URL including its path for a hosted build. [Spotify redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)

## Project structure

| Path | Purpose |
| --- | --- |
| `src/game/` | Audio analysis, rhythm maps, timing, scoring, progression, rendering, and game audio |
| `src/menu/` and `src/settings/` | Home, library, search, playlists, and customization |
| `src/services/` | Browser storage and music integrations |
| `public/` | Web app manifest and install icons |
| `test/` | Node.js tests |
| `docs/screenshots/` | Screenshots from the production build |
