# Code Quality Hardening — Learnings

## Todo 7: Type UCI engine listener contract

- Replaced `Engine.on`'s broad `any` callback with event-specific overloads for `best`, `info`, and `boot`.
- `handle` now accepts either raw UCI text or `MessageEvent<string>` and preserves the prior empty-data fallback.
- A discriminated listener-registration tuple lets the implementation assign each listener without assertions or `any`.
- `controller.ts`'s existing `best` and `info` listener callbacks remain compatible without changes.
