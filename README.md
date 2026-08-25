# chesswithprince.com

A single-page chess app. Stockfish 18 runs as WebAssembly in the visitor's browser,
so there is no backend, no server cost, and nothing to scale.

Play at **play.chesswithprince.com** — test your lines against the strongest version
of Stockfish, right in the browser.

```
index.html        the whole app — markup, styles, logic, piece artwork
engine/           Stockfish files (optional, see below)
```

## Run it locally

`file://` won't work — Web Workers and `fetch` require a real origin.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Out of the box the engine loads from jsDelivr, so this works immediately.

## Serve the engine yourself (recommended for production)

Removes the third-party dependency and gives you control over caching.

```bash
npm install stockfish@18.0.8
mkdir -p engine
cp node_modules/stockfish/bin/stockfish-18-lite-single.* engine/
```

`index.html` checks for `engine/stockfish-18-lite-single.js` on load and prefers it
when present, falling back to the CDN otherwise. No code change needed.

The `.wasm` is about 7 MB, so set a long cache lifetime on `engine/*` — visitors
download it once.

## Deploy

Any static host works. Cloudflare Pages is the intended target here:

1. Push this folder to a Git repo (done — this repo).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**,
   point it at this repo. No build command, output directory `/`.
3. Add **play.chesswithprince.com** as a custom domain and follow the DNS instructions.
   Because the apex `chesswithprince.com` already lives on Cloudflare, the `play`
   subdomain is a CNAME that Cloudflare wires up for you. TLS is automatic.

## Features

- Drag-and-drop **and** click-to-move, with a sliding animation
- Legal-move dots, last-move and check highlighting
- Promotion picker
- Evaluation bar (White's perspective), updated while Stockfish searches
- Take-back, board flip, play as White / Black / random
- Engine strength via `UCI_Elo` — top of the slider ("Max") switches
  `UCI_LimitStrength` off for full strength
- Adjustable think time
- **Opening trainer** — pick a main line (French, Sicilian, Ruy Lopez, Italian,
  Caro-Kann, Queen's Gambit, King's Indian, Nimzo, London, and more). The app
  plays the theory for the other side, checks your moves against the book
  (with optional hint highlighting), and hands off to Stockfish when the line
  ends so you play on from the resulting position. Every line is verified legal
  against chess.js.

## Upgrading to the multi-threaded engine

The single-threaded lite build is used deliberately — it needs no special headers
and is already far stronger than any human. If you ever want the multi-threaded
build (`stockfish-18-lite.*`), it requires cross-origin isolation. On Cloudflare
Pages, add a `_headers` file:

```
/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
```

Note this also blocks cross-origin resources that don't opt in, including the
Google Fonts links in `index.html` — you'd need to self-host the fonts.

## Licensing

Stockfish.js is GPLv3. You're distributing it, so keep the license notice in the
footer, don't strip the copyright header from the engine files, and be prepared to
point at the source (linking to github.com/nmrugg/stockfish.js satisfies this).

The piece artwork in `index.html` is original SVG written for this project — no
third-party asset licenses are involved.

## Notes

- `chess.js` handles rules and is loaded from esm.sh. To pin it locally,
  download the module and change the import at the top of the script block.
- The evaluation bar only updates while Stockfish is searching, which is on its
  own turn. That's intentional: analysing on your turn would double CPU use and
  quietly hand you the best move.
- Cross-origin engine loading uses a blob-shim worker: the real `.wasm` URL is
  passed in the worker URL's hash fragment and resolved through `Module.locateFile`.
