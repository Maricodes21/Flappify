import { useState, useEffect, useRef, useMemo } from "react";
import { getPlaylists, getTopTracks, getRecentlyPlayed } from "../services/spotify";
import { formatScorePoints } from "../game/scoring";
import {
  getJourneyProgress,
  getPlaylistJourney,
  getBestScore,
  getLocalPlaylists,
  saveLocalPlaylist,
  deleteLocalPlaylist,
  getImportedTracks,
  saveImportedTrack,
  getCompletedRuns,
  getDailyListeningTracks,
  isBlockedItem,
} from "../services/storage";

/* ── design tokens ── */
const FM = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FF = "var(--font-display)";

/* Warm craft paper tints for playlist cards based on index */
const TINTS = [
  "#fbf6ec",  /* manila / cream */
  "#ebdcc4",  /* buff */
  "#edd5be",  /* light terracotta */
  "#91a07c",  /* sage */
  "#dcbe6c",  /* amber */
  "#c7b496",  /* kraft */
];

const RATING_COLORS = { S: "#cf5d44", A: "#82a874", B: "#6ea4b8", C: "#d6a45b", D: "#9e9486" };
const STAR_COLORS = { 1: "#82a874", 2: "#d6a45b", 3: "#cf5d44" };

/* ── Mini completion ring (SVG) ── */
function CompletionRing({ played, total, size = 28 }) {
  if (!total) return null;
  const pct = Math.min(played / total, 1);
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = circ * pct;
  const color = pct >= 1 ? "#2e5339" : pct >= 0.5 ? "#cf7b52" : "#2b231c";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(43,35,28,0.18)" strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${stroke} ${circ - stroke}`}
          strokeLinecap="round" />
      </svg>
      <span style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 8, fontFamily: FM, fontWeight: 800, color,
      }}>
        {pct >= 1 ? "✓" : `${Math.round(pct * 100)}%`}
      </span>
    </div>
  );
}

function DifficultyStars({ stars }) {
  if (!stars) return null;
  const color = STAR_COLORS[stars] || "#9e9486";
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ fontSize: 9, color: i <= stars ? color : "rgba(43,35,28,0.2)" }}>★</span>
      ))}
    </div>
  );
}

