# Web pivot: music-provider decision

**Reviewed:** 16 August 2026

**Decision:** Local files are the primary audio and full-analysis path. ListenBrainz and Last.fm form the taste layer. The existing Spotify integration remains a private, replaceable playback experiment for catalog matches.

## Executive answer

Moving to the web removes Android WebView and protected-media friction, but it does not make Spotify a viable public foundation for a music game. Spotify's current Developer Policy explicitly prohibits games, synchronization of Spotify recordings with visual media, and overlapping Spotify content with other audio. Its Audio Analysis and Audio Features endpoints are also deprecated.

Last.fm and ListenBrainz are useful for answering “what music does this player like?” They do not provide playable recordings, beat/downbeat/section analysis, or synchronization rights. ListenBrainz contributes public top-recording history and MusicBrainz identifiers; Last.fm contributes top tracks and metadata enrichment when an API key is configured.

Therefore Spotify and Last.fm are not competing level-generation providers:

| Capability | Spotify | Last.fm | ListenBrainz |
|---|---|---|---|
| Listening identity | Strong library, playlist, and playback context | Strong scrobble history, top/loved tracks, and tags | Strong open listening history and recording IDs |
| Full-track playback | Premium-only Web Playback SDK | Not provided by the API | Not provided by the API |
| Beat/bar/section timestamps | Deprecated Audio Analysis endpoint; unreliable for new/development access | Not provided | Not provided |
| BPM/energy features | Deprecated Audio Features endpoint | Not provided | Not provided |
| Public game permission | Explicitly prohibited without written approval | API data only; separate playback and music rights still required | Metadata/history only; separate playback and rights still required |
| Best role in Flappyfy | Private prototype adapter | Taste and local-file metadata adapter | Taste/import adapter |

## What the web game should do

Separate the product into four provider contracts:

1. `ListeningIdentityProvider` — recent, loved, top, and playlist tracks.
2. `CatalogRightsProvider` — resolves a recording and confirms territory/game/synchronization rights.
3. `PlaybackProvider` — prepare, start, pause, seek, stop, and report position.
4. `AnalysisProvider` — returns beat, downbeat, section, and feature data with provenance and a version.

The current browser prototype already has the beginnings of this separation: playback timing is isolated from deterministic world transport, and charts are produced before a run. The next implementation phase should formalize those boundaries before adding a second catalog.

## Recommended level-generation order

1. Use provider-authored full-track timing only when the provider supplies it under terms that permit this game.
2. Analyze audio bytes in the browser or backend only when Flappyfy has lawful access to those bytes and permission to create the gameplay map.
3. Allow creator-uploaded or directly licensed music, which can be analyzed with a versioned engine such as Essentia.
4. Use a clearly labeled estimated chart only as a prototype fallback. Never present a generic map as if it came from the song.

The web UI now records and displays chart provenance as one of:

- `FULL AUDIO MAP` for complete user-selected files
- `FULL-TRACK RHYTHM MAP`
- `PREVIEW-DERIVED MAP`
- `TEMPO-GUIDED MAP`
- `ESTIMATED RHYTHM MAP`

## Recommendation

The private milestone now implements this split. Next, replace the Spotify experiment with a provider or catalog agreement that explicitly permits games and synchronization. SoundCloud streaming is not that replacement under its current public API rules: SoundCloud says games, downloading, and storing content are not permitted uses, although its API terms allow narrowly necessary session caching for otherwise permitted apps. YouTube conversion is also excluded because YouTube prohibits downloading, caching, or separating its audiovisual content without written approval.

## Primary sources

- [Spotify Developer Policy](https://developer.spotify.com/policy)
- [Spotify compliance guidance](https://developer.spotify.com/compliance-tips)
- [Spotify Audio Analysis reference](https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis)
- [Spotify Audio Features reference](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)
- [Spotify February 2026 development-mode migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Last.fm API overview](https://www.last.fm/api)
- [Last.fm API terms](https://www.last.fm/api/tos)
- [Last.fm top tracks endpoint](https://www.last.fm/api/show/user.getTopTracks)
- [Last.fm recent tracks endpoint](https://www.last.fm/api/show/user.getRecentTracks)
- [ListenBrainz user recording statistics](https://listenbrainz.readthedocs.io/en/latest/users/api/statistics.html)
- [SoundCloud public API usage](https://help.soundcloud.com/hc/en-us/articles/115003446727-SoundCloud-public-APIs)
- [SoundCloud API terms](https://developers.soundcloud.com/docs/api/terms-of-use)
- [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

This is a product and technical recommendation, not legal advice. A public launch using commercial recordings needs review of the signed provider and rightsholder agreements for the exact gameplay, capture, and monetization flows.
