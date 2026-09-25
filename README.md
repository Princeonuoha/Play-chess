# chesswithprince.com

A single-page chess app. Stockfish 18 runs as WebAssembly in the visitor's browser,
so there is no backend, no server cost, and nothing to scale.

Play at **play.chesswithprince.com** — test your lines against the strongest version
of Stockfish, right in the browser.

```
web/                 the app — React + TypeScript + Tailwind v4 + react-router (Vite)
  src/App.tsx        router entry: /play /openings /games /study
  src/workspace/     the shell — ChessWorkspaceLayout (board, engine, toasts,
                     promotion, shared state), WorkspaceRoutes (route panels),
                     WorkspaceChrome (header/nav/footer/cards), WorkspaceGuide
                     (first-visit dialog), BoardConsole + boardState
                     (screen-reader board and keyboard move entry)
  src/panels/        PlayPanel, TrainPanel, GamesPanel, StudyPanel
  src/ui/            design-system components: primitives, controls, feedback,
                     surfaces, overlays, icons, primitives.css
  src/core/          framework-agnostic engine + board + trainer + review controller
  src/dev/           dev-only primitive showcase (never built into dist/)
  tests/             Playwright specs
  scripts/           build + verification gates
DESIGN.md            the design contract ("Precision Chess Studio") — machine-checked
worker/index.ts      Cloudflare Worker: asset passthrough + SPA fallback
dist/                built, deployable output (committed; wrangler serves this)
engine/              self-hosted Stockfish files (copied into dist on build)
index.html           the original single-file app (kept for reference; not deployed)
```

The shell owns the board, the engine and all shared state; each route renders a
panel into it through the router outlet, so switching workspaces never tears down
the game. `/` redirects to `/play`; anything unrecognised renders an empty state
that leaves the game untouched.

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

Both the `web/` app (`src/core/engine.ts`) and the legacy `index.html` check for
`engine/stockfish-18-lite-single.js` on load and prefer it when present, falling
back to the CDN otherwise. No code change needed.

The `.wasm` is about 7 MB, so set a long cache lifetime on `engine/*` — visitors
download it once.

## Deploy

Deployed to Cloudflare as a Worker in front of static assets. `wrangler.jsonc`
points `main` at `worker/index.ts` with `run_worker_first`, binds `dist/` as
`ASSETS`, and attaches **play.chesswithprince.com** as a custom domain. The worker
is deliberately small: a request whose path looks like an asset (`/assets/...`, or
any final segment with a file extension) is passed straight through to `ASSETS`;
everything else is served `/`, so a deep link like `/study` or a reload on
`/openings` returns the SPA instead of a 404.

`dist/` is committed, so the connected Git build only needs to run
`npx wrangler deploy` — no CI build step required. After changing anything under
`web/`, rebuild and commit the output before pushing:

```bash
npm --prefix web run build   # regenerates dist/ (app + engine + _headers)
git add dist && git commit -m "Rebuild" && git push
```

CI rebuilds the app and fails when the committed `dist/` output differs from the
fresh build. Before pushing changes under `web/`, run `npm --prefix web run build`
and commit the resulting `dist/` files.

Because the apex `chesswithprince.com` already lives on Cloudflare,
`custom_domain: true` provisions the `play` subdomain's DNS record and TLS
certificate on deploy.

## Design system

[`DESIGN.md`](DESIGN.md) is the contract, not a mood board: color, typography,
spacing, radius, depth, z-index, icons, motion, primitive states, responsive
layout, and accessibility constraints are all declared there as tokens, and
`web/src/index.css` is the single place those tokens exist in code. Product
source is not allowed to reach past it for a visual value, components come from
one icon family, and the layout and contrast rules are numbers rather than
opinions. The `verify:*` scripts below enforce all of that in CI.

## Verification