/* ── Interactive Track Card ── */
function LibraryTrackCard({ track, onPickTrack, diffRating }) {
  const best = getBestScore(track.id);
  const stars = diffRating?.stars || best?.difficultyStars;
  const albumArt = track.album?.images?.[1]?.url || track.album?.images?.[0]?.url;

  return (
    <button
      onClick={() => onPickTrack && onPickTrack(track)}
      className="card-interactive"
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        padding: 8,
        borderRadius: 8,
        background: "#fbf6ec",
        border: "1.5px solid var(--border-subtle)",
        boxShadow: "var(--paper-shadow-sm)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        transition: "transform 0.1s ease, box-shadow 0.15s ease",
        width: "100%",
        minWidth: 0,
      }}
      onPointerDown={e => e.currentTarget.style.transform = "scale(0.97)"}
      onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
      onPointerLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <div style={{
        width: "100%",
        aspectRatio: "1",
        borderRadius: 6,
        overflow: "hidden",
        border: best ? `2px solid ${RATING_COLORS[best.rating] || "var(--border-subtle)"}` : "1.5px solid var(--border-subtle)",
        boxShadow: "var(--paper-shadow-sm)",
        marginBottom: 6,
        background: "#ebdcc4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {albumArt ? (
          <img src={albumArt} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 24, opacity: 0.65 }}>🎵</span>
        )}
      </div>

      <div style={{
        fontFamily: FM,
        fontSize: 10,
        fontWeight: 800,
        color: "var(--text-primary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        width: "100%",
        marginBottom: 2,
      }}>
        {track.name}
      </div>

      <div style={{
        fontFamily: FM,
        fontSize: 8.5,
        color: "var(--text-muted)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        width: "100%",
        marginBottom: 4,
      }}>
        {track.artists?.map(a => a.name).join(", ") || "Local Artist"}
      </div>

      {stars && <DifficultyStars stars={stars} />}

      {best && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
          <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: FF, fontWeight: "bold" }}>
            {formatScorePoints(best)}
          </span>
          {best.rating && (
            <span style={{ fontSize: 9, fontWeight: "bold", color: RATING_COLORS[best.rating] }}>
              {best.rating}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export default function PlaylistBrowser({
  token,
  initialTab = "playlists",
  onSelectPlaylist,
  onPickTrack,
  onUploadTrack,
  onConnectSpotify,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "playlists");
  const [playlistSubTab, setPlaylistSubTab] = useState(token ? "spotify" : "imported");
  const [trackSubTab, setTrackSubTab] = useState("short_term");

  // Playlists state
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(Boolean(token));
  const [localPlaylists, setLocalPlaylists] = useState(() => getLocalPlaylists());

  // Tracks state
  const [recentTracks, setRecentTracks] = useState(() => getDailyListeningTracks());
  const [shortTermTracks, setShortTermTracks] = useState([]);
  const [mediumTermTracks, setMediumTermTracks] = useState([]);
  const [longTermTracks, setLongTermTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(Boolean(token));
  const [importedTracks, setImportedTracks] = useState(() => getImportedTracks());
  const [completedRuns, setCompletedRuns] = useState(() => getCompletedRuns());

  const playlistInputRef = useRef(null);
  const trackInputRef = useRef(null);

  // Sync tab with initialTab prop if it changes
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Load Spotify playlists if token exists
  useEffect(() => {
    if (!token) {
      setPlaylists([]);
      setLoadingPlaylists(false);
      return;
    }
    let cancelled = false;
    setLoadingPlaylists(true);
    getPlaylists(token, 200).then(p => {
      if (!cancelled) {
        setPlaylists(p);
        setLoadingPlaylists(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingPlaylists(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  // Load Spotify tracks across time ranges if token exists
  useEffect(() => {
    if (!token) {
      setShortTermTracks([]);
      setMediumTermTracks([]);
      setLongTermTracks([]);
      setLoadingTracks(false);
      return;
    }
    let cancelled = false;
    setLoadingTracks(true);
    Promise.all([
      getTopTracks(token, "short_term", 50).catch(() => []),
      getTopTracks(token, "medium_term", 50).catch(() => []),
      getTopTracks(token, "long_term", 50).catch(() => []),
      getRecentlyPlayed(token, 50).catch(() => []),
    ]).then(([st, mt, lt, rp]) => {
      if (!cancelled) {
        setShortTermTracks(st);
        setMediumTermTracks(mt);
        setLongTermTracks(lt);

        const localDaily = getDailyListeningTracks(3);
        const combined = [...localDaily];
        (rp || []).forEach(t => {
          if (!combined.some(c => c.id === t.id)) combined.push(t);
        });
        if (combined.length === 0 && st.length > 0) {
          combined.push(...st.slice(0, 20));
        }
        setRecentTracks(combined);

        setLoadingTracks(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingTracks(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  // Refresh local data when active tab changes or mounts
  const refreshLocalData = () => {
    setLocalPlaylists(getLocalPlaylists());
    setImportedTracks(getImportedTracks());
    setCompletedRuns(getCompletedRuns());
    setRecentTracks(prev => {
      const daily = getDailyListeningTracks(3);
      const merged = [...daily];
      prev.forEach(t => {
        if (!merged.some(m => m.id === t.id)) merged.push(t);
      });
      return merged;
    });
  };

  useEffect(() => {
    refreshLocalData();
  }, [activeTab]);

  // Handler for importing multiple audio files to form a local playlist
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
    refreshLocalData();
    setPlaylistSubTab("imported");
  };

  const handleDeletePlaylist = (playlistId, e) => {
    e.stopPropagation();
    deleteLocalPlaylist(playlistId);
    refreshLocalData();
  };

  // Handler for importing individual audio files under Imported Tracks
  const handleImportSingleTrack = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    if (onUploadTrack && files.length === 1) {
      onUploadTrack(files[0]);
      return;
    }

    files.forEach((file, i) => {
      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) return;
      const objectUrl = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/^\d+[\s.-]*/, "") || `Track ${i + 1}`;
      const trackObj = {
        id: `local-trk-${Date.now()}-${i}`,
        name: cleanName,
        artists: [{ name: "Local Artist" }],
        album: { name: "Local Audio", images: [] },
        duration_ms: 180000,
        playbackProvider: "local",
        localAudioUrl: objectUrl,
        localFileName: file.name,
      };
      saveImportedTrack(trackObj);
    });
    refreshLocalData();
    setTrackSubTab("imported");
  };

  const getPlayedCount = (playlist) => {
    return getJourneyProgress(getPlaylistJourney(playlist.id)).completed;
  };

  const cleanPlaylists = useMemo(() => {
    return (playlists || []).filter(p => p && p.id && !isBlockedItem(p));
  }, [playlists]);
  const featured = cleanPlaylists.length > 0
    ? cleanPlaylists.reduce((a, b) => (b.tracks?.total || 0) > (a.tracks?.total || 0) ? b : a, cleanPlaylists[0])
    : null;
  const restPlaylists = cleanPlaylists.filter(p => p.id !== featured?.id);

  // Active track list based on trackSubTab
  const getActiveTrackList = () => {
    switch (trackSubTab) {
      case "recent":
        return recentTracks;
      case "short_term":
        return shortTermTracks;
      case "medium_term":
        return mediumTermTracks;
      case "long_term":
        return longTermTracks;
      case "imported":
        return importedTracks;
      default:
        return shortTermTracks;
    }
  };

  const currentTracks = getActiveTrackList();

  return (
    <div className="screen-scroll fade-in" style={{ paddingBottom: 80 }}>
      <div className="library-container">

        {/* ── Top Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button className="btn-ghost" onClick={onBack}
            style={{ padding: "8px 16px", fontSize: 12, minWidth: 56, minHeight: 44 }}>
            ← BACK
          </button>
          <h2 style={{
            fontFamily: FF, fontSize: 18, margin: 0,
            color: "var(--text-primary)", letterSpacing: 0.5,
          }}>
            LIBRARY
          </h2>
        </div>

        {/* ── Menu Switcher Tabs: PLAYLISTS, TRACKS, COMPLETED RUNS ── */}
        <div className="library-menu-tabs" role="tablist" aria-label="Library view selection">
          <button
            role="tab"
            aria-selected={activeTab === "playlists"}
            className={`library-tab-btn ${activeTab === "playlists" ? "active" : ""}`}
            onClick={() => setActiveTab("playlists")}
          >
            <span className="tab-icon">📁</span> PLAYLISTS
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "tracks"}
            className={`library-tab-btn ${activeTab === "tracks" ? "active" : ""}`}
            onClick={() => setActiveTab("tracks")}
          >
            <span className="tab-icon">♫</span> TRACKS
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "completed"}
            className={`library-tab-btn ${activeTab === "completed" ? "active" : ""}`}
            onClick={() => setActiveTab("completed")}
          >
            <span className="tab-icon">🏆</span> COMPLETED RUNS
          </button>
        </div>

        {/* Hidden inputs for imports */}
        <input
          ref={playlistInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          className="visually-hidden"
          onChange={handleImportPlaylistFiles}
        />
        <input
          ref={trackInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          className="visually-hidden"
          onChange={handleImportSingleTrack}
        />

        {/* ══════════════════════════════════════════════════════════════
            TAB 1: PLAYLISTS MENU
            (Sub-tabs for Spotify Playlists and Imported Playlists)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "playlists" && (
          <div className="tab-content-fade">
            {/* Sub-tabs row */}
            <div className="subtab-row" role="tablist" aria-label="Playlist category tabs">
              <button
                className={`subtab-btn ${playlistSubTab === "spotify" ? "active" : ""}`}
                onClick={() => setPlaylistSubTab("spotify")}
              >
                ☁️ SPOTIFY PLAYLISTS {token && playlists.length > 0 ? `(${playlists.length})` : ""}
              </button>
              <button
                className={`subtab-btn ${playlistSubTab === "imported" ? "active" : ""}`}
                onClick={() => setPlaylistSubTab("imported")}
              >
                📂 IMPORTED PLAYLISTS {localPlaylists.length > 0 ? `(${localPlaylists.length})` : ""}
              </button>
            </div>

            {/* Sub-tab 1: Spotify Playlists */}
            {playlistSubTab === "spotify" && (
              <div className="tab-content-fade">
                {loadingPlaylists ? (
                  <div className="playlists-loading-indicator">
                    <span className="spin-slow" style={{ fontSize: 24 }}>🎵</span>
                    <small>LOADING SPOTIFY PLAYLISTS...</small>
                  </div>
                ) : token ? (
                  <>
                    {/* Featured hero card */}
                    {featured && (
                      <button onClick={() => onSelectPlaylist(featured)}
                        style={{
                          all: "unset", boxSizing: "border-box", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 16,
                          width: "100%", padding: 16, borderRadius: 12,
                          background: "#fbf6ec",
                          border: "1.5px solid var(--border-subtle)",
                          boxShadow: "var(--paper-shadow)",
                          marginBottom: 16, transition: "transform 0.1s ease, box-shadow 0.15s ease",
                        }}
                        onPointerDown={e => e.currentTarget.style.transform = "scale(0.98)"}
                        onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
                        onPointerLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      >
                        {featured.images?.[0] && (
                          <img src={featured.images[0].url} alt="" style={{
                            width: 72, height: 72, borderRadius: 8, flexShrink: 0,
                            objectFit: "cover", border: "1.5px solid var(--border-subtle)",
                          }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: "inline-block",
                            fontFamily: FM, fontSize: 8.5, letterSpacing: 1, fontWeight: 800,
                            background: "#274e37", color: "#ffffff", padding: "2px 8px", borderRadius: 99,
                            marginBottom: 6, textTransform: "uppercase",
                          }}>FEATURED PLAYLIST</div>
                          <div style={{
                            fontFamily: FF, fontSize: 15, fontWeight: 900,
                            color: "var(--text-primary)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{featured.name}</div>
                          <div style={{
                            fontFamily: FM, fontSize: 12, color: "var(--text-muted)", marginTop: 4,
                            display: "flex", alignItems: "center", gap: 8,
                          }}>
                            <span style={{
                              fontFamily: FM, fontSize: 12, color: "var(--text-primary)", fontWeight: 800,
                            }}>{featured.tracks?.total || 0}</span>
                            <span>tracks</span>
                          </div>
                        </div>
                        {getPlayedCount(featured) > 0 ? (
                          <CompletionRing played={getPlayedCount(featured)} total={featured.tracks?.total || 0} size={40} />
                        ) : (
                          <div style={{
                            width: 38, height: 38, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "#ebdcc4", color: "var(--text-primary)", border: "1.5px solid var(--border-subtle)",
                            fontSize: 15, flexShrink: 0, boxShadow: "var(--paper-shadow-sm)"
                          }}>▶</div>
                        )}
                      </button>
                    )}

                    {/* Spotify playlists grid */}
                    {restPlaylists.length > 0 ? (
                      <div className="library-playlist-grid" style={{
                        display: "grid",
                        gap: 12,
                      }}>
                        {restPlaylists.map((p, i) => {
                          const tint = TINTS[i % TINTS.length];
                          const trackCount = p.tracks?.total || 0;
                          return (
                            <button key={p.id} onClick={() => onSelectPlaylist(p)}
                              style={{
                                all: "unset", boxSizing: "border-box", cursor: "pointer",
                                padding: 10, borderRadius: 10,
                                background: tint,
                                border: "1.5px solid var(--border-subtle)",
                                boxShadow: "var(--paper-shadow-sm)",
                                transition: "transform 0.1s ease, box-shadow 0.15s ease",
                              }}
                              onPointerDown={e => e.currentTarget.style.transform = "scale(0.97)"}
                              onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
                              onPointerLeave={e => e.currentTarget.style.transform = "scale(1)"}
                            >
                              {p.images?.[0] ? (
                                <img src={p.images[0].url} alt="" loading="lazy" style={{
                                  width: "100%", borderRadius: 6, display: "block",
                                  aspectRatio: "1", marginBottom: 8, objectFit: "cover",
                                  border: "1px solid rgba(43,35,28,0.25)"
                                }} />
                              ) : (
                                <div style={{
                                  width: "100%", aspectRatio: "1", borderRadius: 6,
                                  background: "#cbb89b", display: "grid", placeItems: "center",
                                  marginBottom: 8, fontSize: 24
                                }}>🎵</div>
                              )}
                              <div style={{
                                fontFamily: FM, fontSize: 11.5, fontWeight: 700,
                                color: "var(--text-primary)",
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>{p.name}</div>

                              <div style={{
                                display: "flex", alignItems: "center", gap: 6, marginTop: 6,
                              }}>
                                <span style={{
                                  fontFamily: FM, fontSize: 10.5, color: "var(--text-primary)", fontWeight: 800,
                                }}>{trackCount}</span>
                                <span style={{
                                  fontSize: 9.5, color: "var(--text-muted)", fontFamily: FM,
                                }}>tracks</span>
                                <div style={{ marginLeft: "auto" }}>
                                  <CompletionRing played={getPlayedCount(p)} total={trackCount} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : !featured && (
                      <div className="empty-playlists-box" style={{
                        padding: "24px 16px",
                        textAlign: "center",
                        background: "#fbf6ec",
                        border: "1.5px dashed #2b231c",
                        borderRadius: 12,
                        boxShadow: "var(--paper-shadow-sm)",
                      }}>
                        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.7 }}>📋</div>
                        <strong style={{ fontFamily: FF, fontSize: 13, letterSpacing: 0.5, color: "var(--text-primary)", display: "block" }}>
                          NO PLAYLISTS AVAILABLE
                        </strong>
                        <p style={{ margin: "6px 0 14px", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>
                          No music playlists were found in your Spotify account.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="library-connect-card">
                    <div style={{ fontSize: 32, marginBottom: 8 }}>☁️</div>
                    <strong style={{ fontFamily: FF, fontSize: 13, letterSpacing: 0.5, color: "var(--text-primary)" }}>
                      CONNECT SPOTIFY FOR CLOUD PLAYLISTS
                    </strong>
                    <p>Log in with Spotify to access all your personal music playlists and synced journeys.</p>
                    <button
                      className="btn-primary"
                      onClick={onConnectSpotify}
                      style={{ padding: "8px 18px", fontSize: 11, letterSpacing: 1 }}
                    >
                      CONNECT SPOTIFY ↗
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Imported Playlists */}
            {playlistSubTab === "imported" && (
              <div className="tab-content-fade">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div className="library-section-title" style={{ margin: 0 }}>
                    <span>OFFLINE PLAYLISTS</span>
                    <span className="playlist-stars">★★★★</span>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => playlistInputRef.current?.click()}
                    style={{ fontSize: 10, padding: "5px 12px", fontFamily: FM, fontWeight: 800 }}
                  >
                    + IMPORT PLAYLIST
                  </button>
                </div>

                {localPlaylists.length > 0 ? (
                  <div className="library-playlist-grid" style={{
                    display: "grid",
                    gap: 12,
                  }}>
                    {localPlaylists.map((pl, idx) => {
                      const trackCount = pl.tracks?.total || pl.tracks?.items?.length || 0;
                      const tint = TINTS[(idx + 2) % TINTS.length];
                      return (
                        <div
                          key={pl.id || idx}
                          style={{
                            position: "relative",
                            padding: 10,
                            borderRadius: 10,
                            background: tint,
                            border: "1.5px solid var(--border-subtle)",
                            boxShadow: "var(--paper-shadow-sm)",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          <button
                            onClick={(e) => handleDeletePlaylist(pl.id, e)}
                            title="Delete imported playlist"
                            aria-label={`Delete ${pl.name}`}
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 22,
                              height: 22,
                              border: "none",
                              background: "rgba(43,35,28,0.12)",
                              borderRadius: "50%",
                              cursor: "pointer",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 10,
                              color: "#2b231c",
                              zIndex: 2,
                            }}
                          >
                            ✕
                          </button>

                          <div
                            onClick={() => onSelectPlaylist(pl)}
                            style={{ cursor: "pointer", width: "100%" }}
                          >
                            <div style={{
                              width: "100%",
                              aspectRatio: "1",
                              borderRadius: 6,
                              background: "#e4cfb5",
                              border: "1px solid rgba(43,35,28,0.25)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              marginBottom: 8,
                              gap: 4,
                            }}>
                              <span style={{ fontSize: 26 }}>📁</span>
                              <span style={{
                                fontFamily: FF,
                                fontSize: 7.5,
                                fontWeight: 900,
                                letterSpacing: 1,
                                color: "#5a4d3f",
                                background: "rgba(255,255,255,0.6)",
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}>LOCAL MIX</span>
                            </div>

                            <div style={{
                              fontFamily: FM,
                              fontSize: 11.5,
                              fontWeight: 800,
                              color: "var(--text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}>
                              {pl.name}
                            </div>

                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginTop: 6,
                            }}>
                              <span style={{ fontFamily: FM, fontSize: 10, color: "var(--text-muted)" }}>
                                <strong style={{ color: "var(--text-primary)" }}>{trackCount}</strong> tracks
                              </span>
                              <span style={{
                                fontFamily: FM,
                                fontSize: 9,
                                fontWeight: 800,
                                color: "#274e37",
                                background: "#ebdcc4",
                                padding: "2px 6px",
                                borderRadius: 4,
                                border: "1px solid var(--border-subtle)"
                              }}>
                                OPEN ▶
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="card-interactive"
                    onClick={() => playlistInputRef.current?.click()}
                    style={{
                      padding: "24px 16px",
                      textAlign: "center",
                      background: "#fbf6ec",
                      border: "1.5px dashed var(--border-subtle)",
                      borderRadius: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                    <strong style={{ fontFamily: FF, fontSize: 12.5, letterSpacing: 0.5, color: "var(--text-primary)", display: "block" }}>
                      IMPORT LOCAL PLAYLIST
                    </strong>
                    <p style={{ margin: "4px 0 12px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Choose audio files from your device (MP3, WAV, FLAC, M4A) to generate an instant offline playlist.
                    </p>
                    <button className="btn-secondary" style={{ pointerEvents: "none", fontSize: 10, padding: "6px 14px" }}>
                      CHOOSE AUDIO FILES ↗
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 2: TRACKS MENU
            (Sub-tabs for Last Few Days, Last Month, Six Months, All Time, Imported)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "tracks" && (
          <div className="tab-content-fade">
            {/* Sub-tabs row */}
            <div className="subtab-row" role="tablist" aria-label="Track time range tabs">
              <button
                className={`subtab-btn ${trackSubTab === "recent" ? "active" : ""}`}
                onClick={() => setTrackSubTab("recent")}
              >
                LAST FEW DAYS
              </button>
              <button
                className={`subtab-btn ${trackSubTab === "short_term" ? "active" : ""}`}
                onClick={() => setTrackSubTab("short_term")}
              >
                LAST MONTH
              </button>
              <button
                className={`subtab-btn ${trackSubTab === "medium_term" ? "active" : ""}`}
                onClick={() => setTrackSubTab("medium_term")}
              >
                SIX MONTHS
              </button>
              <button
                className={`subtab-btn ${trackSubTab === "long_term" ? "active" : ""}`}
                onClick={() => setTrackSubTab("long_term")}
              >
                ALL TIME
              </button>
              <button
                className={`subtab-btn ${trackSubTab === "imported" ? "active" : ""}`}
                onClick={() => setTrackSubTab("imported")}
              >
                IMPORTED {importedTracks.length > 0 ? `(${importedTracks.length})` : ""}
              </button>
            </div>

            {/* Imported Action Bar */}
            {trackSubTab === "imported" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontFamily: FM, fontSize: 11, color: "var(--text-muted)" }}>
                  Local audio files stored on this device
                </span>
                <button
                  className="btn-ghost"
                  onClick={() => trackInputRef.current?.click()}
                  style={{ fontSize: 10, padding: "5px 12px", fontFamily: FM, fontWeight: 800 }}
                >
                  + IMPORT AUDIO
                </button>
              </div>
            )}

            {/* Content for the selected subtab */}
            {loadingTracks && trackSubTab !== "imported" ? (
              <div className="playlists-loading-indicator">
                <span className="spin-slow" style={{ fontSize: 24 }}>♫</span>
                <small>LOADING TRACKS...</small>
              </div>
            ) : !token && trackSubTab !== "imported" ? (
              <div className="library-connect-card">
                <div style={{ fontSize: 28, marginBottom: 6 }}>☁️</div>
                <strong style={{ fontFamily: FF, fontSize: 12.5, letterSpacing: 0.5, color: "var(--text-primary)", display: "block" }}>
                  CONNECT SPOTIFY TO VIEW YOUR TOP TRACKS
                </strong>
                <p>Log in with Spotify to browse your listening history for this period.</p>
                <button className="btn-primary" onClick={onConnectSpotify} style={{ padding: "7px 16px", fontSize: 10.5 }}>
                  CONNECT SPOTIFY ↗
                </button>
              </div>
            ) : currentTracks.length > 0 ? (
              <div className="library-track-grid">
                {currentTracks.map(track => (
                  <LibraryTrackCard
                    key={track.id}
                    track={track}
                    onPickTrack={onPickTrack}
                  />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 16px", background: "#fbf6ec", border: "1.5px dashed var(--border-subtle)", borderRadius: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.6 }}>♫</div>
                <strong style={{ fontFamily: FF, fontSize: 12, color: "var(--text-primary)", display: "block" }}>
                  {trackSubTab === "imported" ? "NO IMPORTED AUDIO FILES" : "NO TRACKS FOUND"}
                </strong>
                <p style={{ margin: "4px 0 12px", fontSize: 11, color: "var(--text-muted)" }}>
                  {trackSubTab === "imported"
                    ? "Import an audio file (MP3, WAV, FLAC, M4A) to play offline without Spotify."
                    : "No top tracks were recorded for this period."}
                </p>
                {trackSubTab === "imported" && (
                  <button className="btn-secondary" onClick={() => trackInputRef.current?.click()} style={{ fontSize: 10, padding: "6px 14px" }}>
                    CHOOSE AUDIO FILE ↗
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 3: COMPLETED RUNS MENU (100% finished songs)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === "completed" && (
          <div className="tab-content-fade">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div className="library-section-title" style={{ margin: 0 }}>
                  <span>COMPLETED RUNS</span>
                  <span className="playlist-stars">★★★★</span>
                </div>
                <div className="library-section-subtitle">Songs you've cleared with 100% completion</div>
              </div>
              <span className="daily-roundup-badge" style={{ background: "#274e37" }}>
                {completedRuns.length} CLEARED
              </span>
            </div>

            {completedRuns.length > 0 ? (
              <div className="completed-runs-grid">
                {completedRuns.map((run, i) => {
                  const ratingColor = RATING_COLORS[run.rating] || "#cf7b52";
                  const albumArt = run.albumArt || run.trackObj?.album?.images?.[0]?.url;
                  return (
                    <div
                      key={run.trackId || i}
                      className="completed-card"
                      onClick={() => {
                        if (run.trackObj && !run.trackObj.localUnavailable) {
                          onPickTrack(run.trackObj);
                        } else if (run.trackId) {
                          onPickTrack({
                            id: run.trackId,
                            name: run.trackName,
                            artists: [{ name: run.artistName || "Unknown Artist" }],
                            album: { images: [{ url: albumArt }] },
                          });
                        }
                      }}
                    >
                      <span className="completed-stamp">✓ 100% CLEAR</span>

                      <div style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: 6,
                        overflow: "hidden",
                        border: `1.5px solid ${ratingColor}`,
                        boxShadow: "var(--paper-shadow-sm)",
                        margin: "18px 0 8px",
                        background: "#ebdcc4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {albumArt ? (
                          <img src={albumArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 26, opacity: 0.65 }}>🏆</span>
                        )}
                      </div>

                      <div style={{
                        fontFamily: FM,
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%",
                        marginBottom: 2,
                      }}>
                        {run.trackName || "Completed Track"}
                      </div>

                      <div style={{
                        fontFamily: FM,
                        fontSize: 8.5,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        width: "100%",
                        marginBottom: 6,
                      }}>
                        {run.artistName || "Artist"}
                      </div>

                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "4px 6px",
                        background: "#ebdcc4",
                        borderRadius: 6,
                        border: "1px solid var(--border-subtle)",
                      }}>
                        <span style={{
                          fontFamily: FF,
                          fontSize: 9.5,
                          fontWeight: 900,
                          color: ratingColor,
                        }}>
                          {run.rating || "A"}
                        </span>
                        <span style={{
                          fontFamily: FM,
                          fontSize: 9,
                          fontWeight: 800,
                          color: "var(--text-primary)",
                        }}>
                          {formatScorePoints(run)}
                        </span>
                      </div>

                      <button
                        style={{
                          all: "unset",
                          marginTop: 8,
                          padding: "3px 10px",
                          borderRadius: 4,
                          background: "#274e37",
                          color: "#ffffff",
                          fontSize: 8.5,
                          fontFamily: FF,
                          fontWeight: 900,
                          letterSpacing: 0.5,
                          boxShadow: "1px 1px 0 #1a3324",
                        }}
                      >
                        REPLAY ▶
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="card-interactive"
                onClick={() => setActiveTab("tracks")}
                style={{
                  padding: "30px 16px",
                  textAlign: "center",
                  background: "#fbf6ec",
                  border: "1.5px dashed var(--border-subtle)",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                <strong style={{ fontFamily: FF, fontSize: 13, letterSpacing: 0.5, color: "var(--text-primary)", display: "block" }}>
                  NO COMPLETED RUNS YET
                </strong>
                <p style={{ margin: "6px 0 14px", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>
                  Fly through any track from beginning to end with 100% completion to add it to your Hall of Fame!
                </p>
                <button className="btn-secondary" style={{ pointerEvents: "none", fontSize: 10, padding: "6px 14px" }}>
                  CHOOSE A TRACK TO PLAY ↗
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
