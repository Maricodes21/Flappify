# Spotify Flappy — Project Log & Roadmap

## Project Overview

Spotify Flappy is a rhythm-driven Flappy Bird clone that connects to your Spotify account, plays your music, and syncs gameplay to the beat. Pipes spawn on downbeats, speed scales with BPM, gap size responds to energy, and album art drives the color palette. Built with React 19 + Vite 6 + Canvas 2D + Spotify Web Playback SDK + PKCE OAuth.

**Stack:** React 19, Vite 6, Canvas 2D, Web Audio API, Spotify Web Playback SDK, PKCE OAuth

**Codebase:** ~6,400 lines across 21 source files

---

## Architecture

```
src/
  main.jsx              Entry point
  App.jsx               Root component
  SpotifyFlappy.jsx     917 lines — Core orchestrator (auth, state machine, game loop, Spotify SDK)
  renderer.js           741 lines — Canvas 2D drawing (background, pipes, bird, HUD, particles)
  screens.jsx           478 lines — Setup, Loading, Game, Calibration screen components
  sounds.js             133 lines — Web Audio API SFX (tap, whoosh, death, grade chimes, metronome)
  index.css             361 lines — Design system (tokens, components, animations)

  game/
    beatMapper.js       451 lines — Converts Spotify audio_analysis into pipe spawn schedules
    audioAnalyzer.js    522 lines — Web Audio API beat detection (preview decoding, autocorrelation)
    ThemeEngine.js      570 lines — Visual theme system (Classic Neon, Sunset Retro, Deep Ocean, etc.)
    sprites.js          357 lines — Bird sprite definitions and unlock conditions
    SpriteCustomizer.jsx         — Sprite selection UI

  menu/
    MainMenu.jsx        310 lines — Home hub (quick play, best runs, browse, nav)
    SearchScreen.jsx    279 lines — Song search with difficulty indicators
    PlaylistBrowser.jsx 227 lines — Playlist grid with featured hero card
    TopTracks.jsx       159 lines — Top tracks grid with time-range filter
    TrackList.jsx       150 lines — Track list view for playlist contents
    NowPlaying.jsx       92 lines — "Currently Listening" live indicator
    LastPlayed.jsx       90 lines — Last played song card with replay button

  settings/
    SettingsScreen.jsx  170 lines — Audio, gameplay, display settings + account
    ThemeSelector.jsx   117 lines — Theme browser with auto-shuffle toggle

  services/
    spotify.js          101 lines — Spotify API wrappers (search, top tracks, audio features, playback)
    storage.js          163 lines — localStorage helpers (scores, settings, player level, stats)
```

### Key Constants (SpotifyFlappy.jsx)
- Canvas: 420x600, Pipe width: 54, Bird radius: 15
- Physics: Gravity 0.55, Flap velocity -9.0, Base speed 2.6, Base gap 155
- Difficulty multipliers: Easy (gap 1.25x, speed 0.8x), Normal (1x/1x), Hard (gap 0.8x, speed 1.2x)
- Particle pool: 300 max, Tap cooldown: 50ms

---

## Completed Work (Phases 1–9)

### Core Gameplay (Phases 1–2)
- Delta-time game loop with `performance.now()`
- Beat-synced pipe spawning from Spotify `audio_analysis` (beats, bars, sections, segments)
- Dynamic difficulty: verse sections = easier, chorus = harder
- Gentle start ramp (first 5 pipes get wider gaps, slower speed)
- Near-miss detection (5px threshold, horizontal overlap required)
- Timing grade system: Perfect / Great / Good per pipe
- Combo/streak multiplier with visual display
- Tap sound via Web Audio API, keyed to song's musical key

### Audio Engine (Phases 6, 8)
- Audio-synced game clock (polls Spotify `getCurrentState()` every 200ms)
- 3-2-1 countdown with metronome before gameplay starts
- Web Audio API preview decoding + autocorrelation BPM detection
- Synthetic beat generation fallback when API data unavailable
- Polyphony limiter (max 3 simultaneous tap voices)
- Dynamic compressor on SFX bus (-20dB threshold, 4:1 ratio)

### Visual Polish (Phases 3–4)
- Pipe glow pulse on beat (caps + edges flash)
- Enhanced beat-reactive background with radial pulse
- Death effects: screen shake (20px), 0.5s slow-mo, red flash overlay
- 3-layer parallax scrolling (seam-free)
- Floating grade/combo popups with fade-out
- Milestone celebrations at 25/50/75% song completion with particle burst + sound
- Theme engine with 6+ visual themes auto-selected by song vibe

