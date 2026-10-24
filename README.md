# HOUSE THIS.

A responsive artwork collection for Kratex's SoundCloud playlist. Uses Helvetica Neue, CSS 3D record sleeves, and SoundCloud's official Widget API. No API key or build dependencies are required.

The brand theme uses charcoal and the reference artwork's exact green (`#8DFF00`). Only the HOUSE THIS wordmarks use the locally installed Helvetica Neue Condensed Bold face with tight tracking; all other text uses normal Helvetica Neue. Devices without that local face use a condensed fallback silhouette. Theme rules live in `dist/brand.css`.

## Run

```sh
npm run dev
```

Open http://127.0.0.1:4173. Deploy the `dist` directory to a static host, or publish through the Sites workflow using `.openai/hosting.json`.

## Behavior

- On a desktop pointer, hovering opens a record; clicking starts playback.
- On touchscreens, the first tap opens a record; the second plays it.
- The player appears at the bottom left on desktop and sticks to the bottom on phones. Play/pause, next, previous, seeking, and device media controls use real SoundCloud playback events.
- The official playlist widget retrieves current track titles and artwork on every load. A separate, nonplaying widget checks every five minutes and when the tab is revisited. This never interrupts current playback.
- `dist/playlist.json` is a public metadata snapshot for first paint and connection failures. The most recently fetched collection is cached locally. The live indicator only appears after a successful widget response.
- SoundCloud controls track availability, region restrictions, and streaming. If a browser blocks autoplay, press the player's play button. Clicking the track title opens its original SoundCloud page.

The playlist URL is declared in `dist/app.js`; public source links also appear in `dist/index.html`. Artwork is loaded directly from SoundCloud's image CDN and sampled in the browser to color each record spine. No media stream is downloaded or rehosted.
