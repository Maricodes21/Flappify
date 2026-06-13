// Spotify API service wrapper
// Centralizes all Spotify Web API calls

export async function getCurrentlyPlaying(token) {
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 204) return null; // nothing playing
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.item) return null;
    return {
      track: data.item,
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms
    };
  } catch { return null; }
}

export async function getTopTracks(token, timeRange = "short_term", limit = 20) {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

export async function searchTracks(token, query, limit = 20) {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks?.items || [];
  } catch { return []; }
}

export async function getPlaylists(token, limit = 50) {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/me/playlists?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

export async function getPlaylistTracks(token, playlistId, limit = 50) {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).filter(i => i.track).map(i => i.track);
  } catch { return []; }
}

export async function getAudioFeatures(token, trackId) {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function getAudioAnalysis(token, trackId) {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/audio-analysis/${trackId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function getUserProfile(token) {
  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
