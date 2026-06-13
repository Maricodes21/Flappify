import { useState, useEffect, useRef, useCallback } from "react";
import { playWhoosh, playDeath, playGrade, playMilestone, playMetronome, playMiss } from "./sounds";
import { drawGame } from "./renderer";
import { SetupScreen, LoadingScreen, GameScreen, CalibrationScreen } from "./screens";
import MainMenu from "./menu/MainMenu";
import TopTracks from "./menu/TopTracks";
import SearchScreen from "./menu/SearchScreen";
import PlaylistBrowser from "./menu/PlaylistBrowser";
import TrackList from "./menu/TrackList";
import SpriteCustomizer from "./game/SpriteCustomizer";
import SettingsScreen from "./settings/SettingsScreen";
import ThemeSelector from "./settings/ThemeSelector";
import { getSpriteById } from "./game/sprites";
import { getSpriteChoice, saveScore, getSetting, saveLastPlayed, getThemeChoice } from "./services/storage";
import { getUserProfile } from "./services/spotify";
import { buildPipeSchedule, computeDifficultyRating, distanceToNearestDownbeat, generateSyntheticAnalysis } from "./game/beatMapper";
import { analyzePreview } from "./game/audioAnalyzer";
import { getThemeById, THEMES, applyThemeCSS } from "./game/ThemeEngine";
import { saveSetting } from "./services/storage";

async function genPKCE() {
  const arr = new Uint8Array(32); crypto.getRandomValues(arr);
  const v = btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  const c = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return { v, c };
}

function extractPalette(img) {
  try {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const ct = cv.getContext("2d"); ct.drawImage(img, 0, 0, 64, 64);
    const d = ct.getImageData(0, 0, 64, 64).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
      if (lum > 30 && lum < 215) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    }
    if (!n) { r = 29; g = 185; b = 84; n = 1; }
    r = (r / n) | 0; g = (g / n) | 0; b = (b / n) | 0;
    const br = Math.min(255, r * 1.4) | 0, bg = Math.min(255, g * 1.4) | 0, bb = Math.min(255, b * 1.4) | 0;
    return { base: `rgb(${r},${g},${b})`, bright: `rgb(${br},${bg},${bb})`, dark: `rgb(${(r * .12) | 0},${(g * .12) | 0},${(b * .12) | 0})`, deep: `rgb(${(r * .06) | 0},${(g * .06) | 0},${(b * .06) | 0})`, glow: `rgba(${br},${bg},${bb},0.6)`, rgb: [r, g, b] };
  } catch { return { base: "#1DB954", bright: "#4ade80", dark: "#061a0c", deep: "#020d06", glow: "rgba(77,222,128,0.6)", rgb: [29, 185, 84] }; }
}

const W = 420, H = 600, PIPE_W = 54, BIRD_R = 15, HIT_R = BIRD_R * 0.80, GRAVITY = 0.55, FLAP_VEL = -9.0;
const BASE_SPEED = 2.6, BASE_GAP = 175, PIPE_INTERVAL = 105, NEAR_MISS = 5;
const MAX_PARTICLES = 300, MAX_UP_VEL = FLAP_VEL * 1.5, TAP_COOLDOWN = 180;
const DISABLE_PIPE_COLLISION = false; // pipes kill the player normally
const DIFF = { easy: { gapM: 1.25, spdM: 0.8 }, normal: { gapM: 1.0, spdM: 1.0 }, hard: { gapM: 0.8, spdM: 1.2 } };

