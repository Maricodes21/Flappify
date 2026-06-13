# Spotify Flappy - Complete Overhaul TODO

## Phase 1: Core Mechanics & Feel
- [x] Delta-time game loop (performance.now())
- [x] Tighten physics (gravity 0.55, flap -9.0)
- [x] Beat-synced pipe spawning from audio analysis beats
- [x] Dynamic difficulty from sections (verse=easy, chorus=hard)
- [x] Gentle start: first 5 pipes wider gaps, slower speed

## Phase 2: Feedback & Scoring
- [x] Near-miss detection (within 5px of pipe edge, horizontal overlap required)
- [x] Timing grade system (Perfect/Great/Good per pipe)
- [x] Combo/streak multiplier with visual display
- [x] Tap sound via Web Audio API (musically keyed)
- [x] Near-miss whoosh sound
- [x] Death sound effect
- [x] Grade chime sounds (Perfect=3 notes, Great=2, Good=1)

## Phase 3: Visual Polish
- [x] Pipe glow pulse on beat (caps + edges flash)
- [x] Enhanced beat-reactive background (stronger radial pulse)
- [x] Enhanced death (shake=20, 0.5s slow-mo, red flash)
- [x] Parallax scrolling (3 depth layers, seam-free)
- [x] Floating grade/combo popups that fade out
- [x] Larger score display (44px) + combo counter HUD (auto-scaling)
- [x] Ceiling glow indicator line

## Phase 4: Death Screen & Analytics
- [x] Post-death: % song completed with progress bar, pipes passed, accuracy rating
- [x] Perfect/Great/Good breakdown stats
- [x] Max combo and near-miss count
- [x] Letter grade rating (S/A/B/C/D)
- [x] Milestone celebrations at 25/50/75% with particle burst + sound
- [x] Personal best comparison (NEW BEST or "X away from best")

## Phase 5: Difficulty & Settings
- [x] 3 difficulty tiers (Easy/Normal/Hard) with gap/speed modifiers
- [x] Difficulty selector in game footer bar

## Phase 6: Audio/Timing Sync (Playtesting Fixes)
- [x] Audio-synced game clock (polls Spotify getCurrentState every 200ms)
- [x] Hard sync gate: 3-2-1 countdown with metronome before gameplay
- [x] Death audio: instant pause, no pitch-shift, frozen game time
- [x] Audio calibration screen (tap-to-calibrate, offset in localStorage)
- [x] Metronome sound for countdown

## Phase 7: Physics & Feel (Playtesting Fixes)
- [x] Forgiving hitbox: 85% of visual sprite for collisions
- [x] Velocity cap (1.5x flap) + 50ms tap cooldown
- [x] Non-lethal ceiling boundary with position clamping
- [x] Tightened near-miss zone (5px, horizontal overlap only)

## Phase 8: Sound Engine
- [x] Polyphony limiter (max 3 simultaneous tap voices)
- [x] Dynamic compressor on SFX bus (-20dB threshold, 4:1 ratio)

## Phase 9: UI/UX
- [x] Pause button (⏸) + ESC key + auto-pause on visibility change
- [x] Pause overlay with score/combo display
- [x] Calibration button (⚙) in game footer
- [x] Google Fonts loaded (Orbitron + Space Mono)
- [x] Viewport lock for mobile

## Phase 10: Accessibility (Post-MVP)
- [ ] Colorblind mode
- [ ] Visual-only rhythm cues for deaf/hard-of-hearing
- [ ] Screen reader / VoiceOver support for menus

## Architecture
- [x] Split into modules: sounds.js, renderer.js, screens.jsx, SpotifyFlappy.jsx
- [x] Clean build with 0 errors (33 modules, 237KB gzipped to 74KB)
- [x] Particle pool capped at 300 with forced recycling
