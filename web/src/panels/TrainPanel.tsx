import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  Btn,
  Empty,
  Error as ErrorState,
  Field,
  Icon,
  InlineFeedback,
  Loading,
  SegmentedNav,
  StatusNote,
  Surface,
} from '../ui/primitives'

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
 * `OpeningsExplorer` below is the tab's UI. Its hooks are the explorer's own
 * local state — none of `App`'s state lives here.
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

/* ---------------------------------------------------------------------------
 * Where the explorer was left standing.
 *
 * `WorkspaceRoutes` mounts this panel per route, so leaving `/openings` unmounts
 * it and every `useState` here is destroyed. The controller keeps owning the
 * game — a trainer session is still live in it after a route change — so a panel
 * that forgot its place would drop the player back into the browse list while
 * the board was still mid-session. This module-scope record is the panel's own
 * place in the flow, restored on mount; it is never a second copy of game state,
 * and `sessionLive` below still asks the controller whether the session exists.
 * ------------------------------------------------------------------------- */

/** The line a trainer session was started from, so training can name itself. */
interface TrainingSession {
  entry: OpeningEntry
  label: string
  side: 'w' | 'b'
  suggested: boolean
}

interface ExplorerMemory {
  query: string
  selected: OpeningEntry | null
  side: 'w' | 'b'
  hints: boolean
  session: TrainingSession | null
}

const memory: ExplorerMemory = { query: '', selected: null, side: 'w', hints: false, session: null }

/** The parsed database, kept so returning to the route never re-flashes `Loading`. */
let database: OpeningsData | null = null

function formatMoves(sans: string[]): string {
  let out = ''
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) out += (i / 2 + 1) + '.'
    out += sans[i] + ' '
  }
  return out.trim()
}

const sideName = (side: 'w' | 'b') => (side === 'w' ? 'White' : 'Black')

const variationOf = (e: OpeningEntry) => e.variation + (e.subline ? ', ' + e.subline : '')

const ROW =
  'flex w-full min-h-[var(--icon-target-min)] items-center gap-3 px-3 py-2 text-left transition hover:bg-[var(--surface-inset-hover)]'
const LIST = 'divide-y divide-[color:var(--border-hairline)] overflow-auto rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)]'
const ECO = 'w-10 shrink-0 text-[color:var(--brass-base)] [font:var(--type-numeric)]'
const DISCLOSURE =
  'ui-disclosure list-none gap-2 text-[color:var(--text-muted)] [font:var(--type-label)] tracking-[0.06em] uppercase [&::-webkit-details-marker]:hidden'

/* ------------------------------------------------------------------ shared */

/** The ECO code, name, and moves of one line — the same card in both phases. */
function LineIdentity({ entry, label }: { readonly entry: OpeningEntry; readonly label: string }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 rounded-[var(--radius-sm)] border border-[color:var(--border-brass)] px-1.5 py-0.5 font-bold text-[color:var(--brass-base)] [font:var(--type-numeric)]">
          {entry.eco}
        </span>
        <span className="min-w-0 break-words font-bold [font:var(--type-heading)]">{entry.primary}</span>
      </div>
      <p className="break-words text-[color:var(--text-muted)] [font:var(--type-body-sm)]">{label}</p>
      <p className="break-words text-[color:var(--text-primary)] [font:var(--type-numeric)]">{formatMoves(entry.moves)}</p>
    </>
  )
}

/* --------------------------------------------------------------- discovery */

function PopularPicks({ entries, onPick }: { readonly entries: OpeningEntry[]; readonly onPick: (e: OpeningEntry) => void }) {
  return (
    <div>
      <p className="ui-field-label mb-2">Popular openings</p>
      <div className="flex flex-wrap gap-2">
        {entries.map((e) => (
          <button
            key={e.primary}
            type="button"
            onClick={() => onPick(e)}
            className="min-h-[var(--icon-target-min)] rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] px-3 font-semibold transition hover:border-[color:var(--border-brass)] hover:bg-[var(--surface-inset-hover)] [font:var(--type-body-sm)]"
          >
            {e.primary}
          </button>
        ))}
      </div>
    </div>
  )
}

