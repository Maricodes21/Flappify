import { searchTracks } from "./spotify.js";

const STORAGE_KEY = "sf_taste_profiles";
const LISTENBRAINZ_API = "https://api.listenbrainz.org/1";
const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";
const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE = "https://coverartarchive.org";

const clean = value => String(value || "").trim();

export function getTasteProfiles() {
  const defaults = {
    useSpotifyTaste: true,
    listenBrainzUser: "",
    lastFmUser: "",
    lastFmApiKey: import.meta.env?.VITE_LASTFM_API_KEY || "",
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaults;
  }
}

function profileNameFromUrl(value, hosts) {
  const input = clean(value);
  if (!input) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return input;
    const parts = url.pathname.split("/").filter(Boolean);
    const userIndex = parts.findIndex(part => part.toLocaleLowerCase() === "user");
    return decodeURIComponent(userIndex >= 0 ? parts[userIndex + 1] || "" : parts[0] || "").trim();
  } catch {
    return input;
  }
}

export function normalizeListenBrainzUserInput(value) {
  return profileNameFromUrl(value, ["listenbrainz.org", "musicbrainz.org"]);
}

export function normalizeLastFmUserInput(value) {
  return profileNameFromUrl(value, ["last.fm"]);
}

export function saveTasteProfiles(profiles) {
  const normalized = {
    useSpotifyTaste: profiles.useSpotifyTaste !== false,
    // ListenBrainz remains supported by the provider-neutral service, but the
    // private build deliberately exposes only Spotify and Last.fm for taste.
    listenBrainzUser: "",
    lastFmUser: normalizeLastFmUserInput(profiles.lastFmUser),
    lastFmApiKey: clean(profiles.lastFmApiKey) || clean(import.meta.env?.VITE_LASTFM_API_KEY),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function normalizeSpotifyTasteTracks(tracks = []) {
  return tracks.map(track => ({
    id: `spotify:${track.id}`,
    title: clean(track.name),
    artist: clean(track.artists?.map(artist => artist.name).join(", ")),
    album: clean(track.album?.name),
    image: track.album?.images?.[0]?.url || "",
    listenCount: Number(track.popularity || 0),
    source: "Spotify",
    spotifyTrack: track,
  }));
}

export function parseLocalFileName(fileName) {
  const base = clean(fileName)
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/_/g, " ")
    .replace(/^\s*\d{1,3}\s*(?:[.]\s*|-\s+)/, "")
    .trim();
  const parts = base.split(/\s+(?:-|–|—)\s+/).map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(" - ") };
  }
  return { artist: "Local file", title: base || "Untitled track" };
}

