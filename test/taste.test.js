import test from "node:test";
import assert from "node:assert/strict";
import {
  enrichLocalTrackMetadata,
  mergeTasteTracks,
  normalizeLastFmUserInput,
  normalizeListenBrainzUserInput,
  normalizeSpotifyTasteTracks,
  parseLocalFileName,
} from "../src/services/taste.js";

test("local filenames provide a useful artist and title fallback", () => {
  assert.deepEqual(parseLocalFileName("Little Simz - Gorilla.mp3"), {
    artist: "Little Simz",
    title: "Gorilla",
  });
  assert.deepEqual(parseLocalFileName("untagged_song.wav"), {
    artist: "Local file",
    title: "untagged song",
  });
  assert.deepEqual(parseLocalFileName("01 - Little Simz - Gorilla.mp3"), {
    artist: "Little Simz",
    title: "Gorilla",
  });
});

test("local MP3 uploads use embedded cover art before external providers", async () => {
  const imageBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const mime = new TextEncoder().encode("image/png");
  const payload = Uint8Array.from([0, ...mime, 0, 3, 0, ...imageBytes]);
  const frameSize = payload.length;
  const frame = Uint8Array.from([
    ...new TextEncoder().encode("APIC"),
    (frameSize >>> 24) & 0xff,
    (frameSize >>> 16) & 0xff,
    (frameSize >>> 8) & 0xff,
    frameSize & 0xff,
    0,
    0,
    ...payload,
  ]);
  const tagSize = frame.length;
  const header = Uint8Array.from([
    73,
    68,
    51,
    3,
    0,
    0,
    (tagSize >>> 21) & 0x7f,
    (tagSize >>> 14) & 0x7f,
    (tagSize >>> 7) & 0x7f,
    tagSize & 0x7f,
  ]);
  const file = new File([header, frame], "Little Simz - Gorilla.mp3", { type: "audio/mpeg" });

  const metadata = await enrichLocalTrackMetadata(file, {}, {});
  assert.match(metadata.image, /^data:image\/png;base64,/);
  assert.equal(metadata.matchSource, "Embedded artwork");
});

test("taste sources merge duplicate recordings without losing provenance", () => {
  const merged = mergeTasteTracks([
    [{ id: "lb:1", title: "Gorilla", artist: "Little Simz", source: "ListenBrainz", listenCount: 8 }],
    [{ id: "lfm:1", title: "Gorilla", artist: "Little Simz", source: "Last.fm", listenCount: 12 }],
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources, ["ListenBrainz", "Last.fm"]);
  assert.equal(merged[0].listenCount, 12);
});

test("taste profile inputs accept profile links as well as usernames", () => {
  assert.equal(normalizeListenBrainzUserInput("https://listenbrainz.org/user/flappy%20fan/"), "flappy fan");
  assert.equal(normalizeListenBrainzUserInput("https://musicbrainz.org/user/flappyfan"), "flappyfan");
  assert.equal(normalizeLastFmUserInput("https://www.last.fm/user/flappyfan/library"), "flappyfan");
  assert.equal(normalizeLastFmUserInput("plain-user"), "plain-user");
});

test("Spotify top tracks can feed the provider-neutral taste rail", () => {
  const [track] = normalizeSpotifyTasteTracks([{
    id: "spotify-id",
    name: "Gorilla",
    popularity: 72,
    artists: [{ name: "Little Simz" }],
    album: { name: "NO THANK YOU", images: [{ url: "cover.jpg" }] },
  }]);
  assert.equal(track.source, "Spotify");
  assert.equal(track.artist, "Little Simz");
  assert.equal(track.image, "cover.jpg");
  assert.equal(track.spotifyTrack.id, "spotify-id");
});

test("local uploads use a reliable Spotify match for track details and artwork", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    assert.match(String(url), /api\.spotify\.com\/v1\/search/);
    return {
      ok: true,
      json: async () => ({
        tracks: {
          items: [{
            id: "spotify-id",
            name: "Gorilla",
            duration_ms: 245000,
            artists: [{ name: "Little Simz" }],
            album: { name: "NO THANK YOU", images: [{ url: "spotify-cover.jpg" }] },
          }],
        },
      }),
    };
  };

  const metadata = await enrichLocalTrackMetadata(
    "Little Simz - Gorilla.mp3",
    {},
    { spotifyToken: "test-token", durationMs: 245000 },
  );
  assert.equal(metadata.image, "spotify-cover.jpg");
  assert.equal(metadata.album, "NO THANK YOU");
  assert.equal(metadata.matchSource, "Spotify match");
});

test("local uploads broaden Spotify search when a strict query has no match", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const queries = [];
  globalThis.fetch = async url => {
    const parsed = new URL(String(url));
    queries.push(parsed.searchParams.get("q"));
    const found = queries.length > 1;
    return {
      ok: true,
      json: async () => ({
        tracks: {
          items: found ? [{
            id: "spotify-id",
            name: "Gorilla",
            duration_ms: 245000,
            artists: [{ name: "Little Simz" }],
            album: { name: "NO THANK YOU", images: [{ url: "spotify-cover.jpg" }] },
          }] : [],
        },
      }),
    };
  };

  const metadata = await enrichLocalTrackMetadata(
    "Little Simz - Gorilla.mp3",
    {},
    { spotifyToken: "test-token", durationMs: 245000 },
  );
  assert.equal(queries.length, 2);
  assert.equal(metadata.image, "spotify-cover.jpg");
});

test("local uploads fall back to MusicBrainz cover art without accepting an unrelated song", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    assert.match(String(url), /musicbrainz\.org\/ws\/2\/recording/);
    return {
      ok: true,
      json: async () => ({
        recordings: [{
          id: "recording-id",
          score: 100,
          title: "Gorilla",
          length: 245000,
          "artist-credit": [{ artist: { name: "Little Simz" } }],
          releases: [{
            id: "release-id",
            title: "NO THANK YOU",
            status: "Official",
            "release-group": { id: "release-group-id" },
          }],
        }],
      }),
    };
  };

  const metadata = await enrichLocalTrackMetadata(
    "Little Simz - Gorilla.mp3",
    {},
    { durationMs: 245000 },
  );
  assert.equal(metadata.image, "https://coverartarchive.org/release-group/release-group-id/front-500");
  assert.equal(metadata.matchSource, "MusicBrainz + Cover Art Archive");
});