function SearchResults({
  query,
  results,
  onPick,
  onClear,
}: {
  readonly query: string
  readonly results: OpeningEntry[]
  readonly onPick: (e: OpeningEntry) => void
  readonly onClear: () => void
}) {
  if (results.length === 0) {
    return (
      <Empty
        message={`No openings match “${query}”. Try fewer words, or an ECO code such as B12.`}
        actionLabel="Clear the search"
        onAction={onClear}
      />
    )
  }
  return (
    <div className={`${LIST} max-h-64`} data-openings-results="true">
      {results.map((e) => (
        <button key={e.name} type="button" onClick={() => onPick(e)} className={ROW}>
          <span className={ECO}>{e.eco}</span>
          <span className="min-w-0 break-words [font:var(--type-body-sm)]">{e.name}</span>
        </button>
      ))}
    </div>
  )
}

function CoachNotes({ primary }: { readonly primary: string }) {
  const coach = COACH[primary]
  if (!coach) {
    return (
      <Surface label="Coaching notes" tone={2}>
        <p className="text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
          Step through the line on the board with the move controls, then train it against Stockfish. Coaching notes are
          being written for more openings.
        </p>
      </Surface>
    )
  }
  return (
    <Surface label="Coaching notes" tone={2}>
      <p className="text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
        <b className="text-[color:var(--text-primary)]">Themes: </b>
        {coach.themes}
      </p>
      <p className="ui-field-label">Middle-game plans</p>
      <ul className="grid list-disc gap-2 pl-5 text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
        {coach.plans.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </Surface>
  )
}

/**
 * The engine's suggested continuation to move 20. It stays in discovery and
 * behind a disclosure because `annotateOpening` exits the trainer: offering it
 * beside a live session would let one aid quietly end another.
 */
function AnalysisDisclosure({
  ctrl,
  entry,
  side,
  annotation,
  reviewPly,
  onTrainSuggested,
}: {
  readonly ctrl: ChessController
  readonly entry: OpeningEntry
  readonly side: 'w' | 'b'
  readonly annotation: AnnotationState | null
  readonly reviewPly: number | null
  readonly onTrainSuggested: () => void
}) {
  const running = annotation?.running === true
  const moves = annotation?.moves ?? []

  return (
    <details className="group grid gap-3">
      <summary className={DISCLOSURE}>
        <Icon name="chevron-right" size="sm" className="group-open:rotate-90" />
        Suggested line to move 20
      </summary>

      <div className="grid gap-3 pt-3">
        <div className="flex flex-wrap gap-2">
          <Btn loading={running} disabled={running} onClick={() => ctrl.annotateOpening(entry.moves, side)}>
            Suggest best moves
          </Btn>
          {annotation && !running && <Btn onClick={() => ctrl.clearAnnotation()}>Clear</Btn>}
        </div>

        <InlineFeedback
          state={running ? 'loading' : 'idle'}
          message={
            running ? annotation?.progress || 'Analysing the line…'
            : moves.length > 0 ? `${moves.length} moves analysed. Tap one to see it on the board.`
            : 'Stockfish plays the line on from where theory ends, one move at a time.'
          }
        />

        {moves.length > 0 && (
          <>
            <div className={`${LIST} max-h-80`}>
              {moves.map((m) => (
                <div key={m.ply}>
                  {m.theoryEnd && (
                    <p className="bg-[color:var(--brass-wash)] px-3 py-1 font-bold uppercase tracking-[0.06em] text-[color:var(--brass-base)] [font:var(--type-label)]">
                      Theory ends — Stockfish’s suggested moves from here
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => ctrl.gotoPly(m.ply)}
                    className={
                      ROW +
                      (reviewPly === m.ply ? ' bg-[color:var(--brass-wash)] ring-1 ring-inset ring-[color:var(--border-brass)]' : '')
                    }
                  >
                    <span className="w-9 shrink-0 text-right text-[color:var(--text-muted)] [font:var(--type-numeric)]">
                      {m.moveNo}
                      {m.side === 'w' ? '.' : '…'}
                    </span>
                    <span className="w-14 shrink-0 font-semibold [font:var(--type-numeric)]">{m.san}</span>
                    {!m.isBook && (
                      <span className="shrink-0 rounded-[var(--radius-xs)] border border-[color:var(--border-subtle)] px-1 uppercase tracking-[0.06em] text-[color:var(--text-muted)] [font:var(--type-label)]">
                        suggested
                      </span>
                    )}
                    {m.betterSan && (
                      <span className="shrink-0 text-[color:var(--status-caution)] [font:var(--type-numeric)]">try {m.betterSan}</span>
                    )}
                    <span className="ml-auto shrink-0 text-[color:var(--text-muted)] [font:var(--type-numeric)]">{m.evalWhite}</span>
                  </button>
                </div>
              ))}
            </div>
            <Btn onClick={onTrainSuggested}>Train this line with hints</Btn>
            <p className="max-w-[var(--type-measure)] text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
              Evals are from White’s side. “try” flags where Stockfish suggests a different move; “suggested” marks moves
              past the end of theory — these are recommendations, not played out by the engine.
            </p>
          </>
        )}
      </div>
    </details>
  )
}

/* ---------------------------------------------------------------- training */

/**
 * The focused session. Nothing here browses: the only ways out are finishing
 * the line or leaving deliberately, and the aids arrive in the order a player
 * reaches for them — status first, the book move next, hints on request, and
 * the whole line last, behind a disclosure, because reading it is giving up.
 */
function TrainingSessionView({
  ctrl,
  session,
  train,
  hints,
  onHints,
  onExit,
}: {
  readonly ctrl: ChessController
  readonly session: TrainingSession
  readonly train: SessionSlot
  readonly hints: boolean
  readonly onHints: (next: boolean) => void
  readonly onExit: () => void
}) {
  const finished = train.hintDisabled

  return (
    <div className="grid gap-4" data-openings-phase="training">
      <Surface label="Training session" tone={3}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--border-brass)] bg-[color:var(--brass-wash)] px-2.5 py-0.5 font-bold uppercase tracking-[0.06em] text-[color:var(--brass-base)] [font:var(--type-label)]">
            <Icon name="trophy" size="sm" />
            Training
          </span>
          <span className="text-[color:var(--text-muted)] [font:var(--type-body-sm)]">You play {sideName(session.side)}</span>
        </div>
        <LineIdentity entry={session.entry} label={session.label} />
      </Surface>

      <StatusNote slot={train} />

      <Btn
        primary
        disabled={finished}
        icon="skip-forward"
        onClick={() => ctrl.playBookMove('train')}
      >
        Play book move
      </Btn>
      {finished && (
        <p className="text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
          There is no book move to play right now — the line above is finished.
        </p>
      )}

      <label className="flex min-h-[var(--icon-target-min)] cursor-pointer items-center gap-3 text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
        <input
          type="checkbox"
          checked={hints}
          onChange={(e) => onHints(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--brass-base)]"
        />
        Show hint (highlight the book move)
      </label>

      <details className="group grid gap-2">
        <summary className={DISCLOSURE}>
          <Icon name="chevron-right" size="sm" className="group-open:rotate-90" />
          Show the whole line
        </summary>
        <p className="break-words pt-2 text-[color:var(--text-primary)] [font:var(--type-numeric)]">
          {formatMoves(session.entry.moves)}
        </p>
      </details>

      <Btn icon="arrow-left" onClick={onExit}>
        Leave training
      </Btn>
    </div>
  )
}