function bytesToDataUrl(bytes, mimeType) {
  if (!bytes?.length || !/^image\//i.test(mimeType)) return "";
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  try {
    return `data:${mimeType};base64,${btoa(binary)}`;
  } catch {
    return "";
  }
}

function readApicArtwork(frame) {
  if (frame.length < 8) return "";
  const encoding = frame[0];
  const mimeEnd = frame.indexOf(0, 1);
  if (mimeEnd < 2 || mimeEnd + 2 >= frame.length) return "";
  const mimeType = new TextDecoder("iso-8859-1").decode(frame.slice(1, mimeEnd)).trim();
  const descriptionStart = mimeEnd + 2;
  let imageStart = -1;
  if (encoding === 1 || encoding === 2) {
    for (let index = descriptionStart; index + 1 < frame.length; index++) {
      if (frame[index] === 0 && frame[index + 1] === 0) {
        imageStart = index + 2;
        break;
      }
    }
  } else {
    const descriptionEnd = frame.indexOf(0, descriptionStart);
    if (descriptionEnd >= 0) imageStart = descriptionEnd + 1;
  }
  if (imageStart < 0 || imageStart >= frame.length) return "";
  return bytesToDataUrl(frame.slice(imageStart), mimeType);
}

function decodeId3Text(bytes, encoding) {
  if (!bytes.length) return "";
  try {
    if (encoding === 0) return new TextDecoder("iso-8859-1").decode(bytes).replace(/\0/g, "").trim();
    if (encoding === 3) return new TextDecoder("utf-8").decode(bytes).replace(/\0/g, "").trim();
    if (encoding === 1) {
      const littleEndian = bytes[0] === 0xff && bytes[1] === 0xfe;
      const content = (bytes[0] === 0xff || bytes[0] === 0xfe) ? bytes.slice(2) : bytes;
      return new TextDecoder(littleEndian ? "utf-16le" : "utf-16be").decode(content).replace(/\0/g, "").trim();
    }
    return new TextDecoder("utf-16be").decode(bytes).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

async function readId3Metadata(file) {
  if (!file?.slice || !/\.mp3$/i.test(file.name)) return {};
  try {
    const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (header.length < 10 || String.fromCharCode(...header.slice(0, 3)) !== "ID3") return {};
    const version = header[3];
    const tagSize = ((header[6] & 0x7f) << 21) | ((header[7] & 0x7f) << 14) | ((header[8] & 0x7f) << 7) | (header[9] & 0x7f);
    const bytesToRead = Math.min(file.size, tagSize + 10, 4 * 1024 * 1024);
    const bytes = new Uint8Array(await file.slice(0, bytesToRead).arrayBuffer());
    const tags = {};
    let image = "";
    for (let offset = 10; offset + 10 <= Math.min(bytes.length, tagSize + 10);) {
      const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const rawSize = version === 4
        ? ((bytes[offset + 4] & 0x7f) << 21) | ((bytes[offset + 5] & 0x7f) << 14) | ((bytes[offset + 6] & 0x7f) << 7) | (bytes[offset + 7] & 0x7f)
        : (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
      const frameSize = rawSize >>> 0;
      if (!frameSize || offset + 10 + frameSize > bytes.length) break;
      if (id === "TIT2" || id === "TPE1" || id === "TALB") {
        const frame = bytes.slice(offset + 10, offset + 10 + frameSize);
        const value = decodeId3Text(frame.slice(1), frame[0]);
        if (value) tags[id] = value;
      } else if (id === "APIC" && !image) {
        image = readApicArtwork(bytes.slice(offset + 10, offset + 10 + frameSize));
      }
      offset += 10 + frameSize;
    }
    return { title: tags.TIT2, artist: tags.TPE1, album: tags.TALB, image };
  } catch {
    return {};
  }
}

function normalizeListenBrainz(recording) {
  return {
    id: `listenbrainz:${recording.recording_mbid || `${recording.artist_name}:${recording.track_name}`}`,
    title: clean(recording.track_name),
    artist: clean(recording.artist_name),
    album: clean(recording.release_name),
    image: "",
    listenCount: Number(recording.listen_count || 0),
    source: "ListenBrainz",
    recordingMbid: clean(recording.recording_mbid),
  };
}

function normalizeLastFm(track) {
  const images = Array.isArray(track.image) ? track.image : [];
  const image = [...images].reverse().find(item => clean(item?.["#text"]))?.["#text"] || "";
  return {
    id: `lastfm:${track.mbid || `${track.artist?.name || track.artist}:${track.name}`}`,
    title: clean(track.name),
    artist: clean(track.artist?.name || track.artist),
    album: "",
    image,
    listenCount: Number(track.playcount || 0),
    source: "Last.fm",
    recordingMbid: clean(track.mbid),
  };
}

export function mergeTasteTracks(groups, limit = 18) {
  const seen = new Map();
  for (const track of groups.flat()) {
    if (!track?.title || !track?.artist) continue;
    const key = `${track.artist}::${track.title}`.toLocaleLowerCase();
    const existing = seen.get(key);
    if (existing) {
      existing.sources = [...new Set([...(existing.sources || [existing.source]), track.source])];
      existing.listenCount = Math.max(existing.listenCount || 0, track.listenCount || 0);
      if (!existing.image && track.image) existing.image = track.image;
    } else {
      seen.set(key, { ...track, sources: [track.source] });
    }
  }
  return [...seen.values()]
    .sort((a, b) => (b.listenCount || 0) - (a.listenCount || 0))
    .slice(0, limit);
}

async function getListenBrainzTopTracks(userName, limit) {
  if (!clean(userName)) return [];
  const response = await fetch(
    `${LISTENBRAINZ_API}/stats/user/${encodeURIComponent(clean(userName))}/recordings?count=${Math.min(100, limit)}&range=all_time`,
  );
  if (!response.ok) throw new Error(`ListenBrainz returned ${response.status}`);
  const data = await response.json();
  return (data.payload?.recordings || []).map(normalizeListenBrainz);
}

async function getLastFmTopTracks(userName, apiKey, limit) {
  if (!clean(userName) || !clean(apiKey)) return [];
  const params = new URLSearchParams({
    method: "user.gettoptracks",
    user: clean(userName),
    api_key: clean(apiKey),
    period: "6month",
    limit: String(Math.min(100, limit)),
    format: "json",
  });
  const response = await fetch(`${LASTFM_API}?${params}`);
  if (!response.ok) throw new Error(`Last.fm returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.message || "Last.fm could not load this profile");
  return (data.toptracks?.track || []).map(normalizeLastFm);
}

export async function getTasteTracks(profiles, limit = 18) {
  const requests = [];
  if (clean(profiles.listenBrainzUser)) {
    requests.push(getListenBrainzTopTracks(profiles.listenBrainzUser, limit));
  }
  if (clean(profiles.lastFmUser) && clean(profiles.lastFmApiKey)) {
    requests.push(getLastFmTopTracks(profiles.lastFmUser, profiles.lastFmApiKey, limit));
  }
  if (!requests.length) return [];

  const results = await Promise.allSettled(requests);
  const successful = results.filter(result => result.status === "fulfilled").map(result => result.value);
  if (!successful.length) {
    throw results.find(result => result.status === "rejected")?.reason || new Error("Taste profiles could not be loaded");
  }
  return mergeTasteTracks(successful, limit);
}

function normalizedMatch(value) {
  return clean(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasUsefulArtist(value) {
  const normalized = normalizedMatch(value);
  return Boolean(
    normalized
    && !["local file", "unknown artist", "various artists", "artist"].includes(normalized)
    && !/^\d+$/.test(normalized),
  );
}

function metadataMatchQuality(candidate, identified, durationMs = 0) {
  const wantedTitle = normalizedMatch(identified.title);
  const candidateTitle = normalizedMatch(candidate.title || candidate.name);
  const wantedArtist = normalizedMatch(identified.artist);
  const artistKnown = hasUsefulArtist(identified.artist);
  const candidateArtists = (candidate.artists || [])
    .map(artist => normalizedMatch(typeof artist === "string" ? artist : artist?.name))
    .filter(Boolean);

  const titleExact = Boolean(wantedTitle && candidateTitle === wantedTitle);
  const titleClose = Boolean(
    wantedTitle
    && candidateTitle
    && (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)),
  );
  const artistExact = artistKnown && candidateArtists.some(artist => artist === wantedArtist);
  const artistClose = artistKnown && candidateArtists.some(artist => (
    artist.includes(wantedArtist) || wantedArtist.includes(artist)
  ));
  let score = titleExact ? 6 : titleClose ? 3 : 0;
  if (artistKnown) score += artistExact ? 6 : artistClose ? 3 : 0;

  const candidateDuration = Number(candidate.durationMs || candidate.duration_ms || candidate.length || 0);
  if (durationMs > 0 && candidateDuration > 0) {
    const difference = Math.abs(candidateDuration - durationMs);
    if (difference <= 4_000) score += 2;
    else if (difference <= 12_000) score += 1;
    else if (difference > 30_000) score -= 2;
  }

  return {
    artistKnown,
    reliable: artistKnown ? score >= 9 : titleExact,
    score,
  };
}

async function matchLocalTrackInSpotify(token, identified, durationMs) {
  if (!clean(token) || !identified.title) return null;
  const artistKnown = hasUsefulArtist(identified.artist);
  const queries = artistKnown
    ? [
      `track:${identified.title} artist:${identified.artist}`,
      `${identified.title} ${identified.artist}`,
      `track:${identified.title}`,
    ]
    : [`track:${identified.title}`, identified.title];
  const candidates = new Map();
  let ranked = [];
  for (const query of [...new Set(queries)]) {
    const tracks = await searchTracks(token, query, 10);
    tracks.forEach(track => candidates.set(track.id || `${track.name}:${track.artists?.[0]?.name}`, track));
    ranked = [...candidates.values()]
      .map(track => ({ track, quality: metadataMatchQuality(track, identified, durationMs) }))
      .filter(item => item.quality.reliable)
      .sort((a, b) => b.quality.score - a.quality.score);
    if (ranked.some(item => item.track.album?.images?.some(image => clean(image?.url)))) break;
  }
  const match = ranked.find(item => item.track.album?.images?.some(image => clean(image?.url)))?.track
    || ranked[0]?.track;
  if (!match) return null;
  return {
    title: clean(match.name) || identified.title,
    artist: clean(match.artists?.map(artist => artist.name).join(", ")) || identified.artist,
    album: clean(match.album?.name) || identified.album,
    image: match.album?.images?.find(image => clean(image?.url))?.url || "",
    matchSource: "Spotify match",
  };
}

async function matchLocalTrackInLastFm(identified, profiles, durationMs) {
  if (!profiles?.lastFmApiKey || normalizedMatch(identified.artist) === "local file") return null;
  try {
    const params = new URLSearchParams({
      method: "track.getInfo",
      api_key: clean(profiles.lastFmApiKey),
      artist: identified.artist,
      track: identified.title,
      autocorrect: "1",
      format: "json",
    });
    const response = await fetch(`${LASTFM_API}?${params}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.track) return null;
    const candidate = {
      title: data.track.name,
      artists: [data.track.artist?.name],
      durationMs: Number(data.track.duration || 0),
    };
    if (!metadataMatchQuality(candidate, identified, durationMs).reliable) return null;
    const images = Array.isArray(data.track.album?.image) ? data.track.album.image : [];
    return {
      title: clean(data.track.name) || identified.title,
      artist: clean(data.track.artist?.name) || identified.artist,
      album: clean(data.track.album?.title) || identified.album,
      image: [...images].reverse().find(item => clean(item?.["#text"]))?.["#text"] || "",
      matchSource: "Last.fm match",
    };
  } catch {
    return null;
  }
}

function escapeMusicBrainzQuery(value) {
  return clean(value).replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, "\\$1");
}

function canLoadBrowserImage(url, timeoutMs = 7_000) {
  if (typeof Image === "undefined") return Promise.resolve(true);
  return new Promise(resolve => {
    const image = new Image();
    const timeout = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(false);
    }, timeoutMs);
    const finish = result => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
  });
}

