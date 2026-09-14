import { useEffect, useState } from 'react'
import { type ChessController, GRADE_GLYPH, type MoveLabel, type ReviewItem, type Snapshot } from '../core/controller'
import { Btn, Icon, InlineFeedback, SegmentedNav, Surface, type SegmentItem, type ToastTone } from '../ui/primitives'

export interface StudyPanelProps {
  snap: Snapshot | null
  /** Live SAN move list. Owned by `App` because the board scrubber shares it. */
  history: string[]
  reviewPly: number | null
  /** Owned by `App`: the board scrubber's `canBrowse` guard reads it too. */
  exploring: boolean
  /** `App` owns the toast state; Copy PGN reports its result through this. */
  showToast: (msg: string, tone?: ToastTone) => void
  controller: ChessController
}

/** The two study surfaces: guided (Review) and open (Analysis + Explore). */
type StudySurface = 'review' | 'analysis'

/**
 * DESIGN.md §2.6 grade tokens. The ink is the status token lifted toward
 * `--text-primary` because the raw hue misses §8.6's 4.5:1 floor against its
 * own 20% fill; `scripts/verify-contrast.mjs` re-measures all five pairs.
 * Written out in full because Tailwind only emits a rule for a class literal
 * it can find in source — these may not be composed from the token name.
 */
const LABEL_STYLE: Record<MoveLabel, string> = {
  Best: 'bg-[color:var(--status-best)]/20 text-[color:color-mix(in_oklab,var(--status-best)_65%,var(--text-primary))] border-[color:var(--status-best)]/40',
  Good: 'bg-[color:var(--status-good)]/20 text-[color:color-mix(in_oklab,var(--status-good)_65%,var(--text-primary))] border-[color:var(--status-good)]/40',
  Inaccuracy: 'bg-[color:var(--status-inaccuracy)]/20 text-[color:color-mix(in_oklab,var(--status-inaccuracy)_65%,var(--text-primary))] border-[color:var(--status-inaccuracy)]/40',
  Mistake: 'bg-[color:var(--status-mistake)]/20 text-[color:color-mix(in_oklab,var(--status-mistake)_65%,var(--text-primary))] border-[color:var(--status-mistake)]/40',
  Blunder: 'bg-[color:var(--status-blunder)]/20 text-[color:color-mix(in_oklab,var(--status-blunder)_65%,var(--text-primary))] border-[color:var(--status-blunder)]/40',
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

/** One evaluated engine line. The `.an-line` shape is owned by `index.css`. */
function AnalysisLines({ lines }: { readonly lines: { ev: string; pv: string; best?: boolean }[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className={'an-line' + (l.best ? ' best' : '')}>
          <span className="ev">{l.ev}</span>
          <span className="pv">{l.pv}</span>
        </div>
      ))}
    </>
  )
}