export default function SpotifyFlappy() {
  const [screen, setScreen] = useState("setup");
  const [clientId, setClientId] = useState("");
  const [token, setToken] = useState(null);
  const [selPl, setSelPl] = useState(null);
  const [track, setTrack] = useState(null);
  const [features, setFeatures] = useState(null);
  const [palette, setPalette] = useState({ base: "#1DB954", bright: "#4ade80", dark: "#061a0c", deep: "#020d06", glow: "rgba(77,222,128,0.6)", rgb: [29, 185, 84] });
  const [phase, setPhaseState] = useState("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [loadMsg, setLoadMsg] = useState("");
  const [difficulty, setDifficulty] = useState(() => getSetting("defaultDifficulty", "normal"));
  const [combo, setCombo] = useState(0);
  const [paused, setPaused] = useState(false);
  const [calibrationOffset, setCalibrationOffset] = useState(() => {
    const stored = localStorage.getItem("sf_calibration_offset");
    return stored ? parseFloat(stored) : 0;
  });
  const [userProfile, setUserProfile] = useState(null);

  const canvasRef = useRef(null), gsRef = useRef(null), phaseRef = useRef("idle"), palRef = useRef(palette);
  const featRef = useRef(null), anaRef = useRef(null), bestRef = useRef(0), scoreRef = useRef(0);
  const comboRef = useRef(0), aliveRef = useRef(false), playerRef = useRef(null), deviceIdRef = useRef(null);
  const diffRef = useRef("normal"), trackRef = useRef(null), songDurRef = useRef(210);
  const pausedRef = useRef(false), calibrationRef = useRef(0);
  const audioSyncRef = useRef({ lastPollTime: 0, lastPosition: 0, polling: false });
  const lastFlapTimeRef = useRef(0);
  const keyDownRef = useRef(false); // prevent hold-down continuous flap
  const trackKeyRef = useRef(0);   // increments each time a new track is picked
  const diffRatingRef = useRef(null);
  const albumImgRef = useRef(null);

  const setPhase = useCallback((p) => { phaseRef.current = p; setPhaseState(p); }, []);
  useEffect(() => { palRef.current = palette; }, [palette]);
  useEffect(() => { diffRef.current = difficulty; }, [difficulty]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { calibrationRef.current = calibrationOffset; }, [calibrationOffset]);

  // Fetch user profile after login
  useEffect(() => {
    if (!token) return;
    getUserProfile(token).then(p => setUserProfile(p));
  }, [token]);

  // Poll Spotify player position for audio sync
  const pollAudioPosition = useCallback(async () => {
    const player = playerRef.current;
    if (!player || audioSyncRef.current.polling) return;
    audioSyncRef.current.polling = true;
    try {
      const state = await player.getCurrentState();
      if (state && !state.paused) {
        audioSyncRef.current.lastPosition = state.position / 1000;
        audioSyncRef.current.lastPollTime = performance.now();
      }
    } catch {}
    audioSyncRef.current.polling = false;
  }, []);

  // Auto-pause on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && phaseRef.current === "playing") {
        setPaused(true);
        pausedRef.current = true;
        if (playerRef.current) playerRef.current.pause();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // OAuth callback
  useEffect(() => {
    const ps = new URLSearchParams(location.search), code = ps.get("code"), v = sessionStorage.getItem("sf_v"), cid = sessionStorage.getItem("sf_cid");
    if (!code || !v || !cid) return;
    fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: location.origin + location.pathname, client_id: cid, code_verifier: v }),
    }).then(r => r.json()).then(d => { if (d.access_token) { setToken(d.access_token); setClientId(cid); setScreen("menu"); history.replaceState({}, "", location.pathname); } });
  }, []);

  const login = async () => {
    if (!clientId.trim()) return;
    const { v, c } = await genPKCE(); sessionStorage.setItem("sf_v", v); sessionStorage.setItem("sf_cid", clientId.trim());
    const p = new URLSearchParams({ client_id: clientId.trim(), response_type: "code", redirect_uri: location.origin + location.pathname,
      scope: "playlist-read-private user-library-read streaming user-read-email user-read-playback-state user-modify-playback-state user-top-read user-read-currently-playing",
      code_challenge_method: "S256", code_challenge: c });
    location.href = `https://accounts.spotify.com/authorize?${p}`;
  };

  // Playback SDK
  useEffect(() => {
    if (!token) return;
    const init = () => { if (!window.Spotify) return;
      const p = new window.Spotify.Player({ name: "Spotify Flappy", getOAuthToken: cb => cb(token), volume: 0.8 });
      p.addListener("ready", ({ device_id }) => { deviceIdRef.current = device_id; });
      p.addListener("not_ready", () => { deviceIdRef.current = null; });
      ["initialization_error", "authentication_error", "account_error"].forEach(e => p.addListener(e, ({ message }) => console.error(e, message)));
      p.connect(); playerRef.current = p;
    };
    window.onSpotifyWebPlaybackSDKReady = init;
    window.onSpotifyPlayerAPIReady = init;
    if (window.Spotify) init();
    return () => { if (playerRef.current) { playerRef.current.disconnect(); playerRef.current = null; } };
  }, [token]);

  const startPlay = useCallback(async (uri) => {
    const d = deviceIdRef.current; if (!d || !token) return;
    try { await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${d}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ uris: [uri] }) }); } catch {}
  }, [token]);
  const resumePlay = useCallback(() => { if (playerRef.current) playerRef.current.resume(); }, []);
  const pausePlay = useCallback(() => { if (playerRef.current) playerRef.current.pause(); }, []);

  const pickTrack = async (t, seekMs) => {
    setTrack(t); trackRef.current = t; songDurRef.current = (t.duration_ms || 210000) / 1000;
    setScreen("loading"); setLoadMsg("Analyzing audio...");

    // Load album art for custom sprite
    albumImgRef.current = null;
    if (t.album?.images?.[0]?.url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { albumImgRef.current = img; };
      img.src = t.album.images[0].url;
    }

    try {
      const fullDur = songDurRef.current || 210;

      // ── Strategy: Preview URL analysis → Spotify API fallback → Synthetic ──
      // Priority 1: Analyze the preview MP3 with Web Audio API (real beat detection)
      // Priority 2: Try Spotify audio-analysis API (likely 403 since Nov 2024)
      // Priority 3: Pure synthetic generation from estimated BPM

      let f = null;  // features
      let a = null;  // analysis

      // Try preview URL analysis first (works regardless of Spotify API status)
      if (t.preview_url) {
        setLoadMsg("Detecting beats from audio...");
        try {
          const result = await analyzePreview(t.preview_url, fullDur);
          f = result.features;
          a = result.analysis;
          console.log(`[audioAnalyzer] BPM: ${f.tempo}, beats: ${a.beats.length}, method: ${a.meta?.method}`);
        } catch (previewErr) {
          console.warn("[audioAnalyzer] Preview analysis failed:", previewErr.message);
        }
      }

      // Fallback: try Spotify API (may return 403 since deprecation)
      if (!a) {
        setLoadMsg("Fetching audio data...");
        try {
          const [fr, ar] = await Promise.all([
            fetch(`https://api.spotify.com/v1/audio-features/${t.id}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`https://api.spotify.com/v1/audio-analysis/${t.id}`, { headers: { Authorization: `Bearer ${token}` } })]);

          if (!f && fr.ok) {
            const fData = await fr.json();
            if (fData && !fData.error) f = fData;
          }
          if (ar.ok) {
            const aData = await ar.json();
            if (aData && !aData.error && aData.beats && aData.beats.length > 0) {
              a = aData;
            }
          }
        } catch (apiErr) {
          console.warn("[pickTrack] Spotify API fallback failed:", apiErr.message);
        }
      }

      // Final fallback: pure synthetic generation
      if (!f) f = { tempo: 120, energy: 0.7, key: 7, danceability: 0.5, valence: 0.5 };
      if (!a) {
        setLoadMsg("Generating rhythm map...");
        a = generateSyntheticAnalysis(f.tempo || 120, fullDur);
      }

      setFeatures(f); featRef.current = f;
      anaRef.current = a;
      setLoadMsg("Building level...");

      // Compute and cache difficulty rating
      const diffRating = computeDifficultyRating(f, a);
      diffRatingRef.current = diffRating;
    } catch (err) {
      console.error("[pickTrack] All analysis paths failed:", err);
      featRef.current = { tempo: 120, energy: 0.7, key: 7, danceability: 0.5 };
      anaRef.current = generateSyntheticAnalysis(120, songDurRef.current || 210);
    }
    if (t.album?.images?.[0]?.url) await new Promise(res => { const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { const p = extractPalette(img); setPalette(p); palRef.current = p; res(); }; img.onerror = res; img.src = t.album.images[0].url; });
    scoreRef.current = 0; comboRef.current = 0; setScore(0); setCombo(0); setPhase("idle");
    trackKeyRef.current += 1; // force GameScreen to remount pre-game
    setPaused(false); pausedRef.current = false;
    setScreen("game");
  };

  // Navigation handler for menu
  const handleNavigate = useCallback((target) => {
    setScreen(target);
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setUserProfile(null);
    setScreen("setup");
    sessionStorage.removeItem("sf_v");
    sessionStorage.removeItem("sf_cid");
  }, []);

  // Init game
  const initGame = useCallback(() => {
    const f = featRef.current || { tempo: 120, energy: 0.7, key: 7 };
    const bpm = Math.max(50, f.tempo || 120), energy = f.energy ?? 0.7, dm = DIFF[diffRef.current] || DIFF.normal;
    const speed = BASE_SPEED * (bpm / 120) * (0.75 + energy * 0.5) * dm.spdM;
    const gap = BASE_GAP * (1.25 - energy * 0.45) * dm.gapM;

    // Build rhythm-driven pipe schedule from audio analysis
    const pipeData = buildPipeSchedule(anaRef.current, f, diffRef.current, dm, BASE_GAP);
    const { schedule: pipeSchedule, sections, bars, beats, barStarts, beatDots, trailDots } = pipeData;

    const drops = []; for (let i = 1; i < sections.length; i++) { if (sections[i].loudness - sections[i - 1].loudness > 3 || i === 1) drops.push(sections[i].start); }
    const dur = songDurRef.current;
    const beatDuration = 60 / bpm;


    gsRef.current = {
      bird: { x: 80, y: H / 2, vy: 0, angle: 0, pulse: 0, trail: [] }, pipes: [], particles: [], shockwaves: [], floats: [],
      stars: Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 90), r: .4 + Math.random() * 1.6, speed: .1 + Math.random() * .4, tw: Math.random() * Math.PI * 2 })),
      par: [{ pts: Array.from({ length: 12 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 100), r: 1 + Math.random() * 2 })), spd: .15 },
        { pts: Array.from({ length: 8 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 100), r: 2 + Math.random() * 3 })), spd: .35 },
        { pts: Array.from({ length: 5 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 100), r: 3 + Math.random() * 4 })), spd: .6 }],
      score: 0, combo: 0, maxCombo: 0, totalPipes: 0, perfects: 0, greats: 0, goods: 0, nearMisses: 0,
      // Beat-accuracy scoring (PRIMARY scoring system)
      rhythmScore: 0, beatTaps: 0, onBeatTaps: 0, closeBeatTaps: 0, totalScore: 0,
      // Rhythm streak (consecutive dots collected — primary engagement metric)
      rhythmStreak: 0, maxRhythmStreak: 0, dotsMissed: 0, dotsCollected: 0, totalDots: 0,
      speed, baseSpeed: speed, gap, baseGap: gap,
      // Schedule-based pipe spawning
      pipeSchedule, scheduleIdx: 0,
      // Legacy fallback fields
      pipeTimer: 0, pipeInterval: Math.max(70, PIPE_INTERVAL - energy * 20),
      beats, beatIdx: 0, beatsPerPipe: Math.max(2, Math.round(4 - energy * 2)), beatCounter: 0,
      beatPhase: 0, beatInterval: (60 / bpm) * 60, beatFlash: 0,
      dropEffect: 0, drops, dropIdx: 0, sections, secIdx: 0,
      barStarts: barStarts || [],
      milestones: [dur * .25, dur * .5, dur * .75], mileIdx: 0,
      viz: Array.from({ length: 28 }, () => ({ h: 3, target: 3 })),
      gt: 0, lastT: 0, shake: 0, slowMo: 0, dFlash: 0, pipesSpawned: 0, songDur: dur,
      musicPaused: false,
      countdownBeats: 4,
      countdownProgress: 0,
      countdownLastBeat: -1,
      beatDuration,
      bpm,
      // Score multiplier state
      scoreMultiplier: 1,
      multiplierTimer: 0,
      // Visual pulse state
      kickPulse: 0,
      offBeatFlash: 0,
      chromaFlash: 0,
      // Overdrive (5 consecutive perfects)
      perfectStreak: 0,
      // Drop sequence
      dropReadyTimer: 0,
      dropBonusActive: false,
      dropBonusTimer: 0,
      lastKickBeatIdx: -1,
      // Beat dots system — PRIMARY gameplay element (rhythm highway)
      beatDots: beatDots || [],
      trailDots: trailDots || [],   // secondary path-following rhythm guide dots
      _collectedDots: new Set(),
      _missedDots: new Set(),
      _flashingDots: {},
      _trailCollected: new Set(),   // trail dots that have been absorbed by the bird
      _trailFlashing: {},           // idx → timer (0.45s dissolve animation)
      _dotBeatGlow: 0,
      beatShield: 0, // brief pipe-collision immunity after collecting a dot
      _lastCheckedDotIdx: 0, // for miss detection scan
    };
    audioSyncRef.current = { lastPollTime: 0, lastPosition: 0, polling: false };
  }, []);

  // Pause / resume
  const togglePause = useCallback(() => {
    if (phaseRef.current !== "playing" && phaseRef.current !== "countdown" && !pausedRef.current) return;
    if (pausedRef.current) {
      setPaused(false); pausedRef.current = false;
      resumePlay();
      if (gsRef.current) {
        gsRef.current.lastT = performance.now();
        // Reset audio sync so gt doesn't jump on resume
        audioSyncRef.current.lastPollTime = 0;
      }
    } else {
      setPaused(true); pausedRef.current = true;
      pausePlay();
    }
  }, [resumePlay, pausePlay]);

  // Flap
  const flap = useCallback(() => {
    const p = phaseRef.current, f = featRef.current || { key: 7 };
    if (pausedRef.current) return;

    if (p === "idle") {
      setPhase("countdown");
      if (gsRef.current) {
        gsRef.current.countdownProgress = 0;
        gsRef.current.countdownLastBeat = -1;
        gsRef.current.lastT = performance.now();
      }
    }
    else if (p === "countdown") {
      // no sound during countdown
    }
    else if (p === "playing") {
      const now = performance.now();
      if (now - lastFlapTimeRef.current < TAP_COOLDOWN) return;
      lastFlapTimeRef.current = now;
      if (gsRef.current) {
        gsRef.current.bird.vy = Math.max(MAX_UP_VEL, gsRef.current.bird.vy + FLAP_VEL * 0.7);
        if (gsRef.current.bird.vy > FLAP_VEL) gsRef.current.bird.vy = FLAP_VEL;
        gsRef.current.bird.pulse = 1;

        // ── Beat Dot Checkpoint Collection on Tap ──────────────
        const g = gsRef.current;
        if (g.beatDots && g.beatDots.length > 0 && g.speed > 0) {
          const spd = g.pipesSpawned <= 5 ? g.speed * (0.8 + g.pipesSpawned * 0.04) : g.speed;

          // Find the nearest uncollected dot to the bird
          let bestDot = null;
          let bestIdx = -1;
          let minDx = Infinity;

          for (let i = 0; i < g.beatDots.length; i++) {
            if (g._collectedDots.has(i)) continue;
            const d = g.beatDots[i];
            const dotX = g.bird.x + (d.time - g.gt) * spd * 60;

            // Only consider dots on or near screen
            if (dotX < -100) continue;
            if (dotX > W + 100) break; // sorted by time, safe to break

            const dx = Math.abs(g.bird.x - dotX);
            if (dx < minDx) { minDx = dx; bestDot = d; bestIdx = i; }
          }

          g.beatTaps++;
          if (bestDot && minDx < 45) {
            g._collectedDots.add(bestIdx);
            g._flashingDots[bestIdx] = 0.5; // 0.5s flash animation
            g.beatShield = 0.55; // generous shield — collecting a dot guarantees surviving nearby pipes
            g.dotsCollected++;

            // Tier multiplier from dot data (gold=2×, silver=1.5×, cyan=1×, sub=0.75×)
            const tierMult = bestDot.tierMultiplier || 1;
            const fx = g.bird.x + (bestDot.time - g.gt) * spd * 60;

            // Rhythm streak grows with each collection
            g.rhythmStreak++;
            if (g.rhythmStreak > g.maxRhythmStreak) g.maxRhythmStreak = g.rhythmStreak;
            const streakBonus = g.rhythmStreak >= 10 ? 2 : 1;

            if (minDx <= 15) {
              // PERFECT — bird is right on top of the dot
              g.onBeatTaps++;
              const overdriveBonus = g.perfectStreak >= 5 ? 2 : 1;
              const pts = Math.round(300 * tierMult * streakBonus * overdriveBonus);
              g.rhythmScore += pts;
              g.perfects++;
              const label = g.perfectStreak >= 5 ? "★ PERFECT!" : `PERFECT +${pts}`;
              g.floats.push({ x: fx, y: bestDot.y - 25, text: label, color: "#FFD700", life: 0.8, size: 14 });
              g.bird.pulse = 1.5;
              g.beatFlash = Math.max(g.beatFlash, 0.8);
              // Gold particle burst
              for (let pi = 0; pi < 12; pi++) {
                const a = (pi / 12) * Math.PI * 2, sp = 2 + Math.random() * 3;
                g.particles.push({ x: fx, y: bestDot.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, size: 2 + Math.random() * 2, color: "#FFD700" });
              }
            } else if (minDx <= 30) {
              // GREAT — bird is very close to the dot
              g.closeBeatTaps++;
              const pts = Math.round(150 * tierMult * streakBonus);
              g.rhythmScore += pts;
              g.greats++;
              g.floats.push({ x: fx, y: bestDot.y - 25, text: `GREAT +${pts}`, color: "#4ade80", life: 0.6, size: 11 });
              g.beatFlash = Math.max(g.beatFlash, 0.4);
            } else {
              // GOOD — bird is near the dot (tapped slightly early/late)
              const pts = Math.round(50 * tierMult);
              g.rhythmScore += pts;
              g.goods++;
              g.floats.push({ x: fx, y: bestDot.y - 25, text: `GOOD +${pts}`, color: "#a0aec0", life: 0.5, size: 9 });
            }
          } else {
            // OFF BEAT — no dot nearby, no points, no streak break
            g.perfectStreak = 0;
          }
        }
      }
    }
    else if (p === "dead") {
      initGame();
      scoreRef.current = 0; comboRef.current = 0;
      setScore(0); setCombo(0);
      setPhase("idle");
    }
  }, [initGame, setPhase, startPlay, pollAudioPosition]);

  useEffect(() => { if (screen !== "game") return;
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!keyDownRef.current) { keyDownRef.current = true; flap(); }
      }
      if (e.code === "Escape") { e.preventDefault(); togglePause(); }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") keyDownRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [screen, flap, togglePause]);

  // Calibration
  const handleCalibrationComplete = useCallback((offset) => {
    setCalibrationOffset(offset);
    calibrationRef.current = offset;
    localStorage.setItem("sf_calibration_offset", offset.toString());
    setScreen("game");
  }, []);

  // Get active sprite
  const getActiveSprite = useCallback(() => {
    const spriteId = getSpriteChoice();
    return getSpriteById(spriteId);
  }, []);

  // Game loop
  useEffect(() => {
    if (screen !== "game") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); aliveRef.current = true; initGame();
    // Expose game state on canvas element for progress bar reading
    Object.defineProperty(canvas, '__gameState', { get: () => gsRef.current, configurable: true });
    const TDT = 1000 / 60;
    let audioPollTimer = 0;
    const activeSprite = getActiveSprite();

    // Vibe-based theme selection: pick theme based on audio features
    const ft = featRef.current;
    if (ft) {
      let vibeThemeId = "classic";
      const energy = ft.energy ?? 0.5;
      const valence = ft.valence ?? 0.5;
      const danceability = ft.danceability ?? 0.5;

      if (energy > 0.75 && danceability > 0.6) {
        vibeThemeId = "synthwave"; // high energy + danceable → retro-futurism
      } else if (valence > 0.7 && energy < 0.6) {
        vibeThemeId = "kawaii"; // happy + chill → kawaii
      } else if (energy < 0.4) {
        vibeThemeId = "chalk"; // low energy → mellow chalk
      } else if (energy > 0.6 && valence < 0.35) {
        vibeThemeId = "popart"; // energetic + dark mood → pop-art
      } else {
        // Random from all themes
        vibeThemeId = THEMES[Math.floor(Math.random() * THEMES.length)].id;
      }
      const vibeTheme = getThemeById(vibeThemeId);
      saveSetting("theme", vibeThemeId);
      applyThemeCSS(vibeTheme);
    }

    const tick = (now) => {
      if (!aliveRef.current) return;
      const g = gsRef.current; if (!g) { requestAnimationFrame(tick); return; }

      if (pausedRef.current) {
        drawGame(ctx, g, palRef.current, featRef.current || { tempo: 120, energy: 0.7, key: 7 }, phaseRef.current, scoreRef, bestRef, true, activeSprite, albumImgRef.current);
        requestAnimationFrame(tick);
        return;
      }

      if (!g.lastT) g.lastT = now;
      const rawDt = now - g.lastT; g.lastT = now;
      const dt = Math.min(rawDt, 50) / TDT;
      const pal = palRef.current, f = featRef.current || { tempo: 120, energy: 0.7, key: 7 };
      const cp = phaseRef.current;
      const tm = g.slowMo > 0 ? 0.15 : 1.0, adt = dt * tm;

      if (cp === "playing" && !g.musicPaused) {
        audioPollTimer += rawDt;
        if (audioPollTimer >= 200) {
          audioPollTimer = 0;
          pollAudioPosition();
        }
        const sync = audioSyncRef.current;
        if (sync.lastPollTime > 0) {
          const elapsed = (now - sync.lastPollTime) / 1000;
          g.gt = sync.lastPosition + elapsed - calibrationRef.current;
        } else {
          g.gt += (rawDt / 1000) * tm;
        }
      } else if (cp === "countdown") {
        const sync = audioSyncRef.current;
        if (sync.lastPollTime > 0) {
          const elapsed = (now - sync.lastPollTime) / 1000;
          g.gt = sync.lastPosition + elapsed - calibrationRef.current;
        }
      }

      g.shake *= Math.pow(0.85, adt);
      g.slowMo = Math.max(0, g.slowMo - rawDt / 1000); g.dFlash *= Math.pow(0.9, adt);

      g.beatPhase += adt; const onBeat = g.beatPhase >= g.beatInterval;
      if (onBeat) { g.beatPhase -= g.beatInterval; g.beatFlash = Math.max(g.beatFlash, 0.25); g.viz.forEach(v => { v.target = 8 + Math.random() * 52 * (f.energy || .7); }); }
      g.beatFlash *= Math.pow(0.87, adt);
      g.viz.forEach(v => { v.h += (v.target - v.h) * .2 * adt; v.target = Math.max(3, v.target * Math.pow(.91, adt)); });
      g.bird.pulse *= Math.pow(0.88, adt);

      // Countdown phase
      if (cp === "countdown") {
        g.countdownProgress += (rawDt / 1000) / g.beatDuration;
        const currentBeat = Math.floor(g.countdownProgress);
        if (currentBeat > g.countdownLastBeat && currentBeat < g.countdownBeats) {
          g.countdownLastBeat = currentBeat;
          playMetronome();
        }
        if (g.countdownProgress >= g.countdownBeats) {
          const t = trackRef.current;
          if (t?.uri) {
            startPlay(t.uri).then(() => {
              setTimeout(() => pollAudioPosition(), 300);
            });
          }
          setPhase("playing");
          audioSyncRef.current = { lastPollTime: 0, lastPosition: 0, polling: false };
          if (gsRef.current) {
            gsRef.current.bird.vy = FLAP_VEL;
            gsRef.current.gt = 0;
          }
        }
        drawGame(ctx, g, pal, f, cp, scoreRef, bestRef, false, activeSprite, albumImgRef.current);
        requestAnimationFrame(tick);
        return;
      }

      // Section tracking (keep for lighting effects, but no speed/gap/gravity changes)
      if (cp === "playing" && g.sections.length) {
        let si = g.secIdx; while (si < g.sections.length - 1 && g.gt >= g.sections[si + 1].start) si++; g.secIdx = si;
        // Speed and gap stay constant — no song-driven difficulty animation
      }

      // (Kick pulse removed — no longer scaling background on beats)

      // Visual effect decay
      g.offBeatFlash = (g.offBeatFlash || 0) * Math.pow(0.92, adt);
      g.chromaFlash = (g.chromaFlash || 0) * Math.pow(0.95, adt);

      // Chroma flash on high combo
      if (g.combo >= 10) {
        g.chromaFlash = Math.max(g.chromaFlash || 0, 0.3 + Math.min(0.7, (g.combo - 10) * 0.05));
      }

      // ── Drop Sequence (visual-only) ─────────────────────────
      // Drops are purely visual + score multiplier — no pipe spawning or clearing.
      // The schedule-based pipes continue uninterrupted through drops.
      if (g.drops.length > 0 && g.dropIdx < g.drops.length) {
        const nextDrop = g.drops[g.dropIdx];
        const timeUntilDrop = nextDrop - g.gt;

        // Pre-drop: show GET READY banner (no pipe clearing)
        if (timeUntilDrop > 0 && timeUntilDrop <= 2.0 && !g.dropReadyShown) {
          g.dropReadyTimer = 2.0;
          g.dropReadyShown = true;
          // Light up existing pipes with beat glow
          g.pipes.forEach(p => { p.beatGlow = Math.max(p.beatGlow || 0, 0.8); });
        }
      }
      if ((g.dropReadyTimer || 0) > 0) {
        g.dropReadyTimer -= rawDt / 1000;
      }

      while (g.dropIdx < g.drops.length && g.gt >= g.drops[g.dropIdx]) {
        g.dropEffect = 1; g.shake = 6; g.dropIdx++;
        g.dropBonusActive = true;
        g.dropBonusTimer = 4; // 4 seconds of x5 multiplier zone
        g.dropReadyShown = false;
        // Visual burst — particles + shockwave only
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2, sp = 1.5 + Math.random() * 3;
          g.particles.push({ x: g.bird.x, y: g.bird.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: 2 + Math.random() * 3 });
        }
        g.shockwaves.push({ x: g.bird.x, y: g.bird.y, r: 0, life: 1 });
        // Glow up all visible pipes during drop
        g.pipes.forEach(p => { p.beatGlow = 1; });
      }
      if (g.dropBonusActive) {
        g.dropBonusTimer -= rawDt / 1000;
        if (g.dropBonusTimer <= 0) g.dropBonusActive = false;
      }
      g.dropEffect *= Math.pow(0.94, adt);
      g.shockwaves.forEach(s => { s.r += 8 * adt; s.life -= 0.04 * adt; }); g.shockwaves = g.shockwaves.filter(s => s.life > 0);

      // Milestones
      while (g.mileIdx < g.milestones.length && g.gt >= g.milestones[g.mileIdx]) {
        const pct = [25, 50, 75][g.mileIdx]; g.mileIdx++;
        g.floats.push({ x: W / 2, y: H / 2 - 40, text: `${pct}% ♪`, color: "#fff", life: 2, size: 20 });
        for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; g.particles.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 1, size: 3 }); }
        playMilestone();
      }

      // Floating texts
      g.floats.forEach(ft => { ft.life -= rawDt / 1000; ft.y -= 30 * rawDt / 1000; }); g.floats = g.floats.filter(ft => ft.life > 0);

      // Parallax
      if (cp === "playing") { g.par.forEach(layer => { layer.pts.forEach(p => { p.x -= g.speed * layer.spd * adt; if (p.x < -20) p.x = W + 20; }); }); }

      // Physics
      if (cp === "playing") {
        g.bird.vy += GRAVITY * adt; g.bird.y += g.bird.vy * adt;
        g.bird.angle = Math.max(-30, Math.min(72, g.bird.vy * 4.2));

        if (g.bird.y - BIRD_R < 0) {
          g.bird.y = BIRD_R;
          g.bird.vy = Math.max(0, g.bird.vy);
        }

        g.bird.trail.push({ x: g.bird.x, y: g.bird.y }); if (g.bird.trail.length > 12) g.bird.trail.shift();

        // Pipe spawning — schedule-based (rhythm-driven, beat-optimal path)
        if (g.pipeSchedule && g.pipeSchedule.length > 0) {
          while (g.scheduleIdx < g.pipeSchedule.length && g.gt >= g.pipeSchedule[g.scheduleIdx].time) {
            const entry = g.pipeSchedule[g.scheduleIdx];
            const pipeGap = entry.gapSize;
            // Use beat-predicted gapY if available, otherwise fall back to random
            const gy = entry.gapY != null ? entry.gapY : (90 + Math.random() * (H - 180 - pipeGap - 90));
            g.pipes.push({
              x: W + 24, gy, gap: pipeGap, passed: false, graded: false, beatGlow: 0,
              beatType: entry.beatType, isDownbeat: entry.isDownbeat, spawnTime: entry.time,
            });
            g.pipesSpawned++;
            g.scheduleIdx++;
          }
        } else {
          // Fallback: legacy timer-based spawning
          let spawnPipe = false;
          if (g.beats.length > 0) {
            while (g.beatIdx < g.beats.length && g.gt >= g.beats[g.beatIdx]) { g.beatIdx++; g.beatCounter++;
              if (g.beatCounter >= g.beatsPerPipe) { g.beatCounter = 0; spawnPipe = true; } }
          } else { g.pipeTimer += adt; if (g.pipeTimer >= g.pipeInterval) { g.pipeTimer = 0; spawnPipe = true; } }
          if (spawnPipe) {
            const gentleBonus = g.pipesSpawned < 5 ? 1.3 - g.pipesSpawned * 0.06 : 1.0;
            const pipeGap = g.gap * gentleBonus;
            const gy = 90 + Math.random() * (H - 180 - pipeGap - 90);
            g.pipes.push({ x: W + 24, gy, gap: pipeGap, passed: false, graded: false, beatGlow: 0 });
            g.pipesSpawned++;
          }
        }

        // Compute current speed (needed for both dot and pipe movement)
        const curSpeed = g.pipesSpawned <= 5 ? g.speed * (0.8 + g.pipesSpawned * 0.04) : g.speed;

        // ── Procedural Beat Dots Update ────────────────────
        g._dotBeatGlow = (g._dotBeatGlow || 0) * Math.pow(0.92, adt);
        if (onBeat) g._dotBeatGlow = 1;
        
        if (g._flashingDots) {
           for (const idx in g._flashingDots) {
             g._flashingDots[idx] -= rawDt / 1000;
             if (g._flashingDots[idx] <= 0) delete g._flashingDots[idx];
           }
        }

        // ── Trail Dot Pass-Through Collection ──────────────
        // Automatically collected when bird X overlaps the dot X.
        // No tap needed — purely positional. Triggers a soft dissolve.
        if (g.trailDots && g.trailDots.length > 0 && g.speed > 0) {
          const tSpd = curSpeed;
          for (let ti = 0; ti < g.trailDots.length; ti++) {
            if (g._trailCollected.has(ti)) continue;
            const td = g.trailDots[ti];
            const tdX = g.bird.x + (td.time - g.gt) * tSpd * 60;
            if (tdX > W + 60) break;     // not on screen yet
            if (tdX < -60) continue;     // already scrolled off
            const dx = Math.abs(g.bird.x - tdX);
            if (dx < 28) {
              g._trailCollected.add(ti);
              g._trailFlashing[ti] = 0.45; // 0.45s dissolve
            }
          }
          // Decay trail flash timers
          for (const idx in g._trailFlashing) {
            g._trailFlashing[idx] -= rawDt / 1000;
            if (g._trailFlashing[idx] <= 0) delete g._trailFlashing[idx];
          }
        }

        // ── Dot Miss Detection ─────────────────────────────
        // Scan for dots that have scrolled past the bird and weren't collected.
        // Missing a dot resets the rhythm streak (soft penalty).
        if (g.beatDots && g.beatDots.length > 0) {
          const missThreshold = g.gt - 0.5; // 0.5s past the dot = missed
          while (g._lastCheckedDotIdx < g.beatDots.length) {
            const dot = g.beatDots[g._lastCheckedDotIdx];
            if (dot.time > missThreshold) break; // haven't passed this dot yet
            if (!g._collectedDots.has(g._lastCheckedDotIdx) && !g._missedDots.has(g._lastCheckedDotIdx)) {
              // This dot was missed
              g._missedDots.add(g._lastCheckedDotIdx);
              g.dotsMissed++;
              g.rhythmStreak = 0; // reset streak on miss
              // Play miss sound (throttled to avoid spam)
              const now2 = performance.now();
              if (!g._lastMissSoundTime || now2 - g._lastMissSoundTime > 300) {
                playMiss();
                g._lastMissSoundTime = now2;
              }
              // Red flash effect at dot's last position
              const dotX = g.bird.x + (dot.time - g.gt) * curSpeed * 60;
              if (dotX > -100 && dotX < W + 50) {
                g.floats.push({ x: dotX, y: dot.y, text: "MISS", color: "#ff4466", life: 0.5, size: 9 });
              }
            }
            g._lastCheckedDotIdx++;
          }
          // Update totalDots for accuracy tracking
          g.totalDots = g.dotsCollected + g.dotsMissed;
        }

        // Beat shield decay
        if (g.beatShield > 0) {
          g.beatShield -= rawDt / 1000;
        }

        // Advance beat index for beat flash sync
        while (g.beatIdx < g.beats.length && g.gt >= g.beats[g.beatIdx]) { g.beatIdx++; }

        g.pipes.forEach(p => { p.x -= curSpeed * adt; p.beatGlow *= Math.pow(0.92, adt); });
        if (onBeat) g.pipes.forEach(p => { p.beatGlow = 1; });
        g.pipes = g.pipes.filter(p => {
          if (p.x <= -PIPE_W - 24) { p.beatGlow = 0; return false; }
          return true;
        });

        // Score multiplier decay
        if (g.multiplierTimer > 0) {
          g.multiplierTimer -= rawDt / 1000;
          if (g.multiplierTimer <= 0) { g.scoreMultiplier = 1; g.multiplierTimer = 0; }
        }

        // Scoring + grading with downbeat timing zones
        g.pipes.forEach(p => {
          if (!p.passed && p.x + PIPE_W < g.bird.x) {
            p.passed = true;

            // Downbeat timing bonus: check if pipe passage aligns with a bar start
            let timingMult = 1;
            let timingLabel = "";
            if (g.barStarts && g.barStarts.length > 0) {
              const { ratio } = distanceToNearestDownbeat(g.gt, g.barStarts, g.beatDuration);
              if (ratio < 0.15) {
                timingMult = 3;
                timingLabel = "DOWNBEAT!";
                g.scoreMultiplier = 3;
                g.multiplierTimer = 2;
                g.beatFlash = Math.max(g.beatFlash, 0.9);
              } else if (ratio < 0.35) {
                timingMult = 1.5;
                timingLabel = "ON BEAT";
                g.scoreMultiplier = Math.max(g.scoreMultiplier, 1.5);
                g.multiplierTimer = Math.max(g.multiplierTimer, 1);
              }
            }

            // Drop bonus: x5 multiplier during drop zone
            if (p.isDropPipe || g.dropBonusActive) {
              timingMult = Math.max(timingMult, 5);
              g.scoreMultiplier = Math.max(g.scoreMultiplier, 5);
              g.multiplierTimer = Math.max(g.multiplierTimer, 2);
            }

            const pipePoints = Math.round(1 * timingMult);
            g.score += pipePoints;
            g.totalPipes++;

            // Track calculated total score — dots dominate, pipes secondary (×10)
            const liveTotal = (g.score * 10) + (g.rhythmScore || 0) + (g.maxRhythmStreak || 0) * 50;
            scoreRef.current = g.score; setScore(g.score);
            if (liveTotal > bestRef.current) { bestRef.current = liveTotal; setBest(liveTotal); }

            // Show downbeat timing label
            if (timingLabel) {
              g.floats.push({ x: p.x + PIPE_W / 2, y: g.bird.y - 50, text: timingLabel, color: timingMult >= 3 ? "#FFD700" : "#4ade80", life: 1.0, size: timingMult >= 3 ? 14 : 11 });
            }
          }
          if (!p.graded && p.passed) {
            p.graded = true;
            const gapCenter = p.gy + p.gap / 2, dist = Math.abs(g.bird.y - gapCenter), halfGap = p.gap / 2;
            let grade, color;
            if (dist < halfGap * 0.2) {
              grade = "perfect"; color = "#FFD700"; g.perfects++;
              g.perfectStreak = (g.perfectStreak || 0) + 1;
              // Particle burst on perfect
              for (let pi = 0; pi < 12; pi++) {
                const a = (pi / 12) * Math.PI * 2;
                const sp = 2 + Math.random() * 3;
                g.particles.push({ x: g.bird.x, y: g.bird.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, size: 2 + Math.random() * 2, color });
              }
            }
            else if (dist < halfGap * 0.45) { grade = "great"; color = "#4ade80"; g.greats++; g.perfectStreak = (g.perfectStreak || 0) + 1; }
            else { grade = "good"; color = pal.base; g.goods++; g.perfectStreak = 0; }
            g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo;
            comboRef.current = g.combo; setCombo(g.combo);
            const mult = g.combo >= 5 ? " ×" + g.combo : "";
            const overLabel = (g.perfectStreak || 0) >= 5 ? " ★OD" : "";
            g.floats.push({ x: p.x + PIPE_W / 2, y: g.bird.y - 30, text: grade.toUpperCase() + mult + overLabel, color, life: 1.2, size: grade === "perfect" ? 16 : 14 });
            playGrade(grade);
          }
        });

        // Near-miss
        const { x: bx, y: by } = g.bird;
        const dynamicNearMiss = NEAR_MISS * (g.speed / BASE_SPEED);
        for (const p of g.pipes) {
          if (bx + HIT_R > p.x && bx - HIT_R < p.x + PIPE_W) {
            const topDist = by - HIT_R - p.gy, botDist = p.gy + p.gap - (by + HIT_R);
            if ((topDist > 0 && topDist < dynamicNearMiss) || (botDist > 0 && botDist < dynamicNearMiss)) {
              if (!p.nearMissed) { p.nearMissed = true; g.nearMisses++; playWhoosh();
                g.floats.push({ x: bx, y: by - 20, text: "CLOSE!", color: "#ff6b6b", life: 0.8, size: 12 }); }
            }
          }
        }

        // Collision
        const die = () => {
          g.shake = 20; g.slowMo = 0.5; g.dFlash = 1;
          g.combo = 0; comboRef.current = 0; setCombo(0);
          g.musicPaused = true;
          pausePlay();
          playDeath();
          setPhase("dead");

          // Compute composite score — rhythm-dominant
          const dur = g.songDur || 210;
          const pct = Math.min(100, Math.round((g.gt / dur) * 100));
          const rhythmAccuracy = g.dotsCollected > 0 ? Math.round(((g.perfects + g.greats) / (g.dotsCollected + g.dotsMissed)) * 100) : 0;

          // totalScore = pipes*10 + rhythmScore + songProgress*10 + streak bonus
          const pipeScore = g.score * 10;
          const progressScore = pct * 10;
          const streakBonus = g.maxRhythmStreak * 50;
          const totalScore = pipeScore + g.rhythmScore + progressScore + streakBonus;
          g.totalScore = totalScore;
          g.rhythmAccuracy = rhythmAccuracy;

          // Rating based on rhythm accuracy (dots), not pipe accuracy
          let rating = "D";
          if (rhythmAccuracy >= 85 && totalScore >= 3000) rating = "S";
          else if (rhythmAccuracy >= 70 && totalScore >= 1500) rating = "A";
          else if (rhythmAccuracy >= 55 && totalScore >= 800) rating = "B";
          else if (rhythmAccuracy >= 40 && totalScore >= 300) rating = "C";

          const t = trackRef.current;
          if (t) {
            const dr = diffRatingRef.current;
            const scoreData = {
              score: g.score,
              totalScore,
              accuracy: rhythmAccuracy,
              rating,
              maxCombo: g.maxCombo,
              perfects: g.perfects,
              greats: g.greats,
              goods: g.goods,
              nearMisses: g.nearMisses,
              rhythmScore: g.rhythmScore,
              rhythmAccuracy,
              rhythmStreak: g.maxRhythmStreak,
              dotsCollected: g.dotsCollected,
              dotsMissed: g.dotsMissed,
              onBeatTaps: g.onBeatTaps,
              beatTaps: g.beatTaps,
              songPct: pct,
              difficulty: diffRef.current,
              difficultyStars: dr?.stars || null,
              trackName: t.name,
              artistName: t.artists?.map(a => a.name).join(", "),
              albumArt: t.album?.images?.[2]?.url,
              trackObj: t,
            };
            saveScore(t.id, scoreData);
            saveLastPlayed({
              trackId: t.id,
              trackName: t.name,
              artistName: t.artists?.map(a => a.name).join(", "),
              albumArt: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url,
              totalScore,
              rating,
              songPct: pct,
              trackObj: t,
              difficultyStars: dr?.stars || null,
            });


          }
        };
        if (by + BIRD_R > H - 70) die();
        else if (!DISABLE_PIPE_COLLISION && g.beatShield <= 0) {
          // Only check pipe collisions when beat shield is NOT active
          for (const p of g.pipes) {
            if (bx + HIT_R > p.x && bx - HIT_R < p.x + PIPE_W) {
              if (by - HIT_R < p.gy || by + HIT_R > p.gy + p.gap) { die(); break; }
            }
          }
        }

        // Ambient particles
        if (onBeat && Math.random() > 0.45) {
          g.particles.push({ x: Math.random() * W, y: H - 70 + Math.random() * 5, vx: (Math.random() - .5) * 2, vy: -(1.2 + Math.random() * 3.5), life: 1, size: 1.5 + Math.random() * 3 });
        }
        g.particles.forEach(p => { p.x += p.vx * adt; p.y += p.vy * adt; p.life -= 0.018 * adt; });
        g.particles = g.particles.filter(p => p.life > 0);
        if (g.particles.length > MAX_PARTICLES) {
          g.particles = g.particles.slice(-MAX_PARTICLES);
        }
      }

      drawGame(ctx, g, pal, f, cp, scoreRef, bestRef, false, activeSprite, albumImgRef.current);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { aliveRef.current = false; pausePlay(); };
  }, [screen, initGame, setPhase, pausePlay, pollAudioPosition, getActiveSprite]);

  // Screen routing
  if (screen === "setup") return <SetupScreen clientId={clientId} setClientId={setClientId} login={login} />;
  if (screen === "menu") return <MainMenu token={token} userProfile={userProfile} onPickTrack={pickTrack} onNavigate={handleNavigate} />;
  if (screen === "playlists") return <PlaylistBrowser token={token} onSelectPlaylist={(pl) => { setSelPl(pl); setScreen("tracks"); }} onBack={() => setScreen("menu")} />;
  if (screen === "tracks") return <TrackList token={token} playlist={selPl} onPickTrack={pickTrack} onBack={() => setScreen("playlists")} />;
  if (screen === "top-tracks") return <TopTracks token={token} onPickTrack={pickTrack} onBack={() => setScreen("menu")} />;
  if (screen === "search") return <SearchScreen token={token} onPickTrack={pickTrack} onBack={() => setScreen("menu")} />;
  if (screen === "sprites") return <SpriteCustomizer onBack={() => setScreen("menu")} palette={palette} />;
  if (screen === "themes") return <ThemeSelector onBack={() => setScreen("menu")} />;
  if (screen === "settings") return <SettingsScreen onBack={() => setScreen("menu")} onCalibrate={() => setScreen("calibration")} onNavigate={handleNavigate} userProfile={userProfile} onLogout={handleLogout} />;
  if (screen === "loading") return <LoadingScreen loadMsg={loadMsg} />;
  if (screen === "calibration") return <CalibrationScreen features={features} palette={palette} onComplete={handleCalibrationComplete} onSkip={() => setScreen("game")} />;
  return <GameScreen W={W} H={H} canvasRef={canvasRef} track={track} features={features} palette={palette}
    score={score} best={best} combo={combo} difficulty={difficulty} setDifficulty={setDifficulty}
    flap={flap} setScreen={setScreen} togglePause={togglePause} paused={paused}
    onCalibrate={() => setScreen("calibration")} calibrationOffset={calibrationOffset}
    trackKey={trackKeyRef.current}
    onBackToMenu={() => { pausePlay(); setPaused(false); pausedRef.current = false; setPhase("idle"); setScreen("menu"); }} />;
}