/* --------------------------------------------------------------- explorer */

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
  const [data, setData] = useState<OpeningsData | null>(database)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState(memory.query)
  const [sel, setSel] = useState<OpeningEntry | null>(memory.selected)
  const [trainSide, setTrainSide] = useState<'w' | 'b'>(memory.side)
  const [hints, setHints] = useState(memory.hints)
  const [session, setSession] = useState<TrainingSession | null>(memory.session)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (database) return
    let alive = true
    loadOpenings()
      .then((d) => {
        database = d
        if (alive) setData(d)
      })
      .catch((e) => alive && setErr(String(e)))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    memory.query = query
    memory.selected = sel
    memory.side = trainSide
    memory.hints = hints
    memory.session = session
  }, [query, sel, trainSide, hints, session])

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

  /* The controller, not this panel, decides whether a session exists: it clears
     the train slot whenever anything else takes the board (a new game, a replay,
     a preview, an analysis run). Remembering the line is this panel's job; being
     in training is the controller's. */
  const live = session !== null && sessionKey === 'train' && train.statusHtml !== ''

  if (live && session) {
    return (
      <TrainingSessionView
        ctrl={ctrl}
        session={session}
        train={train}
        hints={hints}
        onHints={(next) => {
          setHints(next)
          ctrl.setHints('train', next)
        }}
        onExit={() => {
          ctrl.previewLine(session.entry.moves, session.side)
          setSession(null)
        }}
      />
    )
  }

  if (err)
    return (
      <div data-openings-phase="error">
        <ErrorState
          message="Couldn’t load the opening database. Check your connection, then try again."
          onAction={() => {
            setErr('')
            loadOpenings()
              .then((d) => {
                database = d
                setData(d)
              })
              .catch((e) => setErr(String(e)))
          }}
          detail={err}
        />
      </div>
    )

  if (!data)
    return (
      <div data-openings-phase="loading">
        <Loading label="Loading the opening database…" />
      </div>
    )

  const startTrain = () => {
    if (!sel) return
    setSession({ entry: sel, label: variationOf(sel), side: trainSide, suggested: false })
    ctrl.startTrainerLine(
      {
        moves: sel.moves,
        you: trainSide,
        opening: sel.primary,
        variation: variationOf(sel),
        eco: sel.eco,
      },
      'train',
      hints,
    )
  }

  const trainSuggested = () => {
    if (!sel || !annotation) return
    setHints(true)
    setSession({
      entry: sel,
      label: sel.variation + ' — suggested line to move 20',
      side: trainSide,
      suggested: true,
    })
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
  }

  const watching = (replaying && sessionKey === 'train') || selfPlay

  return (
    <div className="grid gap-4" data-openings-phase={sel ? 'detail' : 'browse'}>
      {!sel && (
        <>
          <Field
            label={`Search openings · ${data.entries.length.toLocaleString()} lines`}
            description="Search by opening name or ECO code, or pick one of the popular lines below."
          >
            {(control) => (
              <input
                id={control.id}
                aria-describedby={control['aria-describedby']}
                ref={search}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="name or ECO — e.g. Najdorf, Caro-Kann, B12"
                autoComplete="off"
                className="ui-control"
              />
            )}
          </Field>

          {query ? (
            <SearchResults
              query={query}
              results={results}
              onPick={(e) => select(e)}
              onClear={() => {
                setQuery('')
                search.current?.focus()
              }}
            />
          ) : (
            <PopularPicks entries={popular} onPick={(e) => select(e)} />
          )}
        </>
      )}

      {sel && (
        <>
          <Btn icon="arrow-left" onClick={() => setSel(null)}>
            Back to all openings
          </Btn>

          <Surface label="Opening">
            <LineIdentity entry={sel} label={variationOf(sel)} />
          </Surface>

          <CoachNotes primary={sel.primary} />

          <div>
            <p className="ui-field-label mb-2">Train as</p>
            <SegmentedNav
              label="Train as"
              selectedId={trainSide}
              onSelect={(id) => flipSide(id as 'w' | 'b')}
              items={[
                { id: 'w', label: 'White' },
                { id: 'b', label: 'Black' },
              ]}
            />
          </div>

          <Btn primary icon="trophy" onClick={startTrain}>
            Train this line
          </Btn>
          <p className="max-w-[var(--type-measure)] text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
            Training hands you the board as {sideName(trainSide)} and checks every move against the book.
          </p>

          <details className="group grid gap-3">
            <summary className={DISCLOSURE}>
              <Icon name="chevron-right" size="sm" className="group-open:rotate-90" />
              Other ways to study this line
            </summary>
            <div className="grid gap-3 pt-3">
              <Btn
                active={replaying && sessionKey === 'train'}
                icon={watching ? 'stop' : 'play'}
                onClick={() => ctrl.watchMovesOut(sel.moves, trainSide)}
              >
                {watching ? 'Stop' : 'Watch this line played out'}
              </Btn>
              <AnalysisDisclosure
                ctrl={ctrl}
                entry={sel}
                side={trainSide}
                annotation={annotation}
                reviewPly={reviewPly}
                onTrainSuggested={trainSuggested}
              />
            </div>
          </details>

          {siblings.length > 0 && (
            <div>
              <p className="ui-field-label mb-2">Variations in this opening</p>
              <div className={`${LIST} max-h-48`}>
                {siblings.map((e) => (
                  <button key={e.name} type="button" onClick={() => select(e)} className={ROW}>
                    <span className={ECO}>{e.eco}</span>
                    <span className="min-w-0 break-words [font:var(--type-body-sm)]">{variationOf(e)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
