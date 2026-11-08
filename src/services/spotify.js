// Spotify API service wrapper
// Centralizes all Spotify Web API calls

const headersFor = (token) => ({ Authorization: `Bearer ${token}` });

async function getPagedItems(token, initialUrl, maxItems) {
  const items = [];
  let nextUrl = initialUrl;
  try {
    while (nextUrl && items.length < maxItems) {
      const response = await fetch(nextUrl, { headers: headersFor(token) });
      if (!response.ok) {
        console.warn(`[Spotify API] ${response.status} for ${nextUrl}`);
        break;
      }
      const page = await response.json();
      items.push(...(page.items || []));
      nextUrl = page.next || null;
    }
  } catch (error) {
    console.warn("[Spotify API] paged request failed", error);
  }
  return items.slice(0, maxItems);
}

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

export async function getTopTracks(token, timeRange = "short_term", limit = 100) {
  const pageSize = Math.min(50, Math.max(1, limit));
  return getPagedItems(
    token,
    `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${pageSize}`,
    limit
  );
}

export async function searchTracks(token, query, limit = 30) {
  if (!query.trim()) return [];
  try {
    const pageSize = Math.min(50, Math.max(1, limit));
    const res = await fetch(
      `https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}&limit=${pageSize}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks?.items || [];
  } catch { return []; }
}

export async function getPlaylists(token, limit = 200) {
  const pageSize = Math.min(50, limit);
  const items = await getPagedItems(token, `https://api.spotify.com/v1/me/playlists?limit=${pageSize}`, limit);
  return items.filter(p => {
    if (!p || !p.name) return false;
    const name = p.name.toLowerCase();
    const desc = (p.description || "").toLowerCase();
    const id = String(p.id || "").toLowerCase();
    // Filter out episodes, podcasts, audiobooks, daily roundups, and legacy mock terms
    if (name.includes("fitness") || id.includes("fitness")) return false;
    if (name.includes("roundup") || id.includes("roundup") || desc.includes("roundup")) return false;
    if (name.includes("episode") || name.includes("podcast") || name.includes("audiobook")) return false;
    if (desc.includes("podcast") || desc.includes("episode") || desc.includes("audiobook") || desc.includes("fitness")) return false;
    return true;
  });
}

export async function getFeaturedPlaylists(token, limit = 20) {
  try {
    const res = await fetch(`https://api.spotify.com/v1/browse/featured-playlists?limit=${limit}`, {
      headers: headersFor(token),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.playlists?.items || []).filter(p => {
      if (!p || !p.name) return false;
      const name = p.name.toLowerCase();
      const id = String(p.id || "").toLowerCase();
      if (name.includes("fitness") || id.includes("fitness")) return false;
      if (name.includes("roundup") || id.includes("roundup")) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export async function getRecentlyPlayed(token, limit = 50) {
  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
      headers: headersFor(token),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(item => ({
      ...item.track,
      played_at: item.played_at,
    })).filter(t => t && t.id);
  } catch {
    return [];
  }
}

export async function getPlaylistTracks(token, playlistId, limit = 500) {
  const pageSize = Math.min(50, limit);
  const entries = await getPagedItems(
    token,
    `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=${pageSize}`,
    limit,
  );
  return entries
    .map(entry => entry.item || entry.track)
    .filter(item => item?.type === "track" && item.id && item.uri);
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
