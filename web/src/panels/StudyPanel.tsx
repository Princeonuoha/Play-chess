import { type ChessController, type MoveLabel, type ReviewItem, type Snapshot } from '../core/controller'
import { Btn } from '../ui/primitives'

export interface StudyPanelProps {
  snap: Snapshot | null
  /** Live SAN move list. Owned by `App` because the board scrubber shares it. */
  history: string[]
  reviewPly: number | null
  /** Owned by `App`: the board scrubber's `canBrowse` guard reads it too. */
  exploring: boolean
  /** `App` owns the toast state; Copy PGN reports its result through this. */
  showToast: (msg: string) => void
  controller: ChessController
}

const LABEL_STYLE: Record<MoveLabel, string> = {
  Best: 'bg-[#7ea86a]/20 text-[#9fca88] border-[#7ea86a]/40',
  Good: 'bg-[#5f9ea0]/20 text-[#8fc7c9] border-[#5f9ea0]/40',
  Inaccuracy: 'bg-[#d6a95d]/20 text-[#e0bd7c] border-[#d6a95d]/40',
  Mistake: 'bg-[#d08a3e]/20 text-[#e2a869] border-[#d08a3e]/45',
  Blunder: 'bg-[#c0453f]/20 text-[#e08078] border-[#c0453f]/45',
}
const LABEL_ICON: Record<MoveLabel, string> = {
  Best: '★',
  Good: '✓',
  Inaccuracy: '?!',
  Mistake: '?',
  Blunder: '??',
}

// Plain-language commentary for a reviewed move, e.g.
// "12.c5 was a mistake. A better move was Qg5."
function reviewComment(it: ReviewItem): string {
  const mv = `${it.moveNo}${it.side === 'w' ? '.' : '…'}${it.san}`
  if (it.label === 'Best') return `${mv} — the best move.`
  if (it.label === 'Good') return `${mv} — a good move.`
  const phrase = it.label === 'Inaccuracy' ? 'an inaccuracy' : it.label === 'Mistake' ? 'a mistake' : 'a blunder'
  const better = it.betterSan ? ` A better move was ${it.betterSan}.` : ''
  return `${mv} was ${phrase}.${better}`
}

// Number a move list that starts partway through a game (startPly = plies already played).
function formatMovesFrom(sans: string[], startPly: number): string {
  let out = ''
  for (let i = 0; i < sans.length; i++) {
    const ply = startPly + i
    const moveNo = Math.floor(ply / 2) + 1
    const white = ply % 2 === 0
    if (white) out += moveNo + '.'
    else if (i === 0) out += moveNo + '…'
    out += sans[i] + ' '
  }
  return out.trim()
}

/**
 * The `Study` tab body: Explore, Game review, Analyze position, and the Scoresheet.
 *
 * `LABEL_STYLE` / `LABEL_ICON` / `reviewComment` / `formatMovesFrom` came out of
 * `App.tsx` verbatim: they are read only here, and a panel importing them back from
 * `App.tsx` would be the circular import that `ui/primitives.tsx` exists to prevent.
 * The Study-tagged derived values from the P4 hook audit
 * (`.omo/notes/p4-app-hook-audit.md`) — `review`, `exploreMoves`, `rows`, `copyPGN` —
 * are computed here for the same reason; only genuinely shared values arrive as props.
 *
 * The Stockfish/GPLv3 licence notice is NOT part of this block: it lives in `App.tsx`'s
 * shared page footer, outside every tab, and stays there untouched.
 */
