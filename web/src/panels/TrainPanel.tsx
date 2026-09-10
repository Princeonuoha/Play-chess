import { useEffect, useMemo, useState } from 'react'
import {
  type ChessController,
  type Snapshot,
  type SetKey,
  type SessionSlot,
  type AnnotationState,
} from '../core/controller'
import {
  loadOpenings,
  searchOpenings,
  POPULAR_PRIMARIES,
  type OpeningsData,
  type OpeningEntry,
} from '../core/openings'
import { COACH } from '../core/coach'
import { Btn, Field, StatusNote } from '../ui/primitives'

export interface TrainPanelProps {
  snap: Snapshot
  replaying: boolean
  selfPlay: boolean
  sessionKey: SetKey
  reviewPly: number | null
  controller: ChessController
}

/**
 * The `Openings` (train) tab body. Pure props-in: no hooks, no state of its own.
 *
 * `OpeningsExplorer` below is the tab's UI, moved verbatim out of `App.tsx` so this
 * panel does not have to import `App.tsx` (which would be a circular import, per the
 * same rule that produced `ui/primitives.tsx`). Its hooks were and remain the
 * explorer's own local state — none of `App`'s state moved.
 */
export function TrainPanel({ snap, replaying, selfPlay, sessionKey, reviewPly, controller }: TrainPanelProps) {
  return (
    <OpeningsExplorer
      ctrl={controller}
      train={snap.train}
      replaying={replaying}
      selfPlay={selfPlay}
      sessionKey={sessionKey}
      annotation={snap.annotation}
      reviewPly={reviewPly}
    />
  )
}

function formatMoves(sans: string[]): string {
  let out = ''
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) out += (i / 2 + 1) + '.'
    out += sans[i] + ' '
  }
  return out.trim()
}

