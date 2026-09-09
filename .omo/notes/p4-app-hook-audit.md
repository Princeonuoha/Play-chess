# P4 App.tsx hook-by-tab audit

Audit target: `web/src/App.tsx` (read-only; no source changes in this todo).

Tags identify the one ownership destination implied by current JSX consumption:
**Play**, **Train**, **Games**, **Study**, or **Shared**. `Shared` means that the
value is consumed by the board, global chrome/modal, tab shell, or more than one
tab. There are 28 calls: 10 in the existing local `OpeningsExplorer` precedent
and 19 in `App`. The four imported React APIs at line 1 are included below so the
audit mirrors the source's identifier counts exactly.

## React state and lifecycle inventory

| Line | React API / variable | Tab |
| --- | --- | --- |
| 1 | `useEffect` import | Shared |
| 1 | `useMemo` import | Shared |
| 1 | `useRef` import | Shared |
| 1 | `useState` import | Shared |
| 292 | `useState` / `data` | Train |
| 293 | `useState` / `err` | Train |
| 294 | `useState` / `query` | Train |
| 295 | `useState` / `sel` | Train |
| 296 | `useState` / `trainSide` | Train |
| 297 | `useState` / `hints` | Train |
| 299 | `useEffect` / opening database load | Train |
| 309 | `useMemo` / `results` | Train |
| 310 | `useMemo` / `popular` | Train |
| 314 | `useMemo` / `siblings` | Train |
| 631 | `useRef` / `boardRef` | Shared |
| 632 | `useRef` / `ctrlRef` | Shared |
| 633 | `useState` / `snap` | Shared |
| 634 | `useState` / `promo` | Shared |
| 635 | `useState` / `toast` | Shared |
| 636 | `useRef` / `toastTimer` | Shared |
| 638 | `useState` / `tab` | Shared |
| 639 | `useState` / `sideChoice` | Shared |
| 640 | `useState` / `elo` | Shared |
| 641 | `useState` / `tt` | Shared |
| 642 | `useState` / `facet` | Games |
| 643 | `useState` / `search` | Games |
| 644 | `useState` / `gameSel` | Games |
| 645 | `useState` / `mgHints` | Games |
| 646 | `useState` / `showIntro` | Shared |
| 669 | `useEffect` / board mount, boot, resize, and keyboard lifecycle | Shared |
| 692 | `useEffect` / leave-Study review-position restoration | Shared |
| 697 | `useMemo` / `gGroups` | Games |
| 700 | `useEffect` / keep `gameSel` valid for the Games filter | Games |

## Functions and computed values

| Line | Function / computed value | Tab |
| --- | --- | --- |
| 319 | `select` | Train |
| 323 | `flipSide` | Train |
| 328 | `coach` | Train |
| 329 | `watchLabel` | Train |
| 347 | `startTrain` | Train |
| 653 | `dismissIntro` | Shared |
| 667 | `ctrl` | Shared |
| 706 | `showToast` | Shared |
| 712 | `diff` | Play |
| 714 | `copyPGN` | Study |
| 730 | `selfPlay` | Shared |
| 731 | `replaying` | Shared |
| 732 | `sessionKey` | Shared |
| 733 | `finishLabel` | Play |
| 734 | `fullLabel` | Play |
| 735 | `watchLabel` | Games |
| 738 | `review` | Study |
| 739 | `reviewPly` | Shared |
| 740 | `exploring` | Study |
| 741 | `exploreMoves` | Study |
| 742 | `history` | Shared |
| 743 | `canBrowse` | Shared |
| 744 | `rows` | Study |
| 747 | `gameMeta` | Games |
| 748 | `gameSelValid` | Games |

## Required P4 ownership confirmations

| Planned ownership | Confirmed values | Tab |
| --- | --- | --- |
| Move into `GamesPanel` | `facet`, `search`, `gameSel`, `mgHints` | Games |
| Keep in `App` | `boardRef`, `ctrlRef`, `snap`, `promo`, `toast`, `toastTimer`, `elo`, `tt`, `sideChoice`, `showIntro` | Shared |

All four Games-local values exist at lines 642–645 and are consumed exclusively by
the Games branch (including its filtering/selection memo and validity effect).
All ten Shared values exist in `App`; they serve the imperative board/controller,
cross-tab snapshot, global promotion/toast/intro UI, or Play configuration that
remains owned by `App` under the P4 plan.