async function findCoverArtArchiveImage(releases = []) {
  const releaseGroups = [...new Set(releases.map(release => release?.["release-group"]?.id).filter(Boolean))];
  const releaseIds = [...new Set(releases.map(release => release?.id).filter(Boolean))];
  const candidates = [
    ...releaseGroups.slice(0, 3).map(id => `${COVER_ART_ARCHIVE}/release-group/${id}/front-500`),
    ...releaseIds.slice(0, 3).map(id => `${COVER_ART_ARCHIVE}/release/${id}/front-500`),
  ];
  if (!candidates.length) return "";
  const results = await Promise.all(candidates.map(url => canLoadBrowserImage(url)));
  return candidates.find((_, index) => results[index]) || "";
}

async function matchLocalTrackInMusicBrainz(identified, durationMs) {
  if (!identified.title || normalizedMatch(identified.title).length < 2) return null;
  try {
    const artistKnown = normalizedMatch(identified.artist) !== "local file";
    const clauses = [`recording:"${escapeMusicBrainzQuery(identified.title)}"`];
    if (artistKnown) clauses.push(`artist:"${escapeMusicBrainzQuery(identified.artist)}"`);
    const params = new URLSearchParams({ query: clauses.join(" AND "), fmt: "json", limit: "8" });
    const response = await fetch(`${MUSICBRAINZ_API}/recording?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const ranked = (data.recordings || [])
      .map(recording => {
        const artists = (recording["artist-credit"] || [])
          .map(credit => credit?.artist?.name || credit?.name)
          .filter(Boolean);
        const quality = metadataMatchQuality({
          title: recording.title,
          artists,
          durationMs: recording.length,
        }, identified, durationMs);
        return { recording, artists, quality, searchScore: Number(recording.score || 0) };
      })
      .filter(item => item.quality.reliable && item.searchScore >= 80)
      .sort((a, b) => (b.quality.score - a.quality.score) || (b.searchScore - a.searchScore));
    const match = ranked[0];
    if (!match) return null;
    const releases = [...(match.recording.releases || [])].sort((a, b) => {
      const album = normalizedMatch(identified.album);
      const albumDifference = Number(normalizedMatch(b.title) === album) - Number(normalizedMatch(a.title) === album);
      if (albumDifference) return albumDifference;
      return Number(b.status === "Official") - Number(a.status === "Official");
    });
    const image = await findCoverArtArchiveImage(releases);
    return {
      title: clean(match.recording.title) || identified.title,
      artist: clean(match.artists.join(", ")) || identified.artist,
      album: clean(releases[0]?.title) || identified.album,
      image,
      matchSource: image ? "MusicBrainz + Cover Art Archive" : "MusicBrainz match",
    };
  } catch {
    return null;
  }
}

export async function resolveTasteTrackToSpotify(token, tasteTrack) {
  if (!token) return null;
  if (tasteTrack.spotifyTrack) {
    return {
      ...tasteTrack.spotifyTrack,
      playbackProvider: "spotify",
      discoverySource: "Spotify",
      discoveryTrack: tasteTrack,
    };
  }
  const query = `track:${tasteTrack.title} artist:${tasteTrack.artist}`;
  const matches = await searchTracks(token, query, 10);
  if (!matches.length) return null;
  const title = normalizedMatch(tasteTrack.title);
  const artist = normalizedMatch(tasteTrack.artist);
  const ranked = matches.map(track => {
    const titleScore = normalizedMatch(track.name) === title ? 4 : normalizedMatch(track.name).includes(title) ? 2 : 0;
    const artistScore = track.artists?.some(item => normalizedMatch(item.name) === artist) ? 4 : 0;
    return { track, score: titleScore + artistScore };
  }).sort((a, b) => b.score - a.score);
  return {
    ...ranked[0].track,
    playbackProvider: "spotify",
    discoverySource: tasteTrack.sources?.join(" + ") || tasteTrack.source,
    discoveryTrack: tasteTrack,
  };
}

export async function enrichLocalTrackMetadata(fileOrName, profiles, options = {}) {
  const fileName = typeof fileOrName === "string" ? fileOrName : fileOrName?.name;
  const parsed = parseLocalFileName(fileName);
  const embedded = typeof fileOrName === "string" ? {} : await readId3Metadata(fileOrName);
  const identified = {
    title: clean(embedded.title) || parsed.title,
    artist: clean(embedded.artist) || parsed.artist,
    album: clean(embedded.album),
    matchSource: embedded.title || embedded.artist ? "Embedded tags" : "Filename",
  };
  if (embedded.image) {
    return { ...identified, image: embedded.image, matchSource: "Embedded artwork" };
  }
  const durationMs = Number(options.durationMs || 0);
  const spotifyMatch = await matchLocalTrackInSpotify(options.spotifyToken, identified, durationMs);
  if (spotifyMatch?.image) return spotifyMatch;

  const lastFmMatch = await matchLocalTrackInLastFm(identified, profiles, durationMs);
  if (lastFmMatch?.image) return lastFmMatch;

  const musicBrainzMatch = await matchLocalTrackInMusicBrainz(identified, durationMs);
  if (musicBrainzMatch?.image) {
    const catalogMatch = spotifyMatch || lastFmMatch;
    return {
      ...(catalogMatch || musicBrainzMatch),
      image: musicBrainzMatch.image,
      album: catalogMatch?.album || musicBrainzMatch.album,
      matchSource: catalogMatch
        ? `${catalogMatch.matchSource} + Cover Art Archive`
        : musicBrainzMatch.matchSource,
    };
  }
  return spotifyMatch || lastFmMatch || musicBrainzMatch || identified;
}