### Post-Death Analytics (Phase 4)
- Song completion % with progress bar
- Pipes passed, accuracy rating
- Perfect/Great/Good breakdown stats
- Max combo and near-miss count
- Letter grade: S / A / B / C / D
- Personal best comparison ("NEW BEST" or "X away from best")

### Settings & Calibration (Phases 5, 9)
- 3 difficulty tiers with per-tier gap/speed modifiers
- Pre-game difficulty selector
- Tap-to-calibrate audio offset (saved to localStorage)
- Pause: button, ESC key, auto-pause on tab visibility change
- Forgiving hitbox (85% of visual sprite for collisions)
- Non-lethal ceiling with position clamping

### UI/Menu System
- Full menu navigation: Home, Search, Playlists, Top Tracks, Sprites, Settings
- Spotify OAuth PKCE flow (setup screen with client ID input)
- Currently Listening live indicator (polls every 10s)
- Last Played card with one-tap replay
- Quick Play hero card from recent favorites
- Best Runs section with grade-colored cards
- Playlist browser with featured hero card + genre-tinted backgrounds
- Search with debounce, difficulty indicators, quick-search chips
- Top Tracks grid with time-range filter (Last Month / 6 Months / All Time)
- Sprite customizer with tab navigation + unlock system
- Bottom navigation bar (Home, Sprites, Friends, Ranks, Settings)

---

## Recent Work (Current Session)

### Color System Overhaul — Three-Role Design
Implemented a structured color system to solve "green doing too many jobs":

| Role | Color | Used For |
|------|-------|----------|
| Interactive | `#1DB954` (Spotify green) | Play buttons, CTAs, active nav, toggle switches |
| Achievement | `#f5a623` (amber) | Scores, section headers for "best runs", point values |
| Personalization | Album-extracted + grade colors | Card tints, borders, background washes |

**Grade Colors (consistent across app):**
| Grade | Color | Hex |
|-------|-------|-----|
| S | Gold | `#FFD700` |
| A | Green | `#4ade80` |
| B | Blue | `#60a5fa` |
| C | Orange | `#f59e0b` |
| D | Gray | `#808090` |

**Text Contrast Tiers (5 levels):**
| Tier | Hex | Use |
|------|-----|-----|
| Primary | `#f0f0f5` | Song titles, key data |
| Secondary | `#b0b0c0` | Artist names, descriptions |
| Muted | `#808090` | Tertiary metadata |
| Dim | `#606070` | Labels, faint decorations |
| Faint | `#404050` | Disabled / barely visible |

**Two-Font Typography:**
- **Orbitron** (`--font-display`) — Game data: scores, grades, section headers, HUD labels
- **DM Sans** (`--font-music`) — Music data: song titles, artist names, playlist names

### Files Modified for Color Overhaul
- `index.css` — Added `--score`, `--grade-*`, `--text-*` tier variables; neutralized `.card-interactive:hover`, `.btn-ghost:hover`, `.section-title`; increased bottom nav visibility
- `MainMenu.jsx` — Full rewrite: QuickPlayCard label neutral, scores amber, section headers amber/neutral, browse cards neutral, user profile border neutral
- `LastPlayed.jsx` — Score PTS amber, rating-colored left border
- `SearchScreen.jsx` — Score color amber, full-row tappability, 52px album art, DiffDot component
- `renderer.js` — HUD score shadow amber, game-over score amber, BPM display neutral

### Black Screen Bug Fix
- **Problem:** Canvas was conditionally rendered (either pre-game interstitial OR canvas, never both). Game loop `useEffect` ran when `screen === "game"`, found `canvasRef.current === null`, returned immediately. Canvas appeared on GO press but useEffect didn't re-trigger.
- **Fix:** Canvas is now always mounted in DOM. During pre-game, positioned offscreen (`left: -9999, opacity: 0, width: 1, height: 1`). On GO, becomes `position: static` with full dimensions.

### Back-to-Menu During Gameplay
- Added HTML pause overlay (visible when `paused === true`) with RESUME and Back to Menu buttons
- Canvas pause overlay simplified to just a dark semi-transparent fill (HTML handles interactivity)
- `onBackToMenu` callback: pauses playback, sets phase to idle, returns to menu screen

---

## Known Issues