/**
 * The `Study` tab body, split into the two things a player actually does with a
 * finished position: a GUIDED pass (Review) and an OPEN one (Analysis +
 * Explore). A `SegmentedNav` names both, and the chosen surface is the only one
 * that expands — the other keeps its heading, a one-line summary and its entry
 * action, so both are always discoverable but never carry the same weight.
 *
 * Nothing here changes review grading, MultiPV, Explore or PGN semantics: every
 * branch calls the same `ChessController` method it called before, and the panel
 * owns no board state of its own. Selecting a surface is local `useState` only,
 * so switching can never move the position the controller is showing.
 *
 * While Explore is running the open surface is pinned: Explore is a live board
 * mode and its `Exit` control must not be navigable away from, so the `Review`
 * segment is `aria-disabled` with the reason stated in the line beneath it.
 *
 * `LABEL_STYLE` / `reviewComment` / `formatMovesFrom` came out of
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
  const [chosen, setChosen] = useState<StudySurface>('review')
  const surface: StudySurface = exploring ? 'analysis' : chosen
  const guided = surface === 'review'

  useEffect(() => {
    if (!exploring) return
    document.querySelector<HTMLElement>('.board')?.scrollIntoView({ block: 'start' })
    document.querySelector<HTMLInputElement>('[data-board-alt="entry"]')?.focus({ preventScroll: true })
  }, [exploring])

  const review = snap?.review ?? null
  const graded = review?.items ?? []
  const story = review?.story ?? []
  const running = review?.running === true
  const analyzing = snap?.analyzing === true
  const analysis = snap?.analysis ?? []
  const exploreMoves = snap?.exploreMoves ?? []
  const viewed = graded.find((it) => it.ply === (reviewPly ?? history.length - 1)) ?? null

  const rows: { n: number; w: string; b: string }[] = []
  for (let i = 0; i < history.length; i += 2) rows.push({ n: i / 2 + 1, w: history[i] || '', b: history[i + 1] || '' })

  /**
   * The `window.prompt` last resort is DESIGN.md 8.7 accepted debt D-04. It is
   * deliberately deferred a frame: a synchronous modal blocks the paint that
   * commits the live-region text, so announcing first is what keeps the
   * failure audible at all.
   */
  const copyPGN = () => {
    const pgn = controller.getPGN()
    if (!pgn) {
      showToast('No moves to export yet')
      return
    }
    const fallback = () => {
      showToast('Couldn’t reach the clipboard — copy the PGN from the box that follows.', 'error')
      requestAnimationFrame(() => window.prompt('Copy the PGN:', pgn))
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pgn).then(() => showToast('PGN copied to clipboard'), fallback)
    } else {
      fallback()
    }
  }

  const segments: SegmentItem[] = [
    { id: 'review', label: 'Review', icon: 'check', disabled: exploring },
    { id: 'analysis', label: 'Analysis', icon: 'search' },
  ]

  return (
    <>
      <SegmentedNav
        label="Study surface"
        items={segments}
        selectedId={surface}
        onSelect={(id) => setChosen(id === 'analysis' ? 'analysis' : 'review')}
      />
      <p className="ui-field-desc">
        {exploring
          ? 'You are on the free board. Exit Explore to go back to the guided review.'
          : guided
            ? 'Guided: Stockfish walks a finished game move by move and names what you missed.'
            : 'Open: read Stockfish’s lines for the position on the board, or play your own.'}
      </p>

      {/* ------------------------------------------------ guided: Game review */}
      <Surface
        label="Guided game review"
        title="Game review"
        tone={guided ? 2 : 1}
        body={
          review === null
            ? 'Play or load a game, then review it: Stockfish grades every move, shows the stronger move you missed, and — where your game followed a known line — tells you how the masters handled it.'
            : `${graded.length} move${graded.length === 1 ? '' : 's'} graded${story.length ? `, ${story.length} from the books` : ''}.`
        }
      >
        <div className="flex flex-wrap gap-2">
          <Btn
            primary={guided}
            loading={running}
            disabled={running || history.length === 0}
            onClick={() => {
              setChosen('review')
              controller.reviewGame()
            }}
          >
            {running ? 'Reviewing…' : 'Review game'}
          </Btn>
          {review !== null && <Btn onClick={() => controller.clearReview()}>Clear</Btn>}
        </div>

        {/* 1. progress — stays visible even while the open surface is chosen */}
        {running && (
          <div data-study-block="progress">
            <InlineFeedback state="loading" message={review.progress} skeletonRows={2} />
          </div>
        )}

        {guided && (
          <>
            {/* 2. story cards from the games DB */}
            {story.length > 0 && (
              <div data-study-block="story" className="grid gap-2">
                {story.map((s, i) => (
                  <Surface key={i} tone={3} label={s.title}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          'rounded-[var(--radius-pill)] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
                          (s.kind === 'master'
                            ? 'border-[color:var(--border-brass)] text-[color:var(--brass-base)]'
                            : 'border-[color:var(--border-subtle)] text-[color:var(--text-muted)]')
                        }
                      >
                        {s.kind === 'master' ? 'From the masters' : 'Opening'}
                      </span>
                      <span className="[font:var(--type-body-sm)] font-semibold">{s.title}</span>
                    </div>
                    <p className="ui-surface-body">{s.text}</p>
                  </Surface>
                ))}
              </div>
            )}

            {/* 3. legend */}
            {graded.length > 0 && (
              <div data-study-block="legend" className="flex flex-wrap gap-1.5">
                {(['Best', 'Good', 'Inaccuracy', 'Mistake', 'Blunder'] as MoveLabel[]).map((l) => (
                  <span key={l} className={'rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[10px] font-bold ' + LABEL_STYLE[l]}>
                    <span aria-hidden="true" className="font-[family-name:var(--type-font-numeric)]">
                      {GRADE_GLYPH[l]}
                    </span>{' '}
                    {l}
                  </span>
                ))}
              </div>
            )}

            {/* 4. commentary for the move being viewed */}
            {viewed !== null && (
              <div
                data-study-block="commentary"
                className={'flex items-start gap-2 rounded-[var(--radius-lg)] border p-3 [font:var(--type-body-sm)] ' + LABEL_STYLE[viewed.label]}
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0 font-[family-name:var(--type-font-numeric)] font-bold">
                  {GRADE_GLYPH[viewed.label]}
                </span>
                <span className="text-[color:var(--text-primary)]">{reviewComment(viewed)}</span>
                <span className="ml-auto shrink-0 font-[family-name:var(--type-font-numeric)] text-xs opacity-80">{viewed.evalWhite}</span>
              </div>
            )}

            {/* 5. the better line the engine wanted instead */}
            {viewed !== null && viewed.betterSan !== null && (
              <div data-study-block="better" className="flex items-center gap-2 [font:var(--type-body-sm)] text-[color:var(--text-muted)]">
                <Icon name="arrow-right" size="sm" />
                <span>Better line</span>
                <span className="font-[family-name:var(--type-font-numeric)] font-semibold text-[color:var(--status-positive)]">
                  {viewed.betterSan}
                </span>
              </div>
            )}

            {/* per-move grades: the scrubber for everything above */}
            {graded.length > 0 && (
              <div data-study-block="moves" className="grid gap-2">
                {reviewPly !== null && (
                  <Btn icon="arrow-left" onClick={() => controller.resumeGame()} className="justify-self-start">
                    Back to final position
                  </Btn>
                )}
                <div className="max-h-80 divide-y divide-[color:var(--border-hairline)] overflow-auto rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)]">
                  {graded.map((it) => (
                    <button
                      key={it.ply}
                      onClick={() => controller.gotoPly(it.ply)}
                      className={
                        'flex w-full min-h-[var(--icon-target-min)] items-center gap-2 px-3 py-2 text-left [font:var(--type-body-sm)] transition hover:bg-[var(--surface-inset-hover)] ' +
                        (reviewPly === it.ply ? 'bg-[color:var(--brass-wash)] ring-1 ring-inset ring-[color:var(--border-brass)]' : '')
                      }
                    >
                      <span className="w-9 shrink-0 text-right font-[family-name:var(--type-font-numeric)] text-xs text-[color:var(--text-muted)]">
                        {it.moveNo}{it.side === 'w' ? '.' : '…'}
                      </span>
                      <span className="w-14 shrink-0 font-[family-name:var(--type-font-numeric)] font-semibold">{it.san}</span>
                      <span
                        className={'shrink-0 rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[10px] font-bold ' + LABEL_STYLE[it.label]}
                        title={it.lossCp != null ? `-${(it.lossCp / 100).toFixed(1)} vs best` : 'Top engine move'}
                      >
                        <span aria-hidden="true" className="font-[family-name:var(--type-font-numeric)]">
                          {GRADE_GLYPH[it.label]}
                        </span>{' '}
                        {it.label}
                      </span>
                      <span className="ml-auto shrink-0 font-[family-name:var(--type-font-numeric)] text-xs text-[color:var(--text-muted)]">{it.evalWhite}</span>
                      {it.betterSan && (
                        <span className="hidden shrink-0 items-center gap-1 font-[family-name:var(--type-font-numeric)] text-[11px] text-[color:var(--status-positive)] sm:inline-flex">
                          <Icon name="arrow-right" size="sm" />
                          <span className="sr-only">Better move:</span>
                          {it.betterSan}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-[color:var(--text-muted)]">
                  Tap a move to see it on the board. “Better” shows the engine’s top move when you missed it.
                </p>
              </div>
            )}

            {/* 6. scoresheet */}
            <div data-study-block="scoresheet" className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="ui-field-label">Scoresheet</h4>
                <Btn onClick={copyPGN}>Copy PGN</Btn>
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
                  <div className="p-3">
                    <InlineFeedback
                      state="empty"
                      message="No moves yet. Play a game, or replay one from Games, and the score is written here as it goes."
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Surface>

      {/* ------------------------------------ open: Analyze position + Explore */}
      <Surface
        label="Open analysis and Explore"
        title="Position analysis"
        tone={guided ? 1 : 2}
        body="Stockfish’s top moves in the position on the board, at full strength — or take the board yourself and try a line."
      >
        <div className="flex flex-wrap gap-2">
          <Btn
            primary={!guided}
            loading={analyzing}
            disabled={analyzing}
            onClick={() => {
              setChosen('analysis')
              controller.analyze()
            }}
          >
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </Btn>
          {!exploring && (
            <Btn
              icon="explore"
              onClick={() => {
                setChosen('analysis')
                controller.startExplore()
              }}
            >
              Explore — play your own moves
            </Btn>
          )}
        </div>

        {!guided && (
          <>
            {/* 1. MultiPV */}
            <div data-study-block="multipv" className="grid gap-1.5">
              {exploring ? (
                <p className="ui-field-desc">Stockfish is following the line you are playing below.</p>
              ) : analysis.length ? (
                <AnalysisLines lines={analysis} />
              ) : (
                <InlineFeedback
                  state="empty"
                  message="No lines yet. Run Analyze to rank the strongest moves in this position."
                />
              )}
            </div>

            {/* 2. Explore — play your own moves; the engine analyses the line */}
            <div data-study-block="explore">
              {exploring ? (
                <Surface label="Explore board" tone={3}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="ui-field-label">Exploring — play any moves</span>
                    <div className="flex flex-wrap gap-2">
                      <Btn onClick={() => controller.exploreUndo()} disabled={exploreMoves.length === 0}>
                        Undo
                      </Btn>
                      <Btn onClick={() => controller.exitExplore()}>Exit</Btn>
                    </div>
                  </div>
                  <p className="[font:var(--type-numeric)]">
                    {exploreMoves.length ? (
                      <span className="text-[color:var(--text-primary)]">
                        Your line: {formatMovesFrom(exploreMoves, (snap?.exploreStartPly ?? -1) + 1)}
                      </span>
                    ) : (
                      <span className="text-[color:var(--text-muted)]">
                        Drag a piece to try a line for either side — Stockfish evaluates each position below.
                      </span>
                    )}
                  </p>
                  <div className="grid gap-1">
                    {analysis.length ? (
                      <AnalysisLines lines={analysis} />
                    ) : (
                      <InlineFeedback state="loading" message="Stockfish is looking at the position…" skeletonRows={2} />
                    )}
                  </div>
                </Surface>
              ) : (
                <p className="ui-field-desc">
                  Explore hands you both sides of a scratch board from the position you are viewing. The game you came
                  from is kept exactly as it was.
                </p>
              )}
            </div>
          </>
        )}
      </Surface>
    </>
  )
}
