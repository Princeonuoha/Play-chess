# Frontend Design State

## Accepted debt

- **React audit tooling:** `react-grab` and `react-scan` are development-only dynamic imports, so their production bundle cost is **0 bytes**. They add developer-machine install time and lockfile surface area; `react-doctor` is a development-only static scanner. `npm run verify:no-devtools` and CI scan built JavaScript for all three identifiers to prevent a production leak.