```bash
npm --prefix web run typecheck    # tsc --noEmit
npm --prefix web test             # Vitest (src/core/__tests__, src/dev/__tests__, src/*.test.ts)
npm --prefix web run build        # verify:icons + typecheck + vite build + postbuild
npm --prefix web run verify:design  # design contract + tokens + contrast + icons
npm --prefix web run test:e2e     # Playwright: baseline, main (chromium), showcase
```

Playwright covers the shipping surface, not just a smoke test — `tests/` holds
`a11y`, `baseline`, `board`, `eval-bar`, `feedback`, `games`, `layout`,
`metadata`, `navigation`, `onboarding`, `openings`, `play`, `routes`, `showcase`,
`smoke`, `study`, and `workspace-regression` specs, the last of which carries
committed screenshot snapshots. `test:e2e` runs the baseline pass, the main
chromium project, and the dev showcase (its own config) in sequence.

The gates in `web/scripts/` are ordinary Node scripts you can run directly:

- `validate-design-contract.mjs` — checks `DESIGN.md` itself still declares every
  required section and token
- `verify-token-compliance.mjs` — fails when product source hardcodes a visual
  value instead of using a token from `index.css`
- `verify-contrast.mjs` — recomputes documented contrast pairs from the tokens
  actually declared in `index.css`
- `verify-icons.mjs` — fails when the UI reaches outside `src/ui/icons.tsx`
- `verify-baseline-manifest.mjs` — validates the Playwright baseline manifest
- `lighthouse-real-chrome.mjs` — real-Chrome Lighthouse run; CI enforces it as a
  budget (`LIGHTHOUSE_ENFORCE_BUDGET=1`) against `vite preview`
- `react-scan-flows.mjs` — drives the app under react-scan to catch render churn
- `measure-geometry.mjs` — probes shell geometry against the DESIGN.md fold rule

CI runs typecheck, Vitest, build, React Doctor, a devtools-leak scan of `dist/`,
the Lighthouse budget, the `dist/` drift check, and finally the complete
Playwright suite. Playwright is explicitly permitted for browser E2E; the test
guardrail remains no jsdom and no `@testing-library/react` component harness.

## Features

- Drag-and-drop **and** click-to-move, with a sliding animation
- Legal-move dots, last-move and check highlighting
- Promotion picker
- Evaluation bar (White's perspective), horizontal above the board, updated
  while Stockfish searches
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
build (`stockfish-18-lite.*`), it requires cross-origin isolation — add these to
the repo-root `_headers` file, which the build copies into `dist/`:

```
/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
```

Note this also blocks cross-origin resources that don't opt in. The `web/` app
already self-hosts its fonts from `web/public/fonts/`, so only the legacy
`index.html`, which links Google Fonts, would need changing.

## Licensing

Stockfish.js is GPLv3. You're distributing it, so keep the license notice in the
footer, don't strip the copyright header from the engine files, and be prepared to
point at the source (linking to github.com/nmrugg/stockfish.js satisfies this).

The self-hosted Archivo and IBM Plex Mono Latin subsets are licensed under the SIL
Open Font License 1.1. Their copyright notices, complete licence text, and source /
version record ship alongside the font files in [`web/public/fonts/`](web/public/fonts/)
as [`OFL.txt`](web/public/fonts/OFL.txt) and
[`PROVENANCE.md`](web/public/fonts/PROVENANCE.md), and are copied to `dist/fonts/`.

The piece artwork is original SVG written for this project (`web/src/core/pieces.ts`,
and inline in the legacy `index.html`) — no third-party asset licenses are involved.

## Notes

- `chess.js` handles rules. The `web/` app takes it as a pinned npm dependency
  (`chess.js@1.4.0`) and bundles it; only the legacy single-file `index.html`
  imports it from esm.sh.
- The evaluation bar only updates while Stockfish is searching, which is on its
  own turn. That's intentional: analysing on your turn would double CPU use and
  quietly hand you the best move.
- Cross-origin engine loading (the jsDelivr fallback path) uses a blob-shim
  worker: the real `.wasm` URL is passed in the worker URL's hash fragment and
  resolved through the engine's own `locateFile`. The self-hosted path loads the
  worker directly.
