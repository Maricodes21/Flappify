import { useState, useEffect, useRef, useCallback } from "react";
import { playWhoosh, playDeath, playGrade, playMilestone, playMetronome, playMiss, unlockGameAudio, stopSynthesizedBackingTrack } from "./sounds";
import { drawGame } from "./renderer";
import { SetupScreen, LoadingScreen, GameScreen, CalibrationScreen, TasteSetupScreen } from "./screens";
import AppShell from "./menu/AppShell";
import MainMenu from "./menu/MainMenu";
import TopTracks from "./menu/TopTracks";
import SearchScreen from "./menu/SearchScreen";
import PlaylistBrowser from "./menu/PlaylistBrowser";
import TrackList from "./menu/TrackList";
import SpriteCustomizer from "./game/SpriteCustomizer";
import SettingsScreen from "./settings/SettingsScreen";
import ThemeSelector from "./settings/ThemeSelector";
import { getSpriteById } from "./game/sprites";
import { getBestScore, getSpriteChoice, saveScore, getSetting, saveLastPlayed, getThemeChoice, recordRunProgression, saveImportedTrack, recordDailyListeningTrack } from "./services/storage";
import { getTopTracks, getUserProfile } from "./services/spotify";
import { enrichLocalTrackMetadata, getTasteProfiles, getTasteTracks, mergeTasteTracks, normalizeSpotifyTasteTracks, resolveTasteTrackToSpotify, saveTasteProfiles } from "./services/taste";
import { buildPipeSchedule, computeDifficultyRating, distanceToNearestDownbeat, generateSyntheticAnalysis } from "./game/beatMapper";
import { analyzeLocalAudio, analyzePreview } from "./game/audioAnalyzer";
import { getThemeById, THEMES, applyThemeCSS } from "./game/ThemeEngine";
import { saveSetting, getHomeThemeChoice } from "./services/storage";
import { GAME_HEIGHT as H, GAME_WIDTH as W, PLAYER_X } from "./game/dimensions";
import { calculateFlightAccuracy, calculateRating, calculateRhythmAccuracy, calculateRhythmPoints, calculateSongProgress, calculateTotalScore, getScorePoints, RHYTHM_POINTS } from "./game/scoring";
import { advanceTransportPosition, eventXAt, projectTransportPosition, reconcileTransportAnchor } from "./game/transport";
import { getCountdownState, shouldCompleteRun } from "./game/runState";

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

const PIPE_W = 54, BIRD_R = 15, HIT_R = BIRD_R * 0.80, GRAVITY = 0.55, FLAP_VEL = -9.0;
const BASE_SPEED = 2.6, BASE_GAP = 175, PIPE_INTERVAL = 105, NEAR_MISS = 5;
const MAX_PARTICLES = 300, MAX_UP_VEL = FLAP_VEL * 1.5, TAP_COOLDOWN = 180;
const SPOTIFY_START_TIMEOUT_MS = 12000;
const SPOTIFY_WARMUP_TIMEOUT_MS = 20000;
const SPOTIFY_WARMUP_POSITION_MS = 1500;
const SPOTIFY_START_ADVANCE_MS = 40;
const MIN_COUNTDOWN_MS = 3000;
const SPOTIFY_COUNTDOWN_LEAD_MS = 120;
const DISABLE_PIPE_COLLISION = false; // pipes kill the player normally
const DIFF = { easy: { gapM: 1.25, spdM: 0.8 }, normal: { gapM: 1.0, spdM: 1.0 }, hard: { gapM: 0.8, spdM: 1.2 } };

const delay = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

function readAudioDuration(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const cleanup = () => { audio.removeAttribute("src"); audio.load(); };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      if (duration > 0) resolve(duration);
      else reject(new Error("The browser could not read this track's duration."));
    };
    audio.onerror = () => { cleanup(); reject(new Error("This audio format is not supported by the browser.")); };
    audio.src = url;
  });
}

function makeLocalTrackId(file) {
  const identity = `${file.name}:${file.size}:${file.lastModified}`;
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `local-${(hash >>> 0).toString(36)}`;
}

function getPlaybackTrackUri(state) {
  return state?.track_window?.current_track?.uri || null;
}

const SPOTIFY_SESSION_KEY = "sf_spotify_auth";

function getBootAuth() {
  try {
    const nativeAuth = window.__SF_AUTH__;
    const browserAuth = JSON.parse(sessionStorage.getItem(SPOTIFY_SESSION_KEY) || "null");
    return [nativeAuth, browserAuth].find(auth => (
      auth?.accessToken && auth?.clientId && auth?.expiresAt > Date.now()
    )) || null;
  } catch {
    return null;
  }
}

function postNativeMessage(message) {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  } catch {}
}

function reportSpotifyPlayback(status, details = {}) {
  const message = { type: "spotify-playback", status, ...details };
  console.log("[Spotify playback]", status, details);
  postNativeMessage(message);
}

const DEFAULT_SPOTIFY_CLIENT_ID = "9866081b7994432ca3ff709f75e26173";

function getRedirectUri() {
  return window.__spotifyRedirectUri || import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim() || `${location.origin}/`;
}