function OpeningsExplorer({
  ctrl,
  train,
  replaying,
  selfPlay,
  sessionKey,
  annotation,
  reviewPly,
}: {
  ctrl: ChessController
  train: SessionSlot
  replaying: boolean
  selfPlay: boolean
  sessionKey: SetKey
  annotation: AnnotationState | null
  reviewPly: number | null
}) {
  const [data, setData] = useState<OpeningsData | null>(null)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState<OpeningEntry | null>(null)
  const [trainSide, setTrainSide] = useState<'w' | 'b'>('w')
  const [hints, setHints] = useState(false)

  useEffect(() => {
    let alive = true
    loadOpenings()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(String(e)))
    return () => {
      alive = false
    }
  }, [])

  const results = useMemo(() => (data && query ? searchOpenings(data, query) : []), [data, query])
  const popular = useMemo(() => {
    if (!data) return []
    return POPULAR_PRIMARIES.map((p) => data.byPrimary.get(p)?.[0]).filter(Boolean) as OpeningEntry[]
  }, [data])
  const siblings = useMemo(() => {
    if (!data || !sel) return []
    return (data.byPrimary.get(sel.primary) || []).filter((x) => x.name !== sel.name).slice(0, 8)
  }, [data, sel])

  const select = (e: OpeningEntry, side = trainSide) => {
    setSel(e)
    ctrl.previewLine(e.moves, side)
  }
  const flipSide = (s: 'w' | 'b') => {
    setTrainSide(s)
    if (sel) ctrl.previewLine(sel.moves, s)
  }

  const coach = sel ? COACH[sel.primary] : undefined
  const watchLabel = replaying && sessionKey === 'train' ? '■ Stop' : selfPlay ? '■ Stop' : '▶ Watch this line played out'

  if (err)
    return (
      <div className="grid gap-2 text-sm text-[var(--color-muted)]">
        <div>Couldn’t load the opening database.</div>
        <Btn
          onClick={() => {
            setErr('')
            loadOpenings().then(setData).catch((e) => setErr(String(e)))
          }}
        >
          Retry
        </Btn>
      </div>
    )
  if (!data) return <div className="py-6 text-center text-sm text-[var(--color-muted)]">Loading opening database…</div>

  const startTrain = () => {
    if (!sel) return
    ctrl.startTrainerLine(
      {
        moves: sel.moves,
        you: trainSide,
        opening: sel.primary,
        variation: sel.variation + (sel.subline ? ', ' + sel.subline : ''),
        eco: sel.eco,
      },
      'train',
      hints,
    )
  }

  return (
    <div className="grid gap-3">
      <Field label={`Search openings · ${data.entries.length.toLocaleString()} lines`}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="name or ECO — e.g. Najdorf, Caro-Kann, B12"
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brass)] focus:outline-none"
        />
      </Field>

      {/* Results / quick picks when nothing is selected, or a Back control when one is */}
      {!sel && (
        <>
          {query ? (
            <div className="max-h-64 divide-y divide-white/5 overflow-auto rounded-xl border border-white/10">
              {results.length ? (
                results.map((e) => (
                  <button
                    key={e.name}
                    onClick={() => select(e)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="w-9 shrink-0 font-mono text-[11px] text-[var(--color-brass)]">{e.eco}</span>
                    <span className="text-[13px]">{e.name}</span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm italic text-[var(--color-muted)]">No openings match “{query}”.</div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-[var(--color-muted)]">Popular openings</div>
              <div className="flex flex-wrap gap-1.5">
                {popular.map((e) => (
                  <button
                    key={e.primary}
                    onClick={() => select(e)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium transition hover:border-[var(--color-brass)]/50 hover:bg-white/[0.06]"
                  >
                    {e.primary}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Opening profile */}
      {sel && (
        <div className="grid gap-3">
          <button
            onClick={() => {
              setSel(null)
            }}
            className="justify-self-start text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ‹ Back to list
          </button>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md border border-[var(--color-brass)]/40 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--color-brass)]">
                {sel.eco}
              </span>
              <span className="text-sm font-bold">{sel.primary}</span>
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {sel.variation}
              {sel.subline ? ' › ' + sel.subline : ''}
            </div>
            <div className="mt-2 font-mono text-[12px] leading-relaxed text-[var(--color-ink)]">{formatMoves(sel.moves)}</div>
          </div>

          {/* Coach: themes + middle-game plans */}
          {coach ? (
            <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[13px]">
              <div className="leading-relaxed text-[var(--color-muted)]">
                <b className="text-[var(--color-ink)]">Themes: </b>
                {coach.themes}
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-[var(--color-muted)]">Middle-game plans</div>
                <ul className="grid list-disc gap-1 pl-5 text-[var(--color-muted)]">
                  {coach.plans.map((p, i) => (
                    <li key={i} className="leading-relaxed">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[13px] leading-relaxed text-[var(--color-muted)]">
              Step through the line on the board with the ◀ ▶ controls, then train it against Stockfish. Coaching notes
              are being written for more openings.
            </div>
          )}

          {/* Best moves & annotations to move 20 (suggested, not auto-played) */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Suggested line to move 20</span>
              <div className="flex gap-2">
                {annotation && !annotation.running && (
                  <Btn onClick={() => ctrl.clearAnnotation()} className="min-h-0 flex-none px-3 py-1.5">
                    Clear
                  </Btn>
                )}
                <Btn
                  onClick={() => ctrl.annotateOpening(sel.moves, trainSide)}
                  disabled={annotation?.running}
                  className="min-h-0 flex-none px-3 py-1.5"
                >
                  {annotation?.running ? 'Analysing…' : 'Suggest best moves'}
                </Btn>
              </div>
            </div>
            {annotation?.running && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-brass)] border-r-transparent" />
                {annotation.progress}
              </div>
            )}
            {annotation && annotation.moves.length > 0 && (
              <div className="max-h-80 divide-y divide-white/5 overflow-auto rounded-xl border border-white/10">
                {annotation.moves.map((m) => (
                  <div key={m.ply}>
                    {m.theoryEnd && (
                      <div className="bg-[var(--color-brass)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brass)]">
                        Theory ends — Stockfish’s suggested moves from here
                      </div>
                    )}
                    <button
                      onClick={() => ctrl.gotoPly(m.ply)}
                      className={
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-white/[0.04] ' +
                        (reviewPly === m.ply ? 'bg-[var(--color-brass)]/10 ring-1 ring-inset ring-[var(--color-brass)]/40' : '')
                      }
                    >
                      <span className="w-9 shrink-0 text-right font-mono text-xs text-[var(--color-muted)]">
                        {m.moveNo}
                        {m.side === 'w' ? '.' : '…'}
                      </span>
                      <span className="w-14 shrink-0 font-mono font-semibold">{m.san}</span>
                      {!m.isBook && (
                        <span className="shrink-0 rounded border border-white/10 px-1 py-0.5 text-[9px] uppercase text-[var(--color-muted)]">
                          suggested
                        </span>
                      )}
                      {m.betterSan && (
                        <span className="shrink-0 font-mono text-[11px] text-[#e0bd7c]" title="Stockfish suggests this move instead">
                          try {m.betterSan}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 font-mono text-xs text-[var(--color-muted)]">{m.evalWhite}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {annotation && annotation.moves.length > 0 && (
              <>
                <Btn
                  primary
                  onClick={() => {
                    setHints(true)
                    ctrl.startTrainerLine(
                      {
                        moves: annotation.moves.map((m) => m.san),
                        you: trainSide,
                        opening: sel.primary,
                        variation: sel.variation + ' — suggested line to move 20',
                        eco: sel.eco,
                        noHandoff: true,
                      },
                      'train',
                      true,
                    )
                  }}
                >
                  Train this line with hints
                </Btn>
                <div className="text-[11px] leading-relaxed text-[var(--color-muted)]">
                  Evals are from White’s side. “try” flags where Stockfish suggests a different move; “suggested” marks
                  moves past the end of theory — these are recommendations, not played out by the engine. Tap a move to
                  see it, or “Train this line with hints” to play the suggested moves yourself (each one is highlighted).
                </div>
              </>
            )}
          </div>

          {/* Train controls */}
          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wide text-[var(--color-muted)]">Train as</div>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-1">
              {(['w', 'b'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => flipSide(s)}
                  className={
                    'min-h-10 rounded-lg text-sm font-semibold transition ' +
                    (trainSide === s ? 'bg-[var(--color-brass)] text-[#1a130a]' : 'text-[var(--color-ink)] hover:bg-white/[0.05]')
                  }
                >
                  {s === 'w' ? 'White' : 'Black'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn primary onClick={startTrain}>
              Train this line
            </Btn>
            <Btn disabled={train.hintDisabled} onClick={() => ctrl.playBookMove('train')}>
              Play book move
            </Btn>
          </div>
          <Btn active={replaying && sessionKey === 'train'} onClick={() => ctrl.watchMovesOut(sel.moves, trainSide)}>
            {watchLabel}
          </Btn>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={hints}
              onChange={(e) => {
                setHints(e.target.checked)
                ctrl.setHints('train', e.target.checked)
              }}
              className="h-4 w-4 accent-[var(--color-brass)]"
            />
            Show hint (highlight the book move)
          </label>
          <StatusNote slot={train} />

          {/* Variation index */}
          {siblings.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                Variations in this opening
              </div>
              <div className="max-h-48 divide-y divide-white/5 overflow-auto rounded-xl border border-white/10">
                {siblings.map((e) => (
                  <button
                    key={e.name}
                    onClick={() => select(e)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="w-9 shrink-0 font-mono text-[11px] text-[var(--color-brass)]">{e.eco}</span>
                    <span className="text-[12px]">
                      {e.variation}
                      {e.subline ? ' › ' + e.subline : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
