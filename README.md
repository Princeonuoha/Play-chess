# chesswithprince.com

A single-page chess app. Stockfish 18 runs as WebAssembly in the visitor's browser,
so there is no backend, no server cost, and nothing to scale.

Play at **play.chesswithprince.com** — test your lines against the strongest version
of Stockfish, right in the browser.

```
web/              the app — React + TypeScript + Tailwind (Vite)
  src/core/       framework-agnostic engine + board + trainer + review controller
  src/App.tsx     the UI (Play / Openings / Games / Study)
dist/             built, deployable output (committed; wrangler serves this)
engine/           self-hosted Stockfish files (copied into dist on build)
index.html        the original single-file app (kept for reference; not deployed)
```

## Run it locally

```bash
cd web
npm install
npm run dev        # Vite dev server, http://localhost:5173
```

Or build and serve the production bundle exactly as it deploys:

```bash
npm --prefix web run build   # writes dist/ (app + engine + _headers)
cd dist && python3 -m http.server 8000
# open http://localhost:8000
```

`file://` won't work — Web Workers and `fetch` require a real origin. The build
copies `engine/` into `dist/`, so Stockfish is self-hosted; if the local files
are missing it falls back to jsDelivr.

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

Deployed as a Cloudflare Worker with static assets. `wrangler.jsonc` serves the
`dist/` directory and attaches **play.chesswithprince.com** as a custom domain.

`dist/` is committed, so the connected Git build only needs to run
`npx wrangler deploy` — no CI build step required. After changing anything under
`web/`, rebuild and commit the output before pushing:

```bash
npm --prefix web run build   # regenerates dist/ (app + engine + _headers)
git add dist && git commit -m "Rebuild" && git push
```

Because the apex `chesswithprince.com` already lives on Cloudflare, `custom_domain: true`
provisions the `play` subdomain's DNS record and TLS certificate on deploy.

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
- **Engine self-play** — watch Stockfish play both sides from the current
  position, or "play out" a chosen opening line so you can see how the theory
  continues at engine strength. Strength and speed follow the sliders.
- **Analysis on demand** — "Analyze position" runs Stockfish at full strength
  and shows its top three moves with evaluations and principal variations
  (White's perspective), so you can go deeper than the book from any position.
- **Idea notes** on each opening line (the middlegame plan), and **PGN export**
  (Copy PGN) for saving or studying a game elsewhere.
- **Master games** (its own tab) — play through real historical games move by
  move with annotations, or auto-replay them. **Browse by opening, player,
  theme, or era** to find games you like. The library spans Morphy's Opera
  Game, the Immortal and Evergreen games, Rubinstein's Immortal, Fischer–Benko,
  Fischer's "Game of the Century", Fischer–Spassky 1972, and Kasparov's
  Immortal, Steinitz–von Bardeleben, and Réti–Bogoljubov — tagged so you can
  find, say, every Fischer game, every attacking game, or a model game in your
  opening. There's also a **search box** (by player, opening, etc.). Move lists
  are facts (public game scores); you play a legend's side. Every game is
  verified legal against chess.js.

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
