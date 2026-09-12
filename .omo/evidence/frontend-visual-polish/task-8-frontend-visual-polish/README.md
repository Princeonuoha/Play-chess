# Task 8: approved minimal Worker routing shim

The Worker in commit `1fbebf7` is a **user-approved deviation** limited to a static-assets routing shim. It has no API routes, backend logic, state, storage, authentication, or data fetching; its only binding is `ASSETS`.

`worker/index.ts` passes genuine asset-shaped requests (a file extension or `/assets/`) to `env.ASSETS.fetch()` so the static-assets 404 is retained. It fetches the SPA shell for navigation paths. The checked `curl -i` response headers are in `curl-matrix.txt`, and the concise eight-case matrix is in `curl-status-matrix.txt`.

Validation receipts:

- `routes-preview.log`: `web/tests/routes.spec.ts` via the Wrangler preview, 12/12 passed.
- `typecheck.log` and `unit-tests.log`: requested TypeScript and Vitest checks.
- `build.log`: requested production build.
- `dist-drift.log`: `git diff --exit-code -- dist` passed after the owning worker's committed production-bundle refresh.
- `wrangler-preview.log`: local preview lifecycle and binding receipt.