export default function SpotifyFlappy() {
  const bootAuthRef = useRef(getBootAuth());
  const [screen, setScreen] = useState("menu");
  const configuredClientId = window.__SF_CONFIG__?.spotifyClientId?.trim() || import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() || DEFAULT_SPOTIFY_CLIENT_ID;
  const [clientId, setClientId] = useState(() => bootAuthRef.current?.clientId || configuredClientId || localStorage.getItem("sf_client_id") || DEFAULT_SPOTIFY_CLIENT_ID);
  const [token, setToken] = useState(bootAuthRef.current?.accessToken || null);
  const [refreshToken, setRefreshToken] = useState(bootAuthRef.current?.refreshToken || null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(bootAuthRef.current?.expiresAt || 0);
  const [selPl, setSelPl] = useState(null);
  const [tracksReturnScreen, setTracksReturnScreen] = useState("playlists");
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
  const [resumePending, setResumePending] = useState(false);
  const [pauseFeedback, setPauseFeedback] = useState("");
  const [runReward, setRunReward] = useState(null);
  const [nextJourneyTrack, setNextJourneyTrack] = useState(null);
  const [chartAnalysis, setChartAnalysis] = useState(null);
  const [calibrationOffset, setCalibrationOffset] = useState(() => {
    const stored = localStorage.getItem("sf_calibration_offset");
    return stored ? parseFloat(stored) : 0;
  });
  const [userProfile, setUserProfile] = useState(null);
  const [tasteProfiles, setTasteProfiles] = useState(() => getTasteProfiles());
  const [tasteTracks, setTasteTracks] = useState([]);
  const [tasteLoading, setTasteLoading] = useState(false);
  const [tasteError, setTasteError] = useState("");
  const [homeNotice, setHomeNotice] = useState("");
  const [spotifyAuthError, setSpotifyAuthError] = useState("");
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioPrepMessage, setAudioPrepMessage] = useState("");

  // Pre-load / buffer audio during pregame screen before run starts
  useEffect(() => {
    if (screen !== "game" || !track) {
      setIsAudioReady(false);
      setAudioPrepMessage("");
      return;
    }
    let cancelled = false;
    setIsAudioReady(false);
    setAudioPrepMessage(track.playbackProvider === "local" ? "BUFFERING LOCAL AUDIO..." : "CONNECTING SPOTIFY...");

    if (track.playbackProvider === "local") {
      const source = track.localAudioUrl;
      if (!source) {
        setIsAudioReady(true);
        setAudioPrepMessage("");
        return;
      }
      let audio = localAudioRef.current;
      if (!audio || audio.dataset.source !== source) {
        try { audio?.pause(); } catch {}
        audio = new Audio(source);
        audio.preload = "auto";
        audio.dataset.source = source;
        localAudioRef.current = audio;
      }
      const markReady = (event) => {
        if (!cancelled) {
          setIsAudioReady(true);
          setAudioPrepMessage(event?.type === "error" ? "AUDIO PRELOAD FAILED · START TO RETRY" : "");
        }
      };
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        markReady();
      } else {
        const onCanPlay = () => markReady();
        const onError = () => markReady({ type: "error" });
        audio.addEventListener("canplay", onCanPlay, { once: true });
        audio.addEventListener("error", onError, { once: true });
        try { audio.load(); } catch {}
      }
    } else {
      if (!token) {
        // Not logged in to Spotify
        setIsAudioReady(true);
        setAudioPrepMessage("");
        return;
      }
      if (playerRef.current && deviceIdRef.current) {
        setIsAudioReady(true);
        setAudioPrepMessage("");
      } else {
        const interval = setInterval(() => {
          if (deviceIdRef.current || !token) {
            clearInterval(interval);
            clearTimeout(timeout);
            if (!cancelled) {
              setIsAudioReady(true);
              setAudioPrepMessage("");
            }
          }
        }, 150);
        const timeout = setTimeout(() => {
          if (!cancelled) {
            setAudioPrepMessage("SPOTIFY PLAYER NOT READY · CHECK CONNECTION");
          }
        }, 20000);
        return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); };
      }
    }
    return () => { cancelled = true; };
  }, [screen, track, token]);

  useEffect(() => {
    const homeTheme = getHomeThemeChoice();
    document.documentElement.setAttribute("data-home-theme", homeTheme);
  }, []);

  const canvasRef = useRef(null), gsRef = useRef(null), phaseRef = useRef("idle"), palRef = useRef(palette);
  const featRef = useRef(null), anaRef = useRef(null), bestRef = useRef(0);
  const comboRef = useRef(0), aliveRef = useRef(false), playerRef = useRef(null), deviceIdRef = useRef(null);
  const lastPlaybackPausedRef = useRef(null);
  const playbackStateRef = useRef(null);
  const playbackOperationRef = useRef(0);
  const resumePendingRef = useRef(false);
  const diffRef = useRef("normal"), trackRef = useRef(null), songDurRef = useRef(210);
  const pausedRef = useRef(false), calibrationRef = useRef(0);
  const audioSyncRef = useRef({ lastPollTime: 0, lastPosition: 0, polling: false });
  const lastFlapTimeRef = useRef(0);
  const keyDownRef = useRef(false); // prevent hold-down continuous flap
  const trackKeyRef = useRef(0);   // increments each time a new track is picked
  const runContextRef = useRef(null);
  const chartAnalysisRef = useRef(null);
  const diffRatingRef = useRef(null);
  const albumImgRef = useRef(null);
  const localAudioRef = useRef(null);
  const localObjectUrlRef = useRef(null);
  const spotifyCodeExchangeRef = useRef("");

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

  useEffect(() => {
    let cancelled = false;
    const hasExternalTaste = Boolean(tasteProfiles.lastFmUser);
    const hasSpotifyTaste = Boolean(tasteProfiles.useSpotifyTaste !== false && token);
    if (!hasExternalTaste && !hasSpotifyTaste) {
      setTasteTracks([]);
      setTasteError("");
      setTasteLoading(false);
      return undefined;
    }
    setTasteLoading(true);
    setTasteError("");
    const requests = [];
    if (hasExternalTaste) requests.push(getTasteTracks({ ...tasteProfiles, listenBrainzUser: "" }));
    if (hasSpotifyTaste) {
      requests.push(getTopTracks(token, "medium_term", 18).then(normalizeSpotifyTasteTracks));
    }
    Promise.allSettled(requests)
      .then(results => {
        if (cancelled) return;
        const successful = results.filter(result => result.status === "fulfilled").map(result => result.value);
        setTasteTracks(mergeTasteTracks(successful, 18));
        if (!successful.length) {
          const failure = results.find(result => result.status === "rejected");
          setTasteError(failure?.reason?.message || "Your listening history could not be loaded.");
        }
      })
      .finally(() => { if (!cancelled) setTasteLoading(false); });
    return () => { cancelled = true; };
  }, [tasteProfiles, token]);

  useEffect(() => () => {
    localAudioRef.current?.pause();
    if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current);
  }, []);

  const applySpotifyAuth = useCallback((auth) => {
    setToken(auth.accessToken);
    setRefreshToken(auth.refreshToken || null);
    setTokenExpiresAt(auth.expiresAt);
    setClientId(auth.clientId);
    localStorage.setItem("sf_client_id", auth.clientId);
    try {
      sessionStorage.setItem(SPOTIFY_SESSION_KEY, JSON.stringify({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken || null,
        clientId: auth.clientId,
        expiresAt: auth.expiresAt,
      }));
    } catch {}
    postNativeMessage({
      type: "spotify-auth",
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken || null,
      clientId: auth.clientId,
      expiresAt: auth.expiresAt,
    });
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken || !clientId) return false;
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });
    if (!response.ok) throw new Error(`Spotify token refresh failed (${response.status})`);
    const data = await response.json();
    if (!data.access_token) throw new Error("Spotify token refresh returned no access token");
    applySpotifyAuth({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      clientId,
      expiresAt: Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000,
    });
    return true;
  }, [applySpotifyAuth, clientId, refreshToken]);

  useEffect(() => {
    if (!refreshToken || !clientId || !tokenExpiresAt) return;
    const delayMs = Math.max(15_000, tokenExpiresAt - Date.now() - 2 * 60 * 1000);
    const timer = setTimeout(() => {
      refreshAccessToken().catch(error => {
        reportSpotifyPlayback("token-refresh-error", { message: error?.message || String(error) });
        setTokenExpiresAt(Date.now() + 60_000);
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [clientId, refreshAccessToken, refreshToken, tokenExpiresAt]);

  // Poll Spotify player position for audio sync
  const pollAudioPosition = useCallback(async () => {
    if (localAudioRef.current) {
      if (!localAudioRef.current.paused) {
        audioSyncRef.current = reconcileTransportAnchor(
          audioSyncRef.current,
          localAudioRef.current.currentTime,
          performance.now(),
        );
      }
      return;
    }
    if (trackRef.current?.playbackProvider === "local") return;
    const player = playerRef.current;
    const sync = audioSyncRef.current;
    if (!player || sync.polling) return;
    const operationId = playbackOperationRef.current;
    const expectedUri = trackRef.current?.uri;
    sync.polling = true;
    try {
      const state = await player.getCurrentState();
      if (state) playbackStateRef.current = state;
      if (operationId !== playbackOperationRef.current || sync !== audioSyncRef.current) return;
      if (state && !state.paused && getPlaybackTrackUri(state) === expectedUri) {
        audioSyncRef.current = reconcileTransportAnchor(
          sync,
          state.position / 1000,
          performance.now(),
        );
      }
    } catch {} finally {
      sync.polling = false;
      if (operationId === playbackOperationRef.current) audioSyncRef.current.polling = false;
    }
  }, []);

  // Auto-pause on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && phaseRef.current === "playing") {
        playbackOperationRef.current += 1;
        setPaused(true);
        pausedRef.current = true;
        localAudioRef.current?.pause();
        if (playerRef.current) playerRef.current.pause();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const providerError = params.get("error");
    if (providerError) {
      setSpotifyAuthError(params.get("error_description") || `Spotify sign-in was not completed (${providerError}).`);
      setScreen("setup");
      history.replaceState({}, "", location.pathname);
      return;
    }
    if (!code) return;
    if (spotifyCodeExchangeRef.current === code) return;
    spotifyCodeExchangeRef.current = code;
    const verifier = sessionStorage.getItem("sf_v");
    const callbackClientId = sessionStorage.getItem("sf_cid");
    const redirectUri = sessionStorage.getItem("sf_redirect_uri") || getRedirectUri();
    if (!verifier || !callbackClientId) {
      setSpotifyAuthError("This Spotify login session expired. Start the connection again.");
      setScreen("setup");
      history.replaceState({}, "", location.pathname);
      return;
    }
    // Spotify authorization codes are single-use. Remove it from the address
    // before the request so React Strict Mode cannot redeem it a second time.
    history.replaceState({}, "", location.pathname);
    fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: callbackClientId, code_verifier: verifier }),
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.access_token) {
          throw new Error(data.error_description || data.error || `Spotify returned ${response.status}.`);
        }
        return data;
      })
      .then(data => {
        const expiresAt = Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000;
        applySpotifyAuth({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
          clientId: callbackClientId,
          expiresAt,
        });
        setSpotifyAuthError("");
        setScreen("menu");
        sessionStorage.removeItem("sf_v");
        sessionStorage.removeItem("sf_cid");
        sessionStorage.removeItem("sf_redirect_uri");
      })
      .catch(error => {
        const message = error?.message || "Spotify could not finish connecting.";
        setSpotifyAuthError(/invalid authorization code/i.test(message)
          ? "Spotify's one-time login code was already used or expired. Start the connection again."
          : message);
        setScreen("setup");
      });
  }, [applySpotifyAuth]);

  const login = async (customId) => {
    const activeClientId = (customId || clientId || configuredClientId || DEFAULT_SPOTIFY_CLIENT_ID).trim();
    if (!activeClientId) {
      setSpotifyAuthError("No Spotify Client ID configured.");
      return;
    }
    setSpotifyAuthError("");
    setClientId(activeClientId);
    localStorage.setItem("sf_client_id", activeClientId);
    const redirectUri = getRedirectUri();
    const { v, c } = await genPKCE();
    sessionStorage.setItem("sf_v", v);
    sessionStorage.setItem("sf_cid", activeClientId);
    sessionStorage.setItem("sf_redirect_uri", redirectUri);
    const p = new URLSearchParams({ client_id: activeClientId, response_type: "code", redirect_uri: redirectUri,
      scope: "playlist-read-private user-library-read streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-top-read user-read-currently-playing user-read-recently-played",
      code_challenge_method: "S256", code_challenge: c });
    location.href = `https://accounts.spotify.com/authorize?${p}`;
  };

  // Playback SDK
  useEffect(() => {
    if (!token) return;
    const init = () => { if (!window.Spotify || playerRef.current) return;
      const p = new window.Spotify.Player({ name: "Spotify Flappy", getOAuthToken: cb => cb(token), volume: 0.8 });
      p.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;
        reportSpotifyPlayback("ready", { deviceId: device_id });
      });
      p.addListener("not_ready", ({ device_id }) => {
        deviceIdRef.current = null;
        reportSpotifyPlayback("not-ready", { deviceId: device_id });
      });
      ["initialization_error", "authentication_error", "account_error", "playback_error"].forEach(eventName => {
        p.addListener(eventName, ({ message }) => {
          console.error(eventName, message);
          reportSpotifyPlayback("sdk-error", { eventName, message });
        });
      });
      p.addListener("autoplay_failed", () => {
        reportSpotifyPlayback("autoplay-failed");
      });
      p.addListener("player_state_changed", (state) => {
        if (!state) return;
        playbackStateRef.current = state;
        if (state.paused === lastPlaybackPausedRef.current) return;
        lastPlaybackPausedRef.current = state.paused;
        reportSpotifyPlayback(state.paused ? "paused" : "playing", {
          positionMs: state.position,
          trackUri: getPlaybackTrackUri(state),
        });
      });
      playerRef.current = p;
      p.connect()
        .then(connected => reportSpotifyPlayback(connected ? "connected" : "connect-failed"))
        .catch(error => reportSpotifyPlayback("connect-error", { message: error?.message || String(error) }));
    };
    window.onSpotifyWebPlaybackSDKReady = init;
    window.onSpotifyPlayerAPIReady = init;
    if (window.Spotify) init();
    return () => { if (playerRef.current) { playerRef.current.disconnect(); playerRef.current = null; } };
  }, [token]);

  const waitForPlaybackState = useCallback(async (player, predicate, operationId, timeoutMs = SPOTIFY_START_TIMEOUT_MS, pollIntervalMs = 150) => {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline && operationId === playbackOperationRef.current) {
      try {
        const state = await player.getCurrentState();
        if (operationId !== playbackOperationRef.current) return null;
        if (state) playbackStateRef.current = state;
        if (predicate(state)) return state;
      } catch {}
      await delay(pollIntervalMs);
    }
    return null;
  }, []);

  const preparePlay = useCallback(async (uri, operationId) => {
    const d = deviceIdRef.current;
    const player = playerRef.current;
    if (!token) {
      reportSpotifyPlayback("start-blocked", { reason: "missing-token" });
      return null;
    }
    if (!d || !player) {
      reportSpotifyPlayback("start-blocked", { reason: "player-not-ready" });
      return null;
    }

    try {
      const previousState = await player.getCurrentState();
      if (operationId !== playbackOperationRef.current) return null;
      if (previousState && !previousState.paused) {
        reportSpotifyPlayback("settling-previous-run", {
          positionMs: previousState.position,
          trackUri: getPlaybackTrackUri(previousState),
        });
        await player.pause();
        const pausedState = await waitForPlaybackState(
          player,
          state => Boolean(state?.paused),
          operationId,
          2500,
        );
        if (!pausedState && operationId === playbackOperationRef.current) {
          reportSpotifyPlayback("start-error", { message: "Previous playback did not pause in time." });
          return null;
        }
      }

      if (operationId !== playbackOperationRef.current) return null;
      reportSpotifyPlayback("prepared", { deviceId: d, trackUri: uri });
      return { operationId, uri, deviceId: d };
    } catch (error) {
      reportSpotifyPlayback("prepare-error", { message: error?.message || String(error) });
      return null;
    }
  }, [token, waitForPlaybackState]);

  const startPreparedPlay = useCallback(async ({ uri, operationId }) => {
    const player = playerRef.current;
    if (!player || operationId !== playbackOperationRef.current) return null;
    try {
      reportSpotifyPlayback("resuming-warmed-track", { trackUri: uri });
      await player.resume();
      let firstPlayingPosition = null;
      const startedState = await waitForPlaybackState(
        player,
        state => {
          if (!state || state.paused || getPlaybackTrackUri(state) !== uri || !Number.isFinite(state.position)) {
            firstPlayingPosition = null;
            return false;
          }
          if (firstPlayingPosition === null || state.position < firstPlayingPosition) {
            firstPlayingPosition = state.position;
          }
          return state.position - firstPlayingPosition >= SPOTIFY_START_ADVANCE_MS;
        },
        operationId,
        SPOTIFY_START_TIMEOUT_MS,
        50,
      );
      if (!startedState) {
        reportSpotifyPlayback("start-timeout", { trackUri: uri });
        return null;
      }
      reportSpotifyPlayback("synced", { positionMs: startedState.position, trackUri: uri });
      return startedState;
    } catch (error) {
      reportSpotifyPlayback("start-error", { message: error?.message || String(error) });
      return null;
    }
  }, [waitForPlaybackState]);

  // Force Spotify to fetch and decode the selected track before showing the
  // countdown. Starting playback only after the countdown makes a cold track
  // buffer during the first gameplay frames, which looks like a game reset.
  const warmPreparedPlay = useCallback(async ({ uri, operationId, deviceId }) => {
    const player = playerRef.current;
    const d = deviceId || deviceIdRef.current;
    if (!player || !token || !d || operationId !== playbackOperationRef.current) return false;

    try {
      const targetVol = Math.max(0, Math.min(1, Number(getSetting("musicVolume", 80)) / 100));
      const restoreVolume = () => typeof player.setVolume === "function"
        ? player.setVolume(targetVol).catch(() => {})
        : Promise.resolve();
      const stopWarmup = async () => {
        if (operationId !== playbackOperationRef.current) {
          await restoreVolume();
          return;
        }
        try { await player.pause(); } catch {}
        try { await player.seek(0); } catch {}
        await restoreVolume();
      };
      if (typeof player.setVolume === "function") await player.setVolume(0);
      if (operationId !== playbackOperationRef.current) {
        await restoreVolume();
        return false;
      }
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(d)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [uri], position_ms: 0 }),
      });
      if (!response.ok) {
        reportSpotifyPlayback("warmup-api-error", { statusCode: response.status });
        await stopWarmup();
        return false;
      }

      const warmedState = await waitForPlaybackState(
        player,
        state => Boolean(state && !state.paused && getPlaybackTrackUri(state) === uri && state.position >= SPOTIFY_WARMUP_POSITION_MS),
        operationId,
        SPOTIFY_WARMUP_TIMEOUT_MS,
      );
      if (!warmedState || operationId !== playbackOperationRef.current) {
        reportSpotifyPlayback("warmup-timeout", { trackUri: uri });
        await stopWarmup();
        return false;
      }

      await player.pause();
      if (operationId !== playbackOperationRef.current) {
        await restoreVolume();
        return false;
      }
      await player.seek(0);
      const resetState = await waitForPlaybackState(
        player,
        state => Boolean(state && state.paused && getPlaybackTrackUri(state) === uri && state.position <= 100),
        operationId,
        4000,
      );
      if (!resetState) {
        reportSpotifyPlayback("warmup-reset-timeout", { trackUri: uri });
        await stopWarmup();
        return false;
      }
      await restoreVolume();
      reportSpotifyPlayback("warmed", { trackUri: uri, bufferedPositionMs: warmedState.position });
      return true;
    } catch (error) {
      reportSpotifyPlayback("warmup-error", { message: error?.message || String(error) });
      if (operationId === playbackOperationRef.current) {
        try { await player.pause(); } catch {}
        try { await player.seek(0); } catch {}
      }
      const targetVol = Math.max(0, Math.min(1, Number(getSetting("musicVolume", 80)) / 100));
      if (typeof player.setVolume === "function") await player.setVolume(targetVol).catch(() => {});
      return false;
    }
  }, [token, waitForPlaybackState]);

  const prepareLocalPlay = useCallback(async (operationId) => {
    const source = trackRef.current?.localAudioUrl;
    if (!source || operationId !== playbackOperationRef.current) return null;
    let audio = localAudioRef.current;
    if (!audio || audio.dataset.source !== source) {
      try { audio?.pause(); } catch {}
      audio = new Audio(source);
      audio.preload = "auto";
      audio.dataset.source = source;
      localAudioRef.current = audio;
    }
    audio.muted = false;
    audio.volume = Math.max(0, Math.min(1, Number(getSetting("musicVolume", 80)) / 100));
    audio.currentTime = 0;
    if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      await new Promise((resolve) => {
        const cleanup = () => {
          audio.removeEventListener("canplay", onReady);
          audio.removeEventListener("error", onError);
          clearTimeout(timeoutId);
        };
        const onReady = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); resolve(); };
        const timeoutId = setTimeout(() => { cleanup(); resolve(); }, 10_000);
        audio.addEventListener("canplay", onReady, { once: true });
        audio.addEventListener("error", onError, { once: true });
        try { audio.load(); } catch {}
      });
    }
    if (operationId !== playbackOperationRef.current) return null;
    if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return null;
    return { provider: "local", operationId };
  }, []);

  const warmLocalPlay = useCallback(async (operationId) => {
    const audio = localAudioRef.current;
    if (!audio || operationId !== playbackOperationRef.current) return false;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = true;
      await audio.play();
      const deadline = performance.now() + 7000;
      while (audio.currentTime < 0.5 && performance.now() < deadline && operationId === playbackOperationRef.current) {
        await delay(40);
      }
      const warmed = audio.currentTime >= 0.5;
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      return warmed && operationId === playbackOperationRef.current;
    } catch (error) {
      try { audio.pause(); audio.currentTime = 0; audio.muted = false; } catch {}
      console.warn("[Local playback] warmup failed", error);
      return false;
    }
  }, []);

  const startPreparedLocalPlay = useCallback(async ({ operationId }) => {
    const audio = localAudioRef.current;
    if (!audio || operationId !== playbackOperationRef.current) return null;
    try {
      audio.muted = false;
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, Number(getSetting("musicVolume", 80)) / 100));
      await audio.play();
      return { position: (audio.currentTime || 0) * 1000, paused: audio.paused };
    } catch (error) {
      console.warn("[Local playback] start failed, attempting recovery", error);
      try {
        audio.muted = false;
        audio.currentTime = 0;
        await audio.play();
        return { position: (audio.currentTime || 0) * 1000, paused: audio.paused };
      } catch (retryError) {
        console.warn("[Local playback] retry also failed", retryError);
        return null;
      }
    }
  }, []);

  const resumePlay = useCallback(async () => {
    if (trackRef.current?.playbackProvider === "local") {
      const audio = localAudioRef.current;
      if (!audio) return null;
      try {
        await audio.play();
        return { position: audio.currentTime * 1000, paused: audio.paused };
      } catch {
        return null;
      }
    }
    const player = playerRef.current;
    if (!player) return null;
    const operationId = ++playbackOperationRef.current;
    const expectedUri = trackRef.current?.uri || null;
    try {
      reportSpotifyPlayback("resuming", { trackUri: expectedUri });
      await player.resume();
      const resumedState = await waitForPlaybackState(
        player,
        state => Boolean(state && !state.paused && (!expectedUri || getPlaybackTrackUri(state) === expectedUri)),
        operationId,
        6000,
      );
      if (!resumedState) {
        reportSpotifyPlayback("resume-timeout", { trackUri: expectedUri });
        return null;
      }
      reportSpotifyPlayback("resumed", {
        positionMs: resumedState.position,
        trackUri: getPlaybackTrackUri(resumedState),
      });
      return resumedState;
    } catch (error) {
      reportSpotifyPlayback("resume-error", { message: error?.message || String(error) });
      return null;
    }
  }, [waitForPlaybackState]);

  const pausePlay = useCallback(async () => {
    const operationId = ++playbackOperationRef.current;
    stopSynthesizedBackingTrack();
    if (localAudioRef.current) {
      try { localAudioRef.current.pause(); } catch {}
    }
    const player = playerRef.current;
    if (!player) return true;
    try {
      reportSpotifyPlayback("pausing");
      await player.pause();
      let pausedState = await waitForPlaybackState(
        player,
        state => Boolean(state?.paused),
        operationId,
        2500,
      );

      // A disconnected/inactive device reports null and is already safe. If a
      // live state is still playing, retry once and require confirmation.
      if (!pausedState) {
        const latestState = await player.getCurrentState();
        if (!latestState) {
          reportSpotifyPlayback("paused-confirmed", { stateAvailable: false });
          return true;
        }
        if (!latestState.paused) {
          await player.pause();
          pausedState = await waitForPlaybackState(
            player,
            state => Boolean(state?.paused),
            operationId,
            2500,
          );
        } else {
          pausedState = latestState;
        }
      }

      if (!pausedState) {
        reportSpotifyPlayback("pause-timeout");
        return false;
      }
      reportSpotifyPlayback("paused-confirmed", {
        positionMs: pausedState.position,
        trackUri: getPlaybackTrackUri(pausedState),
      });
      return true;
    } catch (error) {
      reportSpotifyPlayback("pause-error", { message: error?.message || String(error) });
      return false;
    }
  }, [waitForPlaybackState]);

  const beginLaunch = useCallback(() => {
    const pendingGame = gsRef.current;
    const provider = trackRef.current?.playbackProvider === "local" ? "local" : "spotify";
    const uri = trackRef.current?.uri;
    const localSource = trackRef.current?.localAudioUrl;
    if (!pendingGame || (provider === "local" ? !localSource : !uri)) {
      if (pendingGame) {
        pendingGame.syncMessage = "TRACK UNAVAILABLE";
        pendingGame.syncDetail = "TAP TO RETRY";
      }
      setPhase("sync-error");
      return;
    }

    const player = provider === "spotify" ? playerRef.current : null;
    if (provider === "spotify" && localAudioRef.current) {
      try { localAudioRef.current.pause(); } catch {}
      localAudioRef.current = null;
    }
    const operationId = ++playbackOperationRef.current;
    pendingGame.syncMessage = "PREPARING AUDIO";
    pendingGame.syncDetail = provider === "local" ? "BUFFERING LOCAL AUDIO…" : "CONNECTING TO SPOTIFY…";
    setPhase("syncing");

    // Activate media element immediately within user gesture
    if (player?.activateElement) {
      player.activateElement().catch(() => {});
    }

    void (async () => {
      let startedState = null;
      let playbackConfirmedAt = 0;
      const isCurrent = () => gsRef.current === pendingGame && operationId === playbackOperationRef.current;
      const runCountdown = async (startPlayback, leadMs = 0) => {
        const countdownStartedAt = performance.now();
        pendingGame.countdownStartedAt = countdownStartedAt;
        pendingGame.countdownElapsedMs = 0;
        pendingGame.countdownProgress = 0;
        pendingGame.countdownLastBeat = -1;
        pendingGame.countdownHolding = false;
        pendingGame.audioStartOffset = 0;
        pendingGame.visualStartTime = countdownStartedAt;
        pendingGame.lastT = countdownStartedAt;
        setPhase("countdown");
        await delay(MIN_COUNTDOWN_MS - leadMs);
        if (!isCurrent()) return null;
        const playback = startPlayback().then(state => {
          if (state && !state.paused) playbackConfirmedAt = performance.now();
          return state;
        });
        const remainingMs = MIN_COUNTDOWN_MS - (performance.now() - countdownStartedAt);
        if (remainingMs > 0) await delay(remainingMs);
        return playback;
      };

      if (provider === "local") {
        const prepared = await prepareLocalPlay(operationId);
        if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;
        if (!prepared) {
          pendingGame.syncMessage = "LOCAL AUDIO UNAVAILABLE";
          pendingGame.syncDetail = "CHECK THE FILE AND TAP TO RETRY";
          setPhase("sync-error");
          return;
        }

        pendingGame.syncMessage = "PREPARING LOCAL AUDIO";
        pendingGame.syncDetail = "CHECKING PLAYBACK BEFORE THE RUN…";
        if (!(await warmLocalPlay(operationId))) {
          if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;
          pendingGame.syncMessage = "LOCAL AUDIO ISN'T READY YET";
          pendingGame.syncDetail = "CHECK THE FILE AND TAP TO RETRY";
          setPhase("sync-error");
          return;
        }

        startedState = await runCountdown(() => startPreparedLocalPlay({ operationId }));
        if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;
        if (!startedState || startedState.paused) {
          pendingGame.syncMessage = "LOCAL AUDIO DIDN'T START";
          pendingGame.syncDetail = "TAP TO RETRY PLAYBACK";
          setPhase("sync-error");
          return;
        }
      } else {
        const prepared = await preparePlay(uri, operationId);
        if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;
        if (prepared) {
          pendingGame.syncMessage = "BUFFERING YOUR TRACK";
          pendingGame.syncDetail = "FIRST PLAY CAN TAKE A MOMENT…";
        }

        const trackWarmed = prepared ? await warmPreparedPlay(prepared) : false;
        if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;
        if (!trackWarmed) {
          pendingGame.syncMessage = "TRACK ISN'T READY YET";
          pendingGame.syncDetail = "CHECK SPOTIFY CONNECTION AND TAP TO RETRY";
          setPhase("sync-error");
          return;
        }

        startedState = await runCountdown(() => startPreparedPlay(prepared), SPOTIFY_COUNTDOWN_LEAD_MS);

        if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;

        // A playable preview can recover from a Spotify SDK start failure.
        if (!startedState) {
          try { await playerRef.current?.pause(); } catch {}
          if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;
          if (trackRef.current?.preview_url) {
            try {
              const previewAudio = new Audio(trackRef.current.preview_url);
              previewAudio.volume = Math.max(0, Math.min(1, Number(getSetting("musicVolume", 80)) / 100));
              await previewAudio.play();
              if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) {
                previewAudio.pause();
                return;
              }
              localAudioRef.current = previewAudio;
              startedState = { position: previewAudio.currentTime * 1000, paused: previewAudio.paused };
            } catch (err) {
              console.warn("[beginLaunch] preview playback failed:", err);
            }
          }
          if (!startedState) {
            pendingGame.syncMessage = "SPOTIFY AUDIO DIDN'T START";
            pendingGame.syncDetail = playerRef.current ? "TAP TO RETRY PLAYBACK" : "CONNECT SPOTIFY AND TAP TO RETRY";
            setPhase("sync-error");
            return;
          }
        }
      }

      if (gsRef.current !== pendingGame || operationId !== playbackOperationRef.current) return;
      const positionSeconds = (startedState?.position || 0) / 1000;
      const now = performance.now();
      audioSyncRef.current = {
        lastPollTime: playbackConfirmedAt || now,
        lastPosition: positionSeconds,
        polling: false,
      };
      pendingGame.gt = Math.max(0, projectTransportPosition(audioSyncRef.current, now) - calibrationRef.current);
      pendingGame.goStartedAt = now;
      pendingGame.lastT = now;
      pendingGame.bird.vy = 0;
      pendingGame.musicPaused = false;
      setPhase("playing");
    })();
  }, [prepareLocalPlay, preparePlay, setPhase, startPreparedLocalPlay, startPreparedPlay, warmLocalPlay, warmPreparedPlay]);

  const pickTrack = async (t, context = null) => {
    playbackOperationRef.current += 1;
    if (trackRef.current?.playbackProvider === "local" && trackRef.current?.id !== t.id) {
      localAudioRef.current?.pause();
    }
    const isLocalTrack = t.playbackProvider === "local";
    runContextRef.current = context?.journeyId ? context : null;
    setRunReward(null);
    setNextJourneyTrack(null);
    setChartAnalysis(null);
    chartAnalysisRef.current = null;
    setTrack(t); trackRef.current = t; songDurRef.current = (t.duration_ms || 210000) / 1000;
    recordDailyListeningTrack(t);
    const savedBestScore = getScorePoints(getBestScore(t.id)) ?? 0;
    bestRef.current = savedBestScore;
    setBest(savedBestScore);
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

      // ── Strategy: Full local file → preview → Spotify data → synthetic ──
      // Local files are analyzed across their complete duration.
      // Catalog tracks use whatever lightweight timing data is available.
      // Priority 2: Try Spotify audio-analysis API (likely 403 since Nov 2024)
      // Priority 3: Pure synthetic generation from estimated BPM

      let f = null;  // features
      let a = null;  // analysis
      let analysisDetails = null;

      if (isLocalTrack && t.localAudioUrl) {
        setLoadMsg("Mapping the complete audio file...");
        try {
          const result = await analyzeLocalAudio(t.localAudioUrl, fullDur);
          if (result.analysis?.meta?.method !== "full_track_analysis" || result.analysis.beats.length < 5) {
            throw new Error("The complete file could not be decoded for analysis.");
          }
          f = result.features;
          a = result.analysis;
          analysisDetails = {
            source: "local-full-track",
            label: "FULL AUDIO MAP",
            detail: "Tempo, onsets, energy, and section changes were detected across your complete local file",
            trackDerived: true,
            fidelity: "full",
          };
        } catch (localError) {
          console.warn("[audioAnalyzer] Local analysis failed:", localError.message);
        }
      } else if (t.preview_url) {
        // Try preview URL analysis first (works regardless of Spotify API status)
        setLoadMsg("Detecting beats from audio...");
        try {
          const result = await analyzePreview(t.preview_url, fullDur);
          f = result.features;
          a = result.analysis;
          const previewDetectedBeats = result.analysis?.meta?.method === "preview_analysis";
          analysisDetails = {
            source: previewDetectedBeats ? "preview-analysis" : "preview-estimate",
            label: previewDetectedBeats ? "PREVIEW-DERIVED MAP" : "PREVIEW-ESTIMATED MAP",
            detail: previewDetectedBeats
              ? "Beat timing detected from the available preview and extrapolated across the song"
              : "Tempo estimated from the available preview; beat timing is generated",
            trackDerived: true,
          };
          console.log(`[audioAnalyzer] BPM: ${f.tempo}, beats: ${a.beats.length}, method: ${a.meta?.method}`);
        } catch (previewErr) {
          console.warn("[audioAnalyzer] Preview analysis failed:", previewErr.message);
        }
      }

      // Fallback: try Spotify API (may return 403 since deprecation)
      if (!a && token && !isLocalTrack) {
        setLoadMsg("Fetching audio data...");
        try {
          const [fr, ar] = await Promise.all([
            fetch(`https://api.spotify.com/v1/audio-features/${t.id}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`https://api.spotify.com/v1/audio-analysis/${t.id}`, { headers: { Authorization: `Bearer ${token}` } })]);

          if (!f && fr.ok) {
            const fData = await fr.json();
            if (fData && !fData.error) {
              f = fData;
              analysisDetails = {
                source: "spotify-features",
                label: "TEMPO-GUIDED MAP",
                detail: "Spotify supplied tempo and energy; beat timing is generated",
                trackDerived: true,
              };
            }
          }
          if (ar.ok) {
            const aData = await ar.json();
            if (aData && !aData.error && aData.beats && aData.beats.length > 0) {
              a = aData;
              analysisDetails = {
                source: "spotify-analysis",
                label: "FULL-TRACK RHYTHM MAP",
                detail: "Spotify supplied the track's beat, bar, and section timing",
                trackDerived: true,
              };
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
        if (!analysisDetails) {
          analysisDetails = {
            source: "synthetic",
            label: t.discoverySource ? "TASTE-GUIDED MAP" : "ESTIMATED RHYTHM MAP",
            detail: t.discoverySource
              ? `${t.discoverySource} selected this track; timing is generated while Spotify handles playback`
              : "Track-level timing data was unavailable; this run uses a generated chart",
            trackDerived: false,
            fidelity: "estimated",
          };
        }
      }

      setFeatures(f); featRef.current = f;
      anaRef.current = a;
      chartAnalysisRef.current = analysisDetails;
      setChartAnalysis(analysisDetails);
      setLoadMsg("Building level...");

      // Compute and cache difficulty rating
      const diffRating = computeDifficultyRating(f, a);
      diffRatingRef.current = diffRating;
    } catch (err) {
      console.error("[pickTrack] All analysis paths failed:", err);
      const fallbackFeatures = { tempo: 120, energy: 0.7, key: 7, danceability: 0.5 };
      setFeatures(fallbackFeatures);
      featRef.current = fallbackFeatures;
      anaRef.current = generateSyntheticAnalysis(120, songDurRef.current || 210);
      const fallbackDetails = {
        source: "synthetic",
        label: "ESTIMATED RHYTHM MAP",
        detail: "Track-level timing data was unavailable; this run uses a generated chart",
        trackDerived: false,
      };
      chartAnalysisRef.current = fallbackDetails;
      setChartAnalysis(fallbackDetails);
    }
    if (t.album?.images?.[0]?.url) await new Promise(res => { const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { const p = extractPalette(img); setPalette(p); palRef.current = p; res(); }; img.onerror = res; img.src = t.album.images[0].url; });
    comboRef.current = 0; setScore(0); setCombo(0); setPhase("idle");
    trackKeyRef.current += 1; // force GameScreen to remount pre-game
    setPaused(false); pausedRef.current = false;
    setScreen("game");
  };

  const handleLocalUpload = async (file) => {
    setHomeNotice("");
    const looksLikeAudio = file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
    if (!looksLikeAudio) {
      setHomeNotice("Choose an audio file such as MP3, WAV, M4A, AAC, OGG, or FLAC.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setHomeNotice("That file is over the 100 MB private-test limit.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setScreen("loading");
    setLoadMsg("Reading your local file...");
    try {
      const duration = await readAudioDuration(objectUrl);
      setLoadMsg("Matching track details and artwork...");
      const metadata = await enrichLocalTrackMetadata(file, tasteProfiles, {
        spotifyToken: token,
        durationMs: Math.round(duration * 1000),
      });
      if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current);
      localObjectUrlRef.current = objectUrl;
      const trackObject = {
        id: makeLocalTrackId(file),
        name: metadata.title,
        artists: [{ name: metadata.artist || "Local file" }],
        album: {
          name: metadata.album || "Local upload",
          images: metadata.image ? [{ url: metadata.image }, { url: metadata.image }, { url: metadata.image }] : [],
        },
        duration_ms: Math.round(duration * 1000),
        playbackProvider: "local",
        localAudioUrl: objectUrl,
        localFileName: file.name,
        metadataSource: metadata.matchSource || "Filename",
      };
      saveImportedTrack(trackObject);
      await pickTrack(trackObject, { source: "local" });
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      setHomeNotice(error?.message || "This audio file could not be opened.");
      setScreen("menu");
    }
  };

  const handleTasteSave = useCallback((profiles) => {
    const saved = saveTasteProfiles(profiles);
    setTasteProfiles(saved);
    setHomeNotice("Taste sources saved.");
    setScreen("menu");
  }, []);

  const handleTasteTrack = async (tasteTrack) => {
    setHomeNotice("");
    if (!token) {
      setHomeNotice("Connect Spotify before playing a track from your taste shelf. Local uploads work without it.");
      setScreen("setup");
      return;
    }
    setScreen("loading");
    setLoadMsg(`Matching ${tasteTrack.title} in Spotify...`);
    const resolved = await resolveTasteTrackToSpotify(token, tasteTrack);
    if (!resolved) {
      setHomeNotice(`Spotify could not find a reliable match for “${tasteTrack.title}”.`);
      setScreen("menu");
      return;
    }
    await pickTrack(resolved, { source: "taste", discoverySource: resolved.discoverySource });
  };

  // Navigation handler for menu
  const handleNavigate = useCallback((target) => {
    setScreen(target);
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setRefreshToken(null);
    setTokenExpiresAt(0);
    setUserProfile(null);
    setScreen("menu");
    sessionStorage.removeItem("sf_v");
    sessionStorage.removeItem("sf_cid");
    sessionStorage.removeItem(SPOTIFY_SESSION_KEY);
    postNativeMessage({ type: "spotify-logout" });
  }, []);

  // Init game
  const initGame = useCallback(() => {
    const f = featRef.current || { tempo: 120, energy: 0.7, key: 7 };
    const bpm = Math.max(50, f.tempo || 120), energy = f.energy ?? 0.7, dm = DIFF[diffRef.current] || DIFF.normal;
    const gap = BASE_GAP * (1.25 - energy * 0.45) * dm.gapM;

    // Build rhythm-driven pipe schedule from audio analysis
    const pipeData = buildPipeSchedule(anaRef.current, f, diffRef.current, dm, BASE_GAP);
    const { schedule: pipeSchedule, sections, bars, beats, barStarts, beatDots, trailDots } = pipeData;
    const speed = pipeData.speed || BASE_SPEED * dm.spdM;
    const rhythmPhysics = pipeData.physics || { gravity: GRAVITY, flapVelocity: FLAP_VEL, maxUpVelocity: MAX_UP_VEL };

    const drops = []; for (let i = 1; i < sections.length; i++) { if (sections[i].loudness - sections[i - 1].loudness > 3 || i === 1) drops.push(sections[i].start); }
    const dur = songDurRef.current;
    const beatDuration = 60 / bpm;


    gsRef.current = {
      bird: { x: PLAYER_X, y: H / 2, vy: 0, angle: 0, pulse: 0, trail: [] }, pipes: [], particles: [], shockwaves: [], floats: [],
      stars: Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 90), r: .4 + Math.random() * 1.6, speed: .1 + Math.random() * .4, tw: Math.random() * Math.PI * 2 })),
      par: [{ pts: Array.from({ length: 12 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 100), r: 1 + Math.random() * 2 })), spd: .15 },
        { pts: Array.from({ length: 8 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 100), r: 2 + Math.random() * 3 })), spd: .35 },
        { pts: Array.from({ length: 5 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 100), r: 3 + Math.random() * 4 })), spd: .6 }],
      combo: 0, maxCombo: 0, totalPipes: 0, nearMisses: 0,
      pipePerfects: 0, pipeGreats: 0, pipeGoods: 0,
      // Beat-accuracy scoring (PRIMARY scoring system)
      beatTaps: 0, onBeatTaps: 0, closeBeatTaps: 0, totalScore: 0,
      rhythmPerfects: 0, rhythmGreats: 0, rhythmGoods: 0, rhythmMisses: 0, rhythmExtraTaps: 0,
      // Rhythm streak (consecutive dots collected — primary engagement metric)
      rhythmStreak: 0, maxRhythmStreak: 0, dotsMissed: 0, dotsCollected: 0, totalDots: 0,
      speed, baseSpeed: speed, gap, baseGap: gap,
      gravity: rhythmPhysics.gravity,
      flapVelocity: rhythmPhysics.flapVelocity,
      maxUpVelocity: rhythmPhysics.maxUpVelocity,
      pulseDuration: pipeData.pulseDuration || beatDuration,
      approachTime: pipeData.approachTime || 1.9,
      timingWindows: pipeData.timingWindows || { perfect: 0.075, great: 0.14, good: 0.21 },
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
      countdownBeats: 3,
      countdownDurationMs: MIN_COUNTDOWN_MS,
      countdownStartedAt: 0,
      countdownElapsedMs: 0,
      countdownProgress: 0,
      countdownLastBeat: -1,
      beatDuration,
      bpm,
      // Visual pulse state
      kickPulse: 0,
      offBeatFlash: 0,
      chromaFlash: 0,
      // Overdrive (5 consecutive perfects)
      perfectStreak: 0,
      // Drop sequence
      dropReadyTimer: 0,
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
      runFinalized: false,
    };
    audioSyncRef.current = { lastPollTime: 0, lastPosition: 0, polling: false };
  }, []);

  const restartRun = useCallback(() => {
    playbackOperationRef.current += 1;
    initGame();
    comboRef.current = 0;
    setScore(0);
    setCombo(0);
    setRunReward(null);
    setPaused(false);
    pausedRef.current = false;
    void unlockGameAudio();
    beginLaunch();
  }, [beginLaunch, initGame]);

  // Pause / resume
  const togglePause = useCallback(async () => {
    if (phaseRef.current !== "playing") return;
    if (pausedRef.current) {
      if (resumePendingRef.current) return;
      resumePendingRef.current = true;
      setResumePending(true);
      setPauseFeedback(trackRef.current?.playbackProvider === "local" ? "SYNCING LOCAL AUDIO…" : "SYNCING SPOTIFY…");
      const resumedState = await resumePlay();
      if (resumedState) {
        const now = performance.now();
        audioSyncRef.current = {
          lastPollTime: now,
          lastPosition: resumedState.position / 1000,
          polling: false,
        };
        if (gsRef.current) {
          gsRef.current.lastT = now;
          gsRef.current.musicPaused = false;
        }
        setPauseFeedback("");
        setPaused(false);
        pausedRef.current = false;
      } else {
        setPauseFeedback(`${trackRef.current?.playbackProvider === "local" ? "AUDIO" : "SPOTIFY"} ISN'T READY — TAP RESUME TO RETRY`);
      }
      resumePendingRef.current = false;
      setResumePending(false);
    } else {
      setPauseFeedback("");
      setPaused(true);
      pausedRef.current = true;
      if (gsRef.current) gsRef.current.musicPaused = true;
      await pausePlay();
    }
  }, [resumePlay, pausePlay]);

  // Flap
  const flap = useCallback(() => {
    const p = phaseRef.current, f = featRef.current || { key: 7 };
    if (pausedRef.current) return;

    if (p === "idle" || p === "sync-error") {
      if (p === "idle" && !isAudioReady) return;
      if (p === "sync-error") initGame();
      void unlockGameAudio();
      beginLaunch();
    }
    else if (p === "countdown") {
      // no sound during countdown
    }
    else if (p === "playing") {
      const now = performance.now();
      if (now - lastFlapTimeRef.current < TAP_COOLDOWN) return;
      lastFlapTimeRef.current = now;
      if (gsRef.current) {
        gsRef.current.bird.vy = gsRef.current.flapVelocity ?? FLAP_VEL;
        gsRef.current.bird.pulse = 1;

        // Short tactile-looking burst so every accepted tap reads immediately.
        gsRef.current.shockwaves.push({ x: gsRef.current.bird.x, y: gsRef.current.bird.y, r: 8, life: 0.42 });
        for (let i = 0; i < 4; i++) {
          gsRef.current.particles.push({
            x: gsRef.current.bird.x - BIRD_R,
            y: gsRef.current.bird.y + (Math.random() - 0.5) * BIRD_R,
            vx: -1.5 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 0.35,
            size: 1.5 + Math.random() * 1.5,
          });
        }

        // ── Beat Dot Checkpoint Collection on Tap ──────────────
        const g = gsRef.current;
        if (g.beatDots && g.beatDots.length > 0 && g.speed > 0) {
          const spd = g.speed;

          // Find the nearest uncollected musical target by time. Rhythm
          // judgment stays consistent even when visual approach speed changes.
          let bestDot = null;
          let bestIdx = -1;
          let minTimeError = Infinity;

          for (let i = 0; i < g.beatDots.length; i++) {
            if (g._collectedDots.has(i) || g._missedDots.has(i)) continue;
            const d = g.beatDots[i];
            const timeError = Math.abs(d.time - g.gt);
            if (d.time < g.gt - 0.5) continue;
            if (d.time > g.gt + 0.5) break;
            if (timeError < minTimeError) { minTimeError = timeError; bestDot = d; bestIdx = i; }
          }

          g.beatTaps++;
          const windows = g.timingWindows || { perfect: 0.075, great: 0.14, good: 0.21 };
          const verticalRadius = diffRef.current === "easy" ? 66 : diffRef.current === "hard" ? 46 : 56;
          const verticalOffset = bestDot ? Math.abs(g.bird.y - bestDot.y) : Infinity;
          if (bestDot && minTimeError <= windows.good && verticalOffset < verticalRadius) {
            g._collectedDots.add(bestIdx);
            g._flashingDots[bestIdx] = 0.5; // 0.5s flash animation
            g.beatShield = Math.max(0.28, Math.min(0.5, g.pulseDuration * 0.65));
            g.dotsCollected++;
            g.bird.vy = bestDot.flapVelocity ?? g.flapVelocity ?? FLAP_VEL;

            const fx = eventXAt(bestDot.time, g.gt, spd, g.bird.x);

            // Rhythm streak grows with each collection
            g.rhythmStreak++;
            if (g.rhythmStreak > g.maxRhythmStreak) g.maxRhythmStreak = g.rhythmStreak;

            if (minTimeError <= windows.perfect) {
              // PERFECT — bird is right on top of the dot
              g.onBeatTaps++;
              g.rhythmPerfects++;
              g.perfectStreak++;
              const label = `PERFECT +${RHYTHM_POINTS.perfect}${g.perfectStreak >= 5 ? " ★" : ""}`;
              g.floats.push({ x: fx, y: bestDot.y - 25, text: label, color: "#FFD700", life: 0.8, size: 14 });
              g.bird.pulse = 1.5;
              g.beatFlash = Math.max(g.beatFlash, 0.8);
              // Gold particle burst
              for (let pi = 0; pi < 12; pi++) {
                const a = (pi / 12) * Math.PI * 2, sp = 2 + Math.random() * 3;
                g.particles.push({ x: fx, y: bestDot.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, size: 2 + Math.random() * 2, color: "#FFD700" });
              }
            } else if (minTimeError <= windows.great) {
              // GREAT — bird is very close to the dot
              g.closeBeatTaps++;
              g.rhythmGreats++;
              g.perfectStreak = 0;
              g.floats.push({ x: fx, y: bestDot.y - 25, text: `GREAT +${RHYTHM_POINTS.great}`, color: "#4ade80", life: 0.6, size: 11 });
              g.beatFlash = Math.max(g.beatFlash, 0.4);
            } else {
              // GOOD — bird is near the dot (tapped slightly early/late)
              g.rhythmGoods++;
              g.perfectStreak = 0;
              g.floats.push({ x: fx, y: bestDot.y - 25, text: `GOOD +${RHYTHM_POINTS.good}`, color: "#a0aec0", life: 0.5, size: 9 });
            }
          } else {
            // Off-pulse inputs remain valid emergency flaps, but the feedback
            // distinguishes timing mistakes from leaving the authored path.
            g.rhythmExtraTaps++;
            g.rhythmStreak = 0;
            g.perfectStreak = 0;
            const feedback = bestDot && minTimeError <= windows.good ? "OFF PATH" : "EXTRA";
            g.floats.push({ x: g.bird.x, y: g.bird.y - 25, text: feedback, color: "#ff6680", life: 0.45, size: 9 });
          }
        }
      }
    }
    else if (p === "dead") {
      restartRun();
    }
  }, [beginLaunch, initGame, isAudioReady, restartRun, setPhase]);

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
    let frameId = 0;
    let cancelled = false;
    const activeSprite = getActiveSprite();

    const finalizeRun = (g, outcome) => {
      if (g.runFinalized) return;
      g.runFinalized = true;
      const cleared = outcome === "completed";
      if (cleared) g.gt = g.songDur;
      g.musicPaused = true;
      void pausePlay();
      if (!cleared) playDeath();

      const songProgress = calculateSongProgress(g);
      const rhythmAccuracy = calculateRhythmAccuracy(g);
      const flightAccuracy = calculateFlightAccuracy(g);
      const totalScore = calculateTotalScore(g);
      const rating = calculateRating(g, cleared);
      g.totalScore = totalScore;
      g.rhythmAccuracy = rhythmAccuracy;
      g.flightAccuracy = flightAccuracy;
      g.rating = rating;
      g.cleared = cleared;
      g.isNewBest = totalScore > bestRef.current;
      if (g.isNewBest) {
        bestRef.current = totalScore;
        setBest(totalScore);
      }

      const selectedTrack = trackRef.current;
      if (selectedTrack) {
        const difficultyRating = diffRatingRef.current;
        const isLocalTrack = selectedTrack.playbackProvider === "local";
        const persistentAlbum = isLocalTrack ? {
          ...selectedTrack.album,
          images: (selectedTrack.album?.images || []).filter(image => !image?.url?.startsWith("data:")),
        } : selectedTrack.album;
        const persistentTrack = isLocalTrack ? {
          id: selectedTrack.id,
          name: selectedTrack.name,
          artists: selectedTrack.artists,
          album: persistentAlbum,
          duration_ms: selectedTrack.duration_ms,
          playbackProvider: "local",
          localUnavailable: true,
        } : selectedTrack;
        const persistentAlbumArt = persistentAlbum?.images?.[1]?.url || persistentAlbum?.images?.[0]?.url;
        const scoreData = {
          pipesCleared: g.totalPipes,
          totalScore,
          accuracy: rhythmAccuracy,
          rhythmAccuracy,
          flightAccuracy,
          rating,
          cleared,
          outcome,
          maxCombo: g.maxCombo,
          perfects: g.rhythmPerfects,
          greats: g.rhythmGreats,
          goods: g.rhythmGoods,
          rhythmPerfects: g.rhythmPerfects,
          rhythmGreats: g.rhythmGreats,
          rhythmGoods: g.rhythmGoods,
          rhythmMisses: g.rhythmMisses,
          rhythmExtraTaps: g.rhythmExtraTaps,
          pipePerfects: g.pipePerfects,
          pipeGreats: g.pipeGreats,
          pipeGoods: g.pipeGoods,
          nearMisses: g.nearMisses,
          rhythmScore: calculateRhythmPoints(g),
          rhythmStreak: g.maxRhythmStreak,
          dotsCollected: g.dotsCollected,
          dotsMissed: g.dotsMissed,
          onBeatTaps: g.onBeatTaps,
          beatTaps: g.beatTaps,
          songPct: songProgress,
          difficulty: diffRef.current,
          difficultyStars: difficultyRating?.stars || null,
          chartSource: chartAnalysisRef.current?.source || "unknown",
          chartTrackDerived: Boolean(chartAnalysisRef.current?.trackDerived),
          trackName: selectedTrack.name,
          artistName: selectedTrack.artists?.map(artist => artist.name).join(", "),
          albumArt: persistentAlbumArt,
          trackObj: persistentTrack,
        };
        saveScore(selectedTrack.id, scoreData);
        saveLastPlayed({
          trackId: selectedTrack.id,
          trackName: selectedTrack.name,
          artistName: selectedTrack.artists?.map(artist => artist.name).join(", "),
          albumArt: persistentAlbumArt,
          totalScore,
          rating,
          cleared,
          songPct: songProgress,
          trackObj: persistentTrack,
          difficultyStars: difficultyRating?.stars || null,
        });
        const reward = recordRunProgression(selectedTrack.id, {
          cleared,
          totalScore,
          rhythmAccuracy,
          flightAccuracy,
          rating,
          track: {
            id: selectedTrack.id,
            name: selectedTrack.name,
            artists: selectedTrack.artists,
            album: persistentAlbum,
          },
        }, runContextRef.current?.journeyId || null);
        g.masteryStars = reward.mastery?.bestStars || 0;
        g.runReward = reward;
        setRunReward(reward);
        setNextJourneyTrack(reward.nextTrack || null);
      }

      setPhase(outcome);
    };

    const tick = (now) => {
      if (cancelled || !aliveRef.current) return;
      const g = gsRef.current; if (!g) { frameId = requestAnimationFrame(tick); return; }

      if (pausedRef.current) {
        drawGame(ctx, g, palRef.current, featRef.current || { tempo: 120, energy: 0.7, key: 7 }, phaseRef.current, bestRef, true, activeSprite, albumImgRef.current);
        frameId = requestAnimationFrame(tick);
        return;
      }

      const cp = phaseRef.current;
      if (cp === "syncing") {
        // Keep the scene still until playback is confirmed; otherwise the bird
        // and obstacles advance while the audio clock is waiting to start.
        g.lastT = now;
        drawGame(ctx, g, palRef.current, featRef.current || { tempo: 120, energy: 0.7, key: 7 }, cp, bestRef, false, activeSprite, albumImgRef.current);
        frameId = requestAnimationFrame(tick);
        return;
      }

      if (!g.lastT) g.lastT = now;
      const rawDt = now - g.lastT; g.lastT = now;
      const dt = Math.min(rawDt, 50) / TDT;
      const pal = palRef.current, f = featRef.current || { tempo: 120, energy: 0.7, key: 7 };
      const tm = g.slowMo > 0 ? 0.15 : 1.0, adt = dt * tm;

      if (cp === "playing" && !g.musicPaused) {
        audioPollTimer += rawDt;
        if (audioPollTimer >= 200) {
          audioPollTimer = 0;
          pollAudioPosition();
        }
        const sync = audioSyncRef.current;
        if (sync.lastPollTime > 0) {
          const target = projectTransportPosition(sync, now) - calibrationRef.current - (g.audioStartOffset || 0);
          g.gt = advanceTransportPosition(g.gt, target, Math.min(rawDt, 50) / 1000);
        } else {
          g.gt = Math.max(0, g.gt + (rawDt / 1000) * tm);
        }
      }

      if (shouldCompleteRun(cp, g.gt, g.songDur, g.runFinalized)) {
        finalizeRun(g, "completed");
        drawGame(ctx, g, pal, f, "completed", bestRef, false, activeSprite, albumImgRef.current);
        frameId = requestAnimationFrame(tick);
        return;
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
        const countdown = getCountdownState(
          g.countdownStartedAt,
          now,
          g.countdownDurationMs,
        );
        g.countdownElapsedMs = countdown.elapsedMs;
        g.countdownProgress = countdown.progress * g.countdownBeats;
        const currentBeat = Math.floor(g.countdownProgress);
        if (currentBeat > g.countdownLastBeat && currentBeat < g.countdownBeats) {
          g.countdownLastBeat = currentBeat;
          playMetronome();
        }
        g.countdownHolding = countdown.holding;
        drawGame(ctx, g, pal, f, cp, bestRef, false, activeSprite, albumImgRef.current);
        frameId = requestAnimationFrame(tick);
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
        g.bird.vy += (g.gravity ?? GRAVITY) * adt; g.bird.y += g.bird.vy * adt;
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
              x: entry.hitTime != null ? eventXAt(entry.hitTime, g.gt, g.speed, g.bird.x) : W + 24,
              gy, gap: pipeGap, passed: false, graded: false, beatGlow: 0,
              beatType: entry.beatType, isDownbeat: entry.isDownbeat,
              spawnTime: entry.time, hitTime: entry.hitTime,
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

        // One constant world speed keeps timestamped dots and incremental pipes
        // in the same coordinate system. Opening difficulty comes from gap size.
        const curSpeed = g.speed;

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
            const tdX = eventXAt(td.time, g.gt, tSpd, g.bird.x);
            if (tdX > W + 60) break;     // not on screen yet
            if (tdX < -60) continue;     // already scrolled off
            const dx = Math.abs(g.bird.x - tdX);
            const dy = Math.abs(g.bird.y - td.y);
            if (dx < 28 && dy < 34) {
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
          const missThreshold = g.gt - (g.timingWindows?.good || 0.21);
          while (g._lastCheckedDotIdx < g.beatDots.length) {
            const dot = g.beatDots[g._lastCheckedDotIdx];
            if (dot.time > missThreshold) break; // haven't passed this dot yet
            if (!g._collectedDots.has(g._lastCheckedDotIdx) && !g._missedDots.has(g._lastCheckedDotIdx)) {
              // This dot was missed
              g._missedDots.add(g._lastCheckedDotIdx);
              g.dotsMissed++;
              g.rhythmMisses++;
              g.rhythmStreak = 0; // reset streak on miss
              g.perfectStreak = 0;
              // Play miss sound (throttled to avoid spam)
              const now2 = performance.now();
              if (!g._lastMissSoundTime || now2 - g._lastMissSoundTime > 300) {
                playMiss();
                g._lastMissSoundTime = now2;
              }
              // Red flash effect at dot's last position
              const dotX = eventXAt(dot.time, g.gt, curSpeed, g.bird.x);
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

        g.pipes.forEach(p => {
          p.x = p.hitTime != null
            ? eventXAt(p.hitTime, g.gt, curSpeed, g.bird.x)
            : p.x - curSpeed * adt;
          p.beatGlow *= Math.pow(0.92, adt);
        });
        if (onBeat) g.pipes.forEach(p => { p.beatGlow = 1; });
        g.pipes = g.pipes.filter(p => {
          if (p.x <= -PIPE_W - 24) { p.beatGlow = 0; return false; }
          return true;
        });

        // Award one point once the bird has fully passed the pipe.
        g.pipes.forEach(p => {
          if (!p.passed && p.x + PIPE_W <= g.bird.x - HIT_R) {
            p.passed = true;
            g.totalPipes++;
            setScore(g.totalPipes);

            if (g.barStarts && g.barStarts.length > 0) {
              const { ratio } = distanceToNearestDownbeat(g.gt, g.barStarts, g.beatDuration);
              if (ratio < 0.15) {
                g.beatFlash = Math.max(g.beatFlash, 0.9);
              }
            }
          }
          if (!p.graded && p.passed) {
            p.graded = true;
            const gapCenter = p.gy + p.gap / 2, dist = Math.abs(g.bird.y - gapCenter), halfGap = p.gap / 2;
            let grade, color;
            if (dist < halfGap * 0.2) {
              grade = "perfect"; color = "#FFD700"; g.pipePerfects++;
              // Particle burst on perfect
              for (let pi = 0; pi < 12; pi++) {
                const a = (pi / 12) * Math.PI * 2;
                const sp = 2 + Math.random() * 3;
                g.particles.push({ x: g.bird.x, y: g.bird.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, size: 2 + Math.random() * 2, color });
              }
            }
            else if (dist < halfGap * 0.45) { grade = "great"; color = "#4ade80"; g.pipeGreats++; }
            else { grade = "good"; color = pal.base; g.pipeGoods++; }
            g.combo++; if (g.combo > g.maxCombo) g.maxCombo = g.combo;
            comboRef.current = g.combo; setCombo(g.combo);
            g.floats.push({ x: p.x + PIPE_W / 2, y: g.bird.y - 30, text: `${grade.toUpperCase()} PIPE +1`, color, life: 1.2, size: grade === "perfect" ? 16 : 14 });
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
          if (g.runFinalized) return;
          g.shake = 20; g.slowMo = 0.5; g.dFlash = 1;
          g.combo = 0; comboRef.current = 0; setCombo(0);
          finalizeRun(g, "dead");
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

      drawGame(ctx, g, pal, f, cp, bestRef, false, activeSprite, albumImgRef.current);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      aliveRef.current = false;
      cancelAnimationFrame(frameId);
      pausePlay();
    };
  }, [screen, initGame, setPhase, pausePlay, pollAudioPosition, getActiveSprite]);

  // Screen routing
  if (screen === "setup") return (
    <SetupScreen
      login={login}
      authError={spotifyAuthError}
      onBack={() => setScreen("menu")}
      userProfile={userProfile}
      isConnected={Boolean(token)}
      onLogout={handleLogout}
    />
  );
  // Persistent AppShell for browse screens
  const browseScreens = ["menu", "playlists", "library", "tracks", "top-tracks", "search", "sprites", "themes", "settings", "taste"];
  if (browseScreens.includes(screen)) {
    let screenContent = null;
    if (screen === "taste") {
      screenContent = <TasteSetupScreen initialProfiles={tasteProfiles} onSave={handleTasteSave} onBack={() => setScreen("menu")} spotifyConnected={Boolean(token)} onConnectSpotify={() => setScreen("setup")} />;
    } else if (screen === "menu") {
      screenContent = (
        <MainMenu
          token={token}
          userProfile={userProfile}
          onPickTrack={pickTrack}
          onPickTasteTrack={handleTasteTrack}
          onUploadTrack={handleLocalUpload}
          onNavigate={handleNavigate}
          onSelectPlaylist={(pl, returnTo = "menu") => {
            setSelPl(pl);
            setTracksReturnScreen(returnTo);
            setScreen("tracks");
          }}
          onConnectSpotify={() => setScreen("setup")}
          onOpenTaste={() => setScreen("taste")}
          tasteProfiles={tasteProfiles}
          tasteTracks={tasteTracks}
          tasteLoading={tasteLoading}
          tasteError={tasteError}
          notice={homeNotice}
        />
      );
    } else if (screen === "playlists" || screen === "library") {
      screenContent = (
        <PlaylistBrowser
          token={token}
          initialTab="playlists"
          onSelectPlaylist={(pl) => { setSelPl(pl); setTracksReturnScreen("playlists"); setScreen("tracks"); }}
          onPickTrack={pickTrack}
          onUploadTrack={handleLocalUpload}
          onConnectSpotify={() => setScreen("setup")}
          onBack={() => setScreen("menu")}
        />
      );
    } else if (screen === "tracks") {
      screenContent = <TrackList token={token} playlist={selPl} onPickTrack={pickTrack} onBack={() => setScreen(tracksReturnScreen)} />;
    } else if (screen === "top-tracks") {
      screenContent = (
        <TopTracks
          token={token}
          onSelectPlaylist={(pl) => { setSelPl(pl); setTracksReturnScreen("top-tracks"); setScreen("tracks"); }}
          onPickTrack={pickTrack}
          onUploadTrack={handleLocalUpload}
          onConnectSpotify={() => setScreen("setup")}
          onBack={() => setScreen("menu")}
        />
      );
    } else if (screen === "search") {
      screenContent = <SearchScreen token={token} onPickTrack={pickTrack} onBack={() => setScreen("menu")} />;
    } else if (screen === "sprites") {
      screenContent = <SpriteCustomizer onBack={() => setScreen("menu")} palette={palette} />;
    } else if (screen === "themes") {
      screenContent = <ThemeSelector onBack={() => setScreen("menu")} />;
    } else if (screen === "settings") {
      screenContent = <SettingsScreen onBack={() => setScreen("menu")} onCalibrate={() => setScreen("calibration")} onNavigate={handleNavigate} onDifficultyChange={setDifficulty} userProfile={userProfile} onLogout={handleLogout} spotifyConnected={Boolean(token)} onConnectSpotify={() => setScreen("setup")} onOpenTaste={() => setScreen("taste")} />;
    }

    return (
      <AppShell
        currentScreen={screen}
        onNavigate={handleNavigate}
        userProfile={userProfile}
      >
        {screenContent}
      </AppShell>
    );
  }
  if (screen === "loading") return <LoadingScreen loadMsg={loadMsg} />;
  if (screen === "calibration") return <CalibrationScreen features={features} palette={palette} onComplete={handleCalibrationComplete} onSkip={() => setScreen("game")} />;
  return <GameScreen W={W} H={H} canvasRef={canvasRef} track={track} features={features} palette={palette}
    score={score} best={best} combo={combo} difficulty={difficulty} setDifficulty={setDifficulty}
    chartAnalysis={chartAnalysis}
    flap={flap} setScreen={setScreen} togglePause={togglePause} paused={paused} phase={phase}
    resumePending={resumePending} pauseFeedback={pauseFeedback}
    onCalibrate={() => setScreen("calibration")} calibrationOffset={calibrationOffset}
    onRetry={restartRun} runReward={runReward} nextJourneyTrack={nextJourneyTrack}
    onNextTrack={() => {
      if (!nextJourneyTrack) return;
      pickTrack(nextJourneyTrack, {
        journeyId: runReward?.journey?.id || runContextRef.current?.journeyId,
      });
    }}
    trackKey={trackKeyRef.current}
    isAudioReady={isAudioReady}
    audioPrepMessage={audioPrepMessage}
    onBackToMenu={() => { pausePlay(); setPaused(false); pausedRef.current = false; setPhase("idle"); setScreen("menu"); }} />;
}
