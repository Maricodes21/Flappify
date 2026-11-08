import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { getPlaylists, getPlaylistTracks, getTopTracks, getRecentlyPlayed } from "../services/spotify";
import { getScorePoints } from "../game/scoring";
import {
  getBestScore,
  getGameTopTracks,
  getImportedTracks,
  getJourneyProgress,
  getLastPlayed,
  getLocalPlaylists,
  getPlaylistJourney,
  getProgressionOverview,
  saveImportedTrack,
  saveLocalPlaylist,
  startOrResumeJourney,
  getDailyListeningTracks,
  isBlockedItem,
} from "../services/storage";
import { SpotifyIcon } from "../screens";
import CurrentlyListening from "./NowPlaying";
import LastPlayed from "./LastPlayed";

const RATING_COLORS = { S: "#cf5d44", A: "#82a874", B: "#6ea4b8", C: "#d6a45b", D: "#9e9486" };
const RUN_VARIANTS = ["sage", "terracotta", "kraft", "amber"];
const PLAYLIST_VARIANTS = ["terracotta", "amber", "sage", "kraft"];

function RunCard({ track, score, rating, songPct, onPlay, index = 0, rank = 1 }) {
  const albumArt = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url;
  const ratingColor = RATING_COLORS[rating] || "#2b231c";
  const variant = RUN_VARIANTS[index % RUN_VARIANTS.length];
  const hasClip = index % 2 === 0;
  const isDogEared = index === 1;

  return (
    <button
      className={`run-card run-card--${variant} ${isDogEared ? "run-card--fold" : ""}`}
      onClick={onPlay}
      disabled={!onPlay}
      style={{ "--run-color": ratingColor }}
      title={track?.name ? `Play ${track.name} (Score: ${score?.toLocaleString?.() || 0})` : undefined}
    >
      <span className="run-card-rank-badge">#{rank}</span>
      {hasClip ? (
        <span className="craft-clip craft-clip--tr" aria-hidden="true" />
      ) : (
        <span className={`craft-pin ${index % 4 === 3 ? "craft-pin--amber" : ""} craft-pin--tr`} aria-hidden="true" />
      )}
      {index === 0 && <span className="craft-pin craft-pin--tl" aria-hidden="true" />}
      {index === 1 && <span className="craft-pin craft-pin--tl" aria-hidden="true" />}
      {albumArt ? <img src={albumArt} alt="" /> : <span className="track-art-fallback">♫</span>}
      <span className="run-card-copy">
        <strong>{track?.name || "Untitled Track"}</strong>
        <small>{track?.artists?.map?.(a => a.name).join(", ") || "Unknown Artist"}</small>
      </span>
      <span className="run-card-score">
        <strong>{score != null ? score.toLocaleString() : "—"}</strong>
        {rating ? <em style={{ color: ratingColor }}>{rating}</em> : (songPct != null ? <em>{songPct}%</em> : <em>OPEN</em>)}
      </span>
    </button>
  );
}