### Build Issues
- **Rollup native module error:** `npx vite build` fails with `MODULE_NOT_FOUND` for `@rollup/rollup-linux-x64-gnu`. Likely a platform-specific binary mismatch in the sandbox. Should work in user's local environment.
- **SpotifyFlappy.jsx paren imbalance:** Bracket-counting shows 2 unmatched parentheses. Needs manual review — may be a false positive from template literals, but should be verified.

### Color Overhaul — Incomplete
The following files still use `var(--accent)` for non-interactive purposes and need updating:

| File | Issue | Count |
|------|-------|-------|
| `NowPlaying.jsx` | Album art border, live dot, "LISTENING NOW" label all use green | 3 |
| `TopTracks.jsx` | Score values use `var(--accent)` instead of amber; progress bar fallback is green | 2 |
| `TrackList.jsx` | Score display uses `var(--accent)`; play arrow uses green for non-CTA context | 3 |
| `PlaylistBrowser.jsx` | Track count label, featured playlist stats, PLAY button text all green; hover borders green | 5 |
| `SettingsScreen.jsx` | Profile avatar border green; calibration value green; difficulty buttons green (these are interactive — **may be correct**) | 2–3 |
| `SpriteCustomizer.jsx` | Tab buttons, section headers, selected sprite borders use green (interactive — **likely correct**) | 3 |

**Priority order for fixes:** NowPlaying > TopTracks > TrackList > PlaylistBrowser > SettingsScreen

### Gameplay
- Friends tab (bottom nav) — disabled / placeholder
- Ranks tab (bottom nav) — disabled / placeholder
- No onboarding or first-run empty state for new users
- No colorblind mode (Phase 10 — planned)
- No visual-only rhythm cues for hearing-impaired (Phase 10 — planned)

---

## Roadmap

### Immediate (Next Session)
1. **Finish color audit** — Update NowPlaying, TopTracks, TrackList, PlaylistBrowser to use amber for scores, neutral for non-interactive borders/labels
2. **Verify SpotifyFlappy.jsx syntax** — Check the 2 unmatched parens (may be false positive)
3. **Test build locally** — Confirm Vite builds clean in user's actual environment
4. **Verify gameplay flow** — Confirm black screen fix works, pause overlay shows, back-to-menu functions

### Short-Term Polish
5. **Album-extracted color integration** — Use extracted palette for card background washes, wider left-edge rating bars, subtle tinting on currently-playing card
6. **Bottom nav improvements** — Larger icons (28-32px), filled icons for active state, subtle glow on active tab
7. **First-run empty states** — Design empty states for Last Played, Best Runs, and Spotify Favorites sections
8. **TopTracks sort options** — Add sorting by Best Score, Most Played, Unplayed First
9. **PlaylistBrowser completion rings** — Wire up CompletionRing SVG to actual per-playlist play data

### Medium-Term Features
10. **Friends system** — Leaderboard among Spotify friends (requires additional Spotify scopes or custom backend)
11. **Ranks / Global Leaderboard** — Tiered ranking system based on cumulative performance
12. **Song preview before play** — 30-second Spotify preview with waveform visualization in search results
13. **Achievements / Unlocks** — Milestone-based sprite and theme unlocking with notification toasts
14. **Mobile touch optimization** — Larger hit areas, haptic feedback on beat, swipe gestures for menu navigation

### Long-Term / Phase 10
15. **Colorblind mode** — Alternative color palettes for grade letters and difficulty indicators
16. **Visual rhythm cues** — Screen-edge flash patterns synced to beat for hearing-impaired players
17. **Screen reader support** — ARIA labels on all menu elements, game state announcements
18. **Offline mode** — Cached audio analysis + local playback for songs with downloaded previews
19. **PWA install** — Service worker for installable progressive web app

---

## Design Principles

1. **Green = Interactive Only.** If it's green, you can tap it. Play buttons, CTAs, active nav, toggles.
2. **Amber = Achievement.** Scores, point values, "best runs" headers, personal bests.
3. **Grade Colors = Identity.** S/A/B/C/D each have a fixed color used everywhere that grade appears.
4. **Album Art = Personalization.** Extracted palette tints cards, pipes, and backgrounds during gameplay.
5. **Two Fonts, Two Roles.** Orbitron for game data, DM Sans for music data. Never mix.
6. **Contrast Hierarchy.** Five text brightness tiers — primary through faint — used consistently.
7. **Every Card is Tappable.** Full-card hit areas, not just small play icons. Minimum 44x44px touch targets.

---

*Last updated: May 24, 2026*