export function StudyPanel({ snap, history, reviewPly, exploring, showToast, controller }: StudyPanelProps) {
  const review = snap?.review ?? null
  const exploreMoves = snap?.exploreMoves ?? []
  const rows: { n: number; w: string; b: string }[] = []
  for (let i = 0; i < history.length; i += 2) rows.push({ n: i / 2 + 1, w: history[i] || '', b: history[i + 1] || '' })

  const copyPGN = () => {
    const pgn = controller.getPGN()
    if (!pgn) {
      showToast('No moves to export yet')
      return
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pgn).then(
        () => showToast('PGN copied to clipboard'),
        () => window.prompt('Copy the PGN:', pgn),
      )
    } else {
      window.prompt('Copy the PGN:', pgn)
    }
  }

  return (
    <>
      {/* Explore board — play your own moves; engine analyses the line */}
      {exploring ? (
        <div className="grid gap-2 rounded-2xl border border-[var(--color-brass)]/40 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-brass)]">
              Exploring — play any moves
            </span>
            <div className="flex gap-2">
              <Btn
                onClick={() => controller.exploreUndo()}
                disabled={!exploreMoves.length}
                className="min-h-0 flex-none px-3 py-1.5"
              >
                Undo
              </Btn>
              <Btn onClick={() => controller.exitExplore()} className="min-h-0 flex-none px-3 py-1.5">
                Exit
              </Btn>
            </div>
          </div>
          <div className="font-mono text-[12px] leading-relaxed">
            {exploreMoves.length ? (
              <span className="text-[var(--color-ink)]">
                Your line: {formatMovesFrom(exploreMoves, (snap?.exploreStartPly ?? -1) + 1)}
              </span>
            ) : (
              <span className="text-[var(--color-muted)]">
                Drag a piece to try a line for either side — Stockfish evaluates each position below.
              </span>
            )}
          </div>
          <div className="grid gap-1">
            {snap?.analysis && snap.analysis.length ? (
              snap.analysis.map((l, i) => (
                <div key={i} className={'an-line' + (l.best ? ' best' : '')}>
                  <span className="ev">{l.ev}</span>
                  <span className="pv">{l.pv}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-brass)] border-r-transparent" />
                Stockfish is looking at the position…
              </div>
            )}
          </div>
        </div>
      ) : (
        <Btn onClick={() => controller.startExplore()} className="justify-self-start min-h-0 flex-none px-3 py-1.5">
          ↔ Explore — play your own moves
        </Btn>
      )}

      {/* Game review */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Game review</span>
        <div className="flex gap-2">
          {review && (
            <Btn onClick={() => controller.clearReview()} className="min-h-0 flex-none px-3 py-1.5">
              Clear
            </Btn>
          )}
          <Btn
            primary
            disabled={review?.running || !history.length}
            onClick={() => controller.reviewGame()}
            className="min-h-0 flex-none px-3 py-1.5"
          >
            {review?.running ? 'Reviewing…' : 'Review game'}
          </Btn>
        </div>
      </div>

      {!review && (
        <div className="text-xs italic leading-relaxed text-[var(--color-muted)]">
          Play or load a game, then “Review game”: Stockfish grades every move, shows the stronger move you
          missed, and — where your game followed a known line — tells you how the masters handled it.
        </div>
      )}

      {review?.running && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-brass)] border-r-transparent" />
          {review.progress}
        </div>
      )}

      {/* Story cards from the games DB */}
      {review?.story.map((s, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[13px] leading-relaxed"
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className={
                'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
                (s.kind === 'master'
                  ? 'border-[var(--color-brass)]/50 text-[var(--color-brass)]'
                  : 'border-white/15 text-[var(--color-muted)]')
              }
            >
              {s.kind === 'master' ? 'From the masters' : 'Opening'}
            </span>
            <span className="font-semibold">{s.title}</span>
          </div>
          <div className="text-[var(--color-muted)]">{s.text}</div>
        </div>
      ))}

      {/* Per-move grades */}
      {review && review.items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['Best', 'Good', 'Inaccuracy', 'Mistake', 'Blunder'] as MoveLabel[]).map((l) => (
              <span key={l} className={'rounded-md border px-1.5 py-0.5 text-[10px] font-bold ' + LABEL_STYLE[l]}>
                {LABEL_ICON[l]} {l}
              </span>
            ))}
          </div>
          {reviewPly !== null && (
            <Btn onClick={() => controller.resumeGame()} className="min-h-0 flex-none px-3 py-1.5">
              ← Back to final position
            </Btn>
          )}
          {/* Live commentary for the move being viewed */}
          {(() => {
            const vp = reviewPly ?? history.length - 1
            const it = review.items.find((x) => x.ply === vp)
            if (!it) return null
            return (
              <div className={'flex items-start gap-2 rounded-xl border p-3 text-[13px] leading-relaxed ' + LABEL_STYLE[it.label]}>
                <span className="mt-0.5 shrink-0 font-bold">{LABEL_ICON[it.label]}</span>
                <span className="text-[var(--color-ink)]">{reviewComment(it)}</span>
                <span className="ml-auto shrink-0 font-mono text-xs opacity-80">{it.evalWhite}</span>
              </div>
            )
          })()}
          <div className="max-h-80 divide-y divide-white/5 overflow-auto rounded-xl border border-white/10">
            {review.items.map((it) => (
              <button
                key={it.ply}
                onClick={() => controller.gotoPly(it.ply)}
                className={
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-white/[0.04] ' +
                  (reviewPly === it.ply ? 'bg-[var(--color-brass)]/10 ring-1 ring-inset ring-[var(--color-brass)]/40' : '')
                }
              >
                <span className="w-9 shrink-0 text-right font-mono text-xs text-[var(--color-muted)]">
                  {it.moveNo}{it.side === 'w' ? '.' : '…'}
                </span>
                <span className="w-14 shrink-0 font-mono font-semibold">{it.san}</span>
                <span
                  className={'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ' + LABEL_STYLE[it.label]}
                  title={it.lossCp != null ? `-${(it.lossCp / 100).toFixed(1)} vs best` : 'Top engine move'}
                >
                  {LABEL_ICON[it.label]} {it.label}
                </span>
                <span className="ml-auto shrink-0 font-mono text-xs text-[var(--color-muted)]">{it.evalWhite}</span>
                {it.betterSan && (
                  <span className="hidden shrink-0 font-mono text-[11px] text-[#9fca88] sm:inline">
                    ▸ {it.betterSan}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="text-[11px] leading-relaxed text-[var(--color-muted)]">
            Tap a move to see it on the board. “Better” shows the engine’s top move when you missed it.
          </div>
        </>
      )}

      {/* Position analysis */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Analyze position</span>
        <Btn disabled={snap?.analyzing} onClick={() => controller.analyze()} className="min-h-0 flex-none px-3 py-1.5">
          {snap?.analyzing ? 'Analyzing…' : 'Analyze'}
        </Btn>
      </div>
      <div className="grid gap-1.5">
        {snap?.analysis && snap.analysis.length ? (
          snap.analysis.map((l, i) => (
            <div key={i} className={'an-line' + (l.best ? ' best' : '')}>
              <span className="ev">{l.ev}</span>
              <span className="pv">{l.pv}</span>
            </div>
          ))
        ) : (
          <div className="text-xs italic text-[var(--color-muted)]">
            Stockfish’s top moves in the current position (full strength).
          </div>
        )}
      </div>

      {/* Scoresheet */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Scoresheet</span>
        <Btn onClick={copyPGN} className="min-h-0 flex-none px-3 py-1.5">
          Copy PGN
        </Btn>
      </div>
      <div className="moves max-h-72 overflow-auto">
        {rows.length ? (
          <table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.n}>
                  <td className="n">{r.n}.</td>
                  <td className="mv w">{r.w}</td>
                  <td className="mv b">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-3 text-sm italic text-[var(--color-muted)]">No moves yet.</div>
        )}
      </div>
    </>
  )
}
