# Code Quality Hardening — Issues

## [P3 E2E discovery] Stockfish WASM "unreachable" trap on Explore analysis after a move

**Severity:** Real, reproducible, pre-existing bug — NOT a P3 regression.
**Trigger:** Playing a move while in Explore mode (which calls `beginAnalysis()` again)
reliably crashes the Stockfish WASM worker with an "unreachable" runtime trap, and/or
throws "Invalid move: {from,to}" from a stale bestmove being misrouted through onBest's
engineExpected fallback branch.
**Verified pre-existing:** beginAnalysis/finishAnalysis/onBest's analysisOverlay branch
is byte-identical in structure to the pre-P3 code (commit 1b34c2b, fields analyzing/
analysisData/analysisFen). The bug is in the rapid stop()→setMultiPV()→go() command
sequencing racing against a stale bestmove for the aborted prior search — not in the
P3 mode-model refactor.
**Scope:** Fixing requires engine.ts command-sequencing changes (e.g. awaiting the
aborted search's bestmove before issuing the next go, or debouncing beginAnalysis calls).
Out of scope for the P3 phase (Scope OUT: no engine.ts changes beyond typing).
**Recommendation:** Follow-up plan/ticket to harden engine.ts's stop/go sequencing.
**Discovered via:** Playwright E2E smoke suite (todo 24), assertion #8, during P3 work.