function PlaylistCraftCard({
  playlist,
  index = 0,
  isActiveJourney = false,
  journeyProgress,
  onResumeOrPlay,
  onOpenPlaylist,
}) {
  const variant = PLAYLIST_VARIANTS[index % PLAYLIST_VARIANTS.length];
  const trackCount = playlist.tracks?.total ?? playlist.trackCount ?? 0;
  const isResumable = isActiveJourney || (journeyProgress && journeyProgress.percent > 0);
  const percent = journeyProgress ? journeyProgress.percent : 0;

  const hasGrid = Array.isArray(playlist.coverImages) && playlist.coverImages.length >= 4;
  const singleImg = playlist.images?.[0]?.url || playlist.coverImage;

  return (
    <div
      className={`craft-playlist-card craft-playlist-card--${variant}`}
      onClick={() => onOpenPlaylist(playlist)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenPlaylist(playlist);
        }
      }}
    >
      <span className="craft-clip craft-clip--tc" aria-hidden="true" />

      <div className="playlist-art-frame">
        {hasGrid ? (
          <div className="playlist-art-grid">
            {playlist.coverImages.slice(0, 4).map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" />
            ))}
          </div>
        ) : singleImg ? (
          <img src={singleImg} alt="" className="playlist-art-single" loading="lazy" />
        ) : (
          <div className="playlist-art-fallback">♫</div>
        )}
      </div>

      <div className="playlist-card-info">
        <strong className="playlist-card-title" title={playlist.name}>
          {playlist.name}
        </strong>
        <span className="playlist-card-meta">
          {trackCount} tracks
        </span>
      </div>

      <button
        type="button"
        className={`playlist-card-btn ${isResumable ? "playlist-card-btn--resume" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onResumeOrPlay(playlist);
        }}
        title={isResumable ? `Resume playlist ${playlist.name}` : `Play playlist ${playlist.name}`}
      >
        <span>{isResumable ? "► RESUME" : "► PLAY"}</span>
      </button>

      <div className="playlist-stamp" aria-label={`${percent}% completed`}>
        <span>{percent}%</span>
      </div>
    </div>
  );
}

export default function MainMenu({
  token,
  onPickTrack,
  onPickTasteTrack,
  onUploadTrack,
  onNavigate,
  onSelectPlaylist,
  onConnectSpotify,
  onOpenTaste,
  userProfile,
  tasteProfiles,
  notice,
}) {
  const [quickTracks, setQuickTracks] = useState([]);
  const [loadingQuickTracks, setLoadingQuickTracks] = useState(Boolean(token));
  const [gameTopTracks, setGameTopTracks] = useState(() => getGameTopTracks(4));
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(Boolean(token));
  const [localPlaylists, setLocalPlaylists] = useState(() => getLocalPlaylists());
  const [importedTracks, setImportedTracks] = useState(() => getImportedTracks());
  const [dailyRoundupTracks, setDailyRoundupTracks] = useState(() => getDailyListeningTracks());
  const [loadingDaily, setLoadingDaily] = useState(Boolean(token));
  const [lastPlayed, setLastPlayed] = useState(null);
  const [progression, setProgression] = useState(() => getProgressionOverview());
  const fileInputRef = useRef(null);
  const playlistInputRef = useRef(null);

  const refreshDynamicState = useCallback(() => {
    setGameTopTracks(getGameTopTracks(4));
    setProgression(getProgressionOverview());
    setLastPlayed(getLastPlayed());
    setLocalPlaylists(getLocalPlaylists());
    setImportedTracks(getImportedTracks());
    setDailyRoundupTracks(getDailyListeningTracks());
  }, []);

  useEffect(() => {
    refreshDynamicState();
    window.addEventListener("focus", refreshDynamicState);
    window.addEventListener("storage", refreshDynamicState);
    return () => {
      window.removeEventListener("focus", refreshDynamicState);
      window.removeEventListener("storage", refreshDynamicState);
    };
  }, [refreshDynamicState]);

  useEffect(() => {
    if (token) {
      setLoadingQuickTracks(true);
      setLoadingPlaylists(true);
      setLoadingDaily(true);

      getTopTracks(token, "short_term", 6)
        .then(res => { setQuickTracks(res); setLoadingQuickTracks(false); })
        .catch(() => { setQuickTracks([]); setLoadingQuickTracks(false); });

      getPlaylists(token, 50)
        .then(res => {
          setSpotifyPlaylists(Array.isArray(res) ? res : []);
          setLoadingPlaylists(false);
        })
        .catch(err => {
          console.warn("[MainMenu] playlists fetch failed", err);
          setSpotifyPlaylists([]);
          setLoadingPlaylists(false);
        });

      getRecentlyPlayed(token, 50)
        .then(recent => {
          const localDaily = getDailyListeningTracks();
          const combined = [...localDaily];
          (recent || []).forEach(t => {
            if (!combined.some(c => c.id === t.id)) combined.push(t);
          });
          setDailyRoundupTracks(combined);
          setLoadingDaily(false);
        })
        .catch(() => {
          setDailyRoundupTracks(getDailyListeningTracks());
          setLoadingDaily(false);
        });
    } else {
      setQuickTracks([]);
      setSpotifyPlaylists([]);
      setLoadingPlaylists(false);
      setLoadingQuickTracks(false);
      setDailyRoundupTracks(getDailyListeningTracks());
      setLoadingDaily(false);
    }
  }, [token]);

  const activeJourney = progression.activeJourney;
  const journeyProgress = getJourneyProgress(activeJourney);
  const nextJourneyTrack = activeJourney?.tracks?.[activeJourney.currentIndex] || null;
  const levelProgress = Math.max(0, Math.min(1, progression.level?.progress || 0));
  const showRecent = Boolean(lastPlayed || token);

  // Top 4 Playlists:
  // When connected, show the user's top 4 Spotify playlists (active journey prioritized).
  // When not connected, do not show Spotify playlists; show user's imported local playlists.
  const topPlaylists = useMemo(() => {
    if (token) {
      const valid = (spotifyPlaylists || []).filter(p => p && p.id && !isBlockedItem(p));
      // Prioritize user's own created playlists first, then any other saved playlists
      const owned = valid.filter(p => p.owner && userProfile?.id && p.owner.id === userProfile.id);
      const others = valid.filter(p => !owned.some(o => o.id === p.id));
      const sorted = [...owned, ...others];
      return sorted.slice(0, 4);
    }
    // Disconnected: only show user's imported local playlists
    return (localPlaylists || []).filter(p => p && p.id && !isBlockedItem(p)).slice(0, 4);
  }, [token, spotifyPlaylists, userProfile, localPlaylists]);

  // Top 6 tracks for the Top Tracks section:
  // When connected to Spotify, pull from Spotify quickTracks.
  // When not connected, pull from imported tracks or played tracks.
  const topDisplayTracks = useMemo(() => {
    if (token && quickTracks.length > 0) {
      return quickTracks.slice(0, 6);
    }
    if (importedTracks.length > 0) {
      return importedTracks.slice(0, 6);
    }
    return gameTopTracks
      .map(r => (r.trackObj ? r.trackObj : r.trackName ? {
        id: r.trackId,
        name: r.trackName,
        artists: [{ name: r.artistName || "Local" }],
        album: { images: [{ url: r.albumArt }] }
      } : null))
      .filter(Boolean)
      .slice(0, 6);
  }, [token, quickTracks, importedTracks, gameTopTracks]);

  const choosePlaylistFiles = () => playlistInputRef.current?.click();
  const handleImportPlaylistFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const audioFiles = files.filter(f => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name));
    if (audioFiles.length === 0) return;

    const tracks = audioFiles.map((file, i) => {
      const objectUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/^\d+[\s.-]*/, "") || `Track ${i + 1}`;
      const trackObj = {
        id: `local-trk-${Date.now()}-${i}`,
        name: cleanName,
        artists: [{ name: "Local Artist" }],
        album: { name: "Local Playlist", images: [] },
        duration_ms: 180000,
        playbackProvider: "local",
        localAudioUrl: objectUrl,
        localFileName: file.name,
      };
      saveImportedTrack(trackObj);
      return trackObj;
    });

    const playlistName = audioFiles.length > 1
      ? `Local Mix (${audioFiles.length} tracks)`
      : (audioFiles[0].name.replace(/\.[^/.]+$/, "") || "Local Playlist");

    const newPlaylist = {
      id: `local-pl-${Date.now()}`,
      name: playlistName,
      isLocal: true,
      tracks: { total: tracks.length, items: tracks },
      images: [],
      createdAt: Date.now(),
    };
    saveLocalPlaylist(newPlaylist);
    refreshDynamicState();
  };

  const handleOpenDailyRoundup = () => {
    const list = dailyRoundupTracks.length > 0
      ? dailyRoundupTracks
      : (importedTracks.length > 0 ? importedTracks : []);
    const playlistObj = {
      id: "daily-roundup",
      name: `DAILY ROUNDUP • ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      isLocal: true,
      isDailyRoundup: true,
      tracks: {
        total: list.length,
        items: list,
      },
      images: list[0]?.album?.images || [],
    };
    if (onSelectPlaylist) {
      onSelectPlaylist(playlistObj, "menu");
    } else {
      onNavigate("playlists");
    }
  };

  // Top 4 runs dynamically adjusted with guaranteed 4 visual slots
  const bestRuns = gameTopTracks.slice(0, 4);
  const slotsToDisplay = [...bestRuns];
  while (slotsToDisplay.length < 4) {
    slotsToDisplay.push(null);
  }

  const handleResumeOrPlayPlaylist = async (playlist) => {
    if (activeJourney?.id === playlist.id && nextJourneyTrack) {
      onPickTrack(nextJourneyTrack, { journeyId: activeJourney.id });
      return;
    }

    const existingJourney = getPlaylistJourney(playlist.id);
    if (existingJourney && existingJourney.tracks?.length > 0) {
      const nextTrack = existingJourney.tracks[existingJourney.currentIndex || 0] || existingJourney.tracks[0];
      if (nextTrack) {
        onPickTrack(nextTrack, { journeyId: existingJourney.id });
        return;
      }
    }

    if (token && playlist.id) {
      try {
        const tracks = await getPlaylistTracks(token, playlist.id, 50);
        if (tracks.length > 0) {
          const started = startOrResumeJourney(playlist, tracks);
          const first = started.tracks?.[started.currentIndex || 0] || started.tracks?.[0];
          if (first) {
            onPickTrack(first, { journeyId: started.id });
            return;
          }
        }
      } catch (err) {
        console.warn("[MainMenu] failed to load playlist tracks", err);
      }
    }

    if (onSelectPlaylist) {
      onSelectPlaylist(playlist, "menu");
    } else {
      onNavigate("playlists");
    }
  };

  const handlePlaylistCardClick = (playlist) => {
    if (onSelectPlaylist) {
      onSelectPlaylist(playlist, "menu");
    } else {
      onNavigate("playlists");
    }
  };

  const chooseFile = () => fileInputRef.current?.click();
  const receiveFile = event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onUploadTrack(file);
  };

  return (
    <main className="screen-scroll home-screen home-main-content fade-in" style={{ paddingBottom: 96 }}>
      <input ref={fileInputRef} className="visually-hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={receiveFile} />
      <div className="home-container">
        <header className="home-header">
          <div>
            <h1>FLAPPYFY</h1>
          </div>
          <button className="profile-chip" onClick={() => onNavigate("settings")} aria-label="Open settings">
            {userProfile?.images?.[0]?.url ? <img src={userProfile.images[0].url} alt="" /> : <span>{userProfile ? "S" : "L"}</span>}
            <small>{userProfile?.display_name || "LOCAL PLAYER"}</small>
          </button>
        </header>

        {notice && <div className="home-notice" role="status">{notice}</div>}

        {/* Player Progression (Original compact size) */}


        <section className="progress-panel" aria-label="Player progression">
            <span className="craft-clip craft-clip--tl" aria-hidden="true" />
            <div className="rank-lockup">
              <span>{progression.level?.name?.slice(0, 1) || "S"}</span>
              <div><small>PLAYER RANK</small><strong>{progression.level?.name || "Silver"}</strong></div>
            </div>
            <div className="rank-progress">
              <div><span style={{ width: `${levelProgress * 100}%` }} /></div>
              <small>{progression.level?.nextName ? `${progression.level.nextThreshold - progression.xp} XP TO ${progression.level.nextName.toUpperCase()}` : "MAX RANK"}</small>
            </div>
            <div className="rank-stats"><span><b>{progression.masteryStars}</b> STARS</span><span><b>{progression.tracksCleared}</b> CLEARS</span><span><b>{progression.xp}</b> XP</span></div>
          </section>



        {/* Play Your Way */}


        <section className="play-paths" aria-labelledby="play-your-way">
            <div className="section-heading-row">
              <div><h2 id="play-your-way">PLAY YOUR WAY</h2></div>
              <small>Audio stays in this browser session</small>
            </div>
            <div className={`play-path-grid ${token ? "is-single" : ""}`}>
              <button className="play-path-card play-path-card--local" onClick={chooseFile} title="Upload an audio file to play">
                <span className="craft-clip craft-clip--tr" aria-hidden="true" />
                <span className="path-index">FULL SYNC</span>
                <span className="path-copy">
                  <strong>DROP IN YOUR TRACK</strong>
                </span>
                <span className="path-action">CHOOSE AUDIO <b>↗</b></span>
                <span className="craft-doodles" aria-hidden="true">
                  <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
                    <path d="M42 22C42 16 46 14 52 12V24" stroke="#2b231c" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="40" cy="24" r="3.5" fill="#2b231c"/>
                    <path d="M54 38C54 32 58 30 62 28V38" stroke="#2b231c" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="52" cy="40" r="3.5" fill="#2b231c"/>
                    <path d="M50 48C48 44 48 40 54 36M50 48C52 46 56 46 58 50M50 48C46 52 48 56 52 56" stroke="#2e5339" strokeWidth="1.6" strokeLinecap="round"/>
                    <path d="M28 14L29.5 18L33.5 19.5L29.5 21L28 25L26.5 21L22.5 19.5L26.5 18Z" fill="#cf845e" stroke="#2b231c" strokeWidth="1"/>
                    <path d="M60 16L61 19L64 20L61 21L60 24L59 21L56 20L59 19Z" fill="#d6a45b" stroke="#2b231c" strokeWidth="1"/>
                  </svg>
                </span>
              </button>

              {!token && (
                <button className="play-path-card play-path-card--spotify" onClick={onConnectSpotify} title="Log in with Spotify">
                  <span className="craft-clip craft-clip--tr" aria-hidden="true" />
                  <span className="path-index">SPOTIFY SYNC</span>
                  <span className="path-copy">
                    <strong>LOG IN WITH SPOTIFY</strong>
                  </span>
                  <span className="path-action">CONNECT ACCOUNT <b>↗</b></span>
                </button>
              )}
            </div>
          </section>

        {/* Lined-up DAILY ROUNDUP & KEEP MOVING (Matching in size & craftsmanship) */}
        <section className="paired-cards-section" aria-label="Daily Roundup and Keep Moving">
          <div className="paired-cards-grid">
            {/* Daily Roundup Card */}
            <div className="paired-card-item">
              <div className="section-heading-row">
                <div className="playlist-heading-group">
                  <h2 id="daily-roundup-heading">DAILY ROUNDUP</h2>
                  <span className="playlist-stars" aria-hidden="true">★★★★</span>
                </div>
                <span className="daily-roundup-badge">TODAY'S MIX</span>
              </div>

              {loadingDaily ? (
                <div className="daily-roundup-loading">
                  <span className="spin-slow" style={{ fontSize: 20 }}>🎵</span>
                  <small>GATHERING TODAY'S SONGS...</small>
                </div>
              ) : (
                <button
                  className="daily-roundup-card"
                  onClick={handleOpenDailyRoundup}
                  title="Play through today's songs"
                  aria-label="Open Daily Roundup"
                >
                  <span className="craft-clip craft-clip--tr" aria-hidden="true" />
                  <span className="craft-pin craft-pin--tl" aria-hidden="true" />

                  <div className="daily-roundup-art-preview">
                    {dailyRoundupTracks.filter(t => t.album?.images?.[0]?.url).length >= 4 ? (
                      <div className="daily-art-grid">
                        {dailyRoundupTracks
                          .filter(t => t.album?.images?.[0]?.url)
                          .slice(0, 4)
                          .map((t, i) => (
                            <img key={i} src={t.album.images[0].url} alt="" loading="lazy" />
                          ))}
                      </div>
                    ) : dailyRoundupTracks[0]?.album?.images?.[0]?.url ? (
                      <img src={dailyRoundupTracks[0].album.images[0].url} alt="" className="daily-art-single" loading="lazy" />
                    ) : (
                      <div className="daily-art-placeholder">
                        <span>📅</span>
                      </div>
                    )}
                  </div>

                  <div className="daily-roundup-content">
                    <span className="daily-roundup-tag">DAILY AUDIO LOG</span>
                    <strong className="daily-roundup-title">
                      {dailyRoundupTracks.length > 0
                        ? `Today's Listening (${dailyRoundupTracks.length} tracks)`
                        : "Today's Listening"}
                    </strong>
                    <p className="daily-roundup-desc">
                      {dailyRoundupTracks.length > 0
                        ? `Play through the songs you listened to today in rhythm runs.`
                        : `Play a song or listen on Spotify to assemble your daily roundup.`}
                    </p>
                    <div className="daily-roundup-action">
                      <span className="daily-play-btn">
                        {dailyRoundupTracks.length > 0 ? "PLAY ROUNDUP ▶" : "START PLAYING ▶"}
                      </span>
                      <span className="daily-date-label">
                        {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Keep Moving Card */}
            <div className="paired-card-item">
              <div className="section-heading-row">
                <div><h2 id="keep-moving-heading">KEEP MOVING</h2></div>
                <small>Pick up where you left off</small>
              </div>
              {token && <CurrentlyListening token={token} onPlayTrack={onPickTrack} />}
              <LastPlayed onPlayTrack={onPickTrack} onUploadRequest={chooseFile} />
            </div>
          </div>
        </section>

        {/* BEST RUNS SECTION (above playlists, top 4 runs adjust dynamically) */}
        <section className="best-runs-section" aria-labelledby="best-runs-heading">
          <div className="section-heading-row">
            <div><h2 id="best-runs-heading">BEST RUNS</h2></div>
            <small>Top 4 performances</small>
          </div>
          <div className="run-list">
            {slotsToDisplay.map((item, index) =>
              item ? (
                <RunCard
                  key={item.trackId || index}
                  index={index}
                  rank={index + 1}
                  track={item.trackObj || { name: item.trackName, album: { images: [{ url: item.albumArt }] } }}
                  score={getScorePoints(item)}
                  rating={item.rating}
                  songPct={item.songPct}
                  onPlay={item.trackObj?.localUnavailable ? null : item.trackObj ? () => onPickTrack(item.trackObj) : null}
                />
              ) : (
                <button
                  key={`empty-run-${index}`}
                  className={`run-card run-card--${RUN_VARIANTS[index % RUN_VARIANTS.length]} run-card--empty`}
                  onClick={chooseFile}
                  title="Play a track to record a run in this slot"
                >
                  <span className="run-card-rank-badge">#{index + 1}</span>
                  <span className="craft-pin craft-pin--tr" aria-hidden="true" />
                  <span className="track-art-fallback">🏁</span>
                  <span className="run-card-copy">
                    <strong>OPEN RUN SLOT</strong>
                    <small>Upload or play a track</small>
                  </span>
                  <span className="run-card-score">
                    <strong>—</strong>
                    <em>OPEN</em>
                  </span>
                </button>
              )
            )}
          </div>
        </section>

        {/* RENAMED PLAYLISTS SECTION */}
        <section className="playlists-section" aria-labelledby="playlists-heading">
          <div className="section-heading-row playlist-heading-row">
            <div className="playlist-heading-group">
              <h2 id="playlists-heading">PLAYLISTS</h2>
              <span className="playlist-stars" aria-hidden="true">★★★★</span>
            </div>
            <button
              className="view-more-btn"
              onClick={() => onNavigate("playlists")}
              aria-label="View more playlists in library"
            >
              VIEW MORE →
            </button>
          </div>

          <input
            ref={playlistInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
            className="visually-hidden"
            onChange={handleImportPlaylistFiles}
          />

          {loadingPlaylists ? (
            <div className="playlists-loading-indicator">
              <span className="spin-slow" style={{ fontSize: 24 }}>🎵</span>
              <small>LOADING PLAYLISTS...</small>
            </div>
          ) : token && topPlaylists.length > 0 ? (
            <div className="craft-playlist-grid">
              {topPlaylists.map((pl, idx) => {
                const isCurrent = activeJourney?.id === pl.id;
                const journey = isCurrent ? activeJourney : getPlaylistJourney(pl.id);
                const progress = getJourneyProgress(journey);
                return (
                  <PlaylistCraftCard
                    key={pl.id || idx}
                    playlist={pl}
                    index={idx}
                    isActiveJourney={isCurrent}
                    journeyProgress={progress}
                    onResumeOrPlay={handleResumeOrPlayPlaylist}
                    onOpenPlaylist={handlePlaylistCardClick}
                  />
                );
              })}
            </div>
          ) : !token ? (
            <div className="unconnected-playlists-container">
              {topPlaylists.length > 0 && (
                <div className="craft-playlist-grid" style={{ marginBottom: 12 }}>
                  {topPlaylists.map((pl, idx) => {
                    const isCurrent = activeJourney?.id === pl.id;
                    const journey = isCurrent ? activeJourney : getPlaylistJourney(pl.id);
                    const progress = getJourneyProgress(journey);
                    return (
                      <PlaylistCraftCard
                        key={pl.id || idx}
                        playlist={pl}
                        index={idx}
                        isActiveJourney={isCurrent}
                        journeyProgress={progress}
                        onResumeOrPlay={handleResumeOrPlayPlaylist}
                        onOpenPlaylist={handlePlaylistCardClick}
                      />
                    );
                  })}
                </div>
              )}
              <button className="play-path-card play-path-card--local" onClick={choosePlaylistFiles} style={{ width: "100%", textAlign: "left" }}>
                <span className="craft-clip craft-clip--tr" aria-hidden="true" />
                <span className="path-index">LOCAL PLAYLIST</span>
                <span className="path-copy">
                  <strong>IMPORT LOCAL PLAYLIST</strong>
                  <small>Select audio files to create an instant offline playlist</small>
                </span>
                <span className="path-action">CHOOSE AUDIO FILES <b>↗</b></span>
              </button>
            </div>
          ) : (
            <div className="empty-playlists-box" style={{
              padding: "24px 16px",
              textAlign: "center",
              background: "#fbf6ec",
              border: "1.5px dashed #2b231c",
              borderRadius: 12,
              boxShadow: "var(--paper-shadow-sm)",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.7 }}>📋</div>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 0.5, color: "var(--text-primary)", display: "block" }}>
                NO PLAYLISTS AVAILABLE
              </strong>
              <p style={{ margin: "6px 0 14px", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>
                No music playlists found in your Spotify account.
              </p>
              <button className="btn-secondary" onClick={choosePlaylistFiles} style={{ fontSize: 10, padding: "6px 14px" }}>
                + IMPORT LOCAL PLAYLIST
              </button>
            </div>
          )}
        </section>

        {/* TOP TRACKS SECTION (underneath Playlists, with VIEW MORE button) */}
        <section className="top-tracks-section" aria-labelledby="top-tracks-heading">
          <div className="section-heading-row">
            <div className="playlist-heading-group">
              <h2 id="top-tracks-heading">TOP TRACKS</h2>
              <span className="playlist-stars" aria-hidden="true">★★★★</span>
            </div>
            <button
              className="view-more-btn"
              onClick={() => onNavigate("top-tracks")}
              aria-label="View more top tracks"
            >
              VIEW MORE →
            </button>
          </div>

          {loadingQuickTracks ? (
            <div className="playlists-loading-indicator">
              <span className="spin-slow" style={{ fontSize: 24 }}>♫</span>
              <small>LOADING TOP TRACKS...</small>
            </div>
          ) : topDisplayTracks.length > 0 ? (
            <div className="mini-track-grid">
              {topDisplayTracks.map(track => {
                const best = getBestScore(track.id);
                const art = track.album?.images?.[1]?.url || track.album?.images?.[0]?.url;
                const ratingColor = best?.rating ? (RATING_COLORS[best.rating] || "#cf7b52") : null;
                return (
                  <button key={track.id} onClick={() => onPickTrack(track)} title={track.name}>
                    {art ? <img src={art} alt="" /> : <span className="track-art-fallback">♫</span>}
                    <strong>{track.name}</strong>
                    <small>{track.artists?.[0]?.name || "Local track"}</small>
                    {best?.rating && (
                      <em style={{ background: ratingColor }}>{best.rating}</em>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-tracks-prompt" style={{ textAlign: "center", padding: "16px 12px", background: "#fbf6ec", border: "1.5px dashed #2b231c", borderRadius: 8 }}>
              <small style={{ color: "var(--text-muted)", display: "block", marginBottom: 6 }}>No top tracks yet</small>
              <button className="btn-ghost" onClick={chooseFile} style={{ fontSize: 10, padding: "4px 10px" }}>Upload a track to play</button>
            </div>
          )}
                </section>
      </div>
    </main>
  );
}
