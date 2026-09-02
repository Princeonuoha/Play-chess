import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChessController,
  type Snapshot,
  type SetKey,
  type MoveLabel,
  type SessionSlot,
  type AnnotationState,
  type ReviewItem,
} from './core/controller'
import { pieceSVG } from './core/pieces'
import { BOOK, OPENING_IDX, GAME_IDX, side, type BookLine } from './core/book'
import {
  loadOpenings,
  searchOpenings,
  POPULAR_PRIMARIES,
  type OpeningsData,
  type OpeningEntry,
} from './core/openings'
import { COACH } from './core/coach'

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

// Friendly difficulty tiers for the strength slider (0..20), named by real Elo.
function difficulty(v: number): { name: string; elo: string } {
  if (v >= 20) return { name: 'Maximum', elo: 'Max' }
  const elo = Math.round(1320 + ((3000 - 1320) * v) / 19)
  let name = 'Beginner'
  if (elo >= 2400) name = 'Master'
  else if (elo >= 2050) name = 'Expert'
  else if (elo >= 1750) name = 'Intermediate'
  else if (elo >= 1500) name = 'Casual'
  return { name, elo: String(elo) }
}

type Tab = 'play' | 'train' | 'games' | 'study'
type Facet = 'opening' | 'hero' | 'theme' | 'era'

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'train', label: 'Openings' },
  { id: 'games', label: 'Games' },
  { id: 'study', label: 'Study' },
]

interface Group {
  label: string
  options: { value: number; label: string }[]
}

function openingGroups(): Group[] {
  const groups: Record<string, { value: number; label: string }[]> = {}
  const order: string[] = []
  for (const i of OPENING_IDX) {
    const l = BOOK[i]
    const k = l.opening || '—'
    if (!groups[k]) {
      groups[k] = []
      order.push(k)
    }
    groups[k].push({ value: i, label: `${l.variation}  (${side(l)})` })
  }
  return order.map((k) => ({ label: k, options: groups[k] }))
}

function gameGroups(facet: Facet, query: string): Group[] {
  const q = query.trim().toLowerCase()
  const label = (l: BookLine) => `${l.variation}  (You: ${side(l)})`
  let indices = GAME_IDX
  if (q) {
    indices = GAME_IDX.filter((i) => {
      const l = BOOK[i]
      return [l.variation, l.hero, l.opening, l.theme, l.era, l.white, l.black].join(' ').toLowerCase().includes(q)
    })
    if (!indices.length) return []
    return [{ label: `${indices.length} result${indices.length > 1 ? 's' : ''}`, options: indices.map((i) => ({ value: i, label: label(BOOK[i]) })) }]
  }
  const groups: Record<string, { value: number; label: string }[]> = {}
  const order: string[] = []
  for (const i of indices) {
    const l = BOOK[i]
    const k = (l[facet] as string) || '—'
    if (!groups[k]) {
      groups[k] = []
      order.push(k)
    }
    groups[k].push({ value: i, label: label(BOOK[i]) })
  }
  return order.map((k) => ({ label: k, options: groups[k] }))
}

function metaHtml(l: BookLine | undefined): string {
  if (!l) return ''
  let meta = l.idea ? '<b>Idea:</b> ' + l.idea : ''
  if (l.game) {
    const bits = [l.opening, l.theme, l.era].filter(Boolean)
    if (bits.length) meta += ` <span style="opacity:.7">· ${bits.join(' · ')}</span>`
  }
  return meta
}

/* ---------- small styled primitives ---------- */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        'rounded-2xl border border-white/10 bg-[var(--color-panel)]/80 backdrop-blur ' +
        'shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_18px_44px_-22px_rgba(0,0,0,0.75)] ' +
        className
      }
    >
      {children}
    </div>
  )
}

function Btn({
  children,
  onClick,
  primary,
  active,
  disabled,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  primary?: boolean
  active?: boolean
  disabled?: boolean
  className?: string
}) {
  const brass = primary || active
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        'min-h-11 rounded-xl px-3 text-sm font-semibold transition select-none ' +
        'active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brass)] ' +
        'disabled:opacity-40 disabled:cursor-not-allowed ' +
        (brass
          ? 'bg-[var(--color-brass)] text-[#1a130a] hover:bg-[var(--color-brass-2)] shadow-lg shadow-black/30'
          : 'border border-white/10 bg-white/[0.03] text-[var(--color-ink)] hover:bg-white/[0.07]') +
        ' ' +
        className
      }
    >
      {children}
    </button>
  )
}

function NavBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-9 min-w-9 place-items-center rounded-lg text-sm text-[var(--color-ink)] transition hover:bg-white/[0.06] active:scale-95"
    >
      {children}
    </button>
  )
}

function GroupedSelect({
  value,
  groups,
  onChange,
  emptyText,
}: {
  value: number | ''
  groups: Group[]
  onChange: (v: number) => void
  emptyText?: string
}) {
  return (
    <select
      value={value === '' ? '' : String(value)}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-brass)] focus:outline-none"
    >
      {groups.length === 0 && (
        <option value="" disabled>
          {emptyText || 'No results'}
        </option>
      )}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  )
}

function StatusNote({ slot }: { slot: { statusHtml: string; note: string } }) {
  return (
    <>
      {slot.statusHtml && (
        <div
          className="tr-status min-h-[18px] text-[13px] font-semibold leading-snug"
          dangerouslySetInnerHTML={{ __html: slot.statusHtml }}
        />
      )}
      {slot.note && (
        <div className="mt-0.5 border-l-[3px] border-[var(--color-brass)] py-1.5 pl-3 text-[13px] leading-relaxed text-[var(--color-ink)]">
          {slot.note}
        </div>
      )}
    </>
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

export default function App() {
  const boardRef = useRef<HTMLDivElement>(null)
  const ctrlRef = useRef<ChessController | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [promo, setPromo] = useState<{ from: string; to: string; color: string } | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tab, setTab] = useState<Tab>('play')
  const [sideChoice, setSideChoice] = useState<'white' | 'black' | 'random'>('white')
  const [elo, setElo] = useState(4)
  const [tt, setTt] = useState(1000)
  const [facet, setFacet] = useState<Facet>('opening')
  const [search, setSearch] = useState('')
  const [gameSel, setGameSel] = useState<number>(GAME_IDX[0])
  const [mgHints, setMgHints] = useState(false)
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem('cwp_intro_seen') !== '1'
    } catch {
      return true
    }
  })
  const dismissIntro = () => {
    setShowIntro(false)
    try {
      localStorage.setItem('cwp_intro_seen', '1')
    } catch {}
  }

  // Build controller once.
  if (!ctrlRef.current) {
    ctrlRef.current = new ChessController({
      onSnapshot: (s) => setSnap(s),
      onPromo: (from, to, color) => setPromo({ from, to, color }),
    })
  }
  const ctrl = ctrlRef.current

  useEffect(() => {
    if (!boardRef.current) return
    ctrl.mount(boardRef.current)
    ctrl.boot()
    const onResize = () => ctrl.onResize()
    window.addEventListener('resize', onResize)
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowLeft') ctrl.navPrev()
      else if (e.key === 'ArrowRight') ctrl.navNext()
      else if (e.key === 'Home') ctrl.navFirst()
      else if (e.key === 'End') ctrl.navLast()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Leaving Study while viewing a reviewed position restores the live board.
  useEffect(() => {
    if (tab !== 'study' && snap?.reviewPly != null) ctrl.resumeGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const gGroups = useMemo(() => gameGroups(facet, search), [facet, search])

  // Keep the game selection valid as facet/search change.
  useEffect(() => {
    const flat = gGroups.flatMap((g) => g.options.map((o) => o.value))
    if (flat.length && !flat.includes(gameSel)) setGameSel(flat[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gGroups])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const diff = difficulty(elo)

  const copyPGN = () => {
    const pgn = ctrl.getPGN()
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

  const selfPlay = snap?.selfPlay ?? false
  const replaying = snap?.replaying ?? false
  const sessionKey = snap?.sessionKey ?? 'train'
  const finishLabel = selfPlay ? '■ Stop' : '▶ Watch Stockfish finish this game'
  const fullLabel = selfPlay ? '■ Stop' : '▶ Watch a full engine game'
  const watchLabel = (set: SetKey, idle: string) =>
    replaying && sessionKey === set ? '■ Stop replay' : selfPlay ? '■ Stop' : idle

  const review = snap?.review ?? null
  const reviewPly = snap?.reviewPly ?? null
  const exploring = snap?.exploring ?? false
  const exploreMoves = snap?.exploreMoves ?? []
  const history = snap?.history ?? []
  const canBrowse = history.length > 0 && !selfPlay && !replaying && !exploring && !(snap?.thinking ?? false)
  const rows: { n: number; w: string; b: string }[] = []
  for (let i = 0; i < history.length; i += 2) rows.push({ n: i / 2 + 1, w: history[i] || '', b: history[i + 1] || '' })

  const gameMeta = metaHtml(BOOK[gameSel])
  const gameSelValid = gGroups.some((g) => g.options.some((o) => o.value === gameSel))

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          chesswithprince<span className="text-[var(--color-brass)]">.com</span>
        </h1>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-[var(--color-muted)]">
          {snap?.engineTag ?? 'loading engine…'}
        </span>
        <button
          onClick={() => setShowIntro(true)}
          className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-bold text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          aria-label="How it works"
          title="How it works"
        >
          ?
        </button>
      </header>

      {showIntro && (
        <div className="rounded-2xl border border-[var(--color-brass)]/30 bg-[var(--color-panel)]/80 p-4 backdrop-blur sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold sm:text-lg">Welcome — here's how it works</h2>
            <button
              onClick={dismissIntro}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Got it
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {([
              ['play', '♟', 'Play', 'Play against Stockfish. Pick a difficulty from Beginner to Maximum, choose your colour, and drag or tap to move.'],
              ['train', '📖', 'Openings', 'Drill a real opening line. The app plays the theory for the other side and checks your moves against the book.'],
              ['games', '🏆', 'Games', 'Play through or watch famous master games — search by player, opening, theme, or era.'],
              ['study', '🔎', 'Study', 'Review any game: Stockfish grades every move, shows the better move you missed, and tells you how the masters handled the line.'],
            ] as [Tab, string, string, string][]).map(([id, icon, t, d]) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id)
                  dismissIntro()
                }}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[var(--color-brass)]/50 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brass)]"
              >
                <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold text-[var(--color-brass)]">
                  <span>{icon}</span>
                  <span>{t}</span>
                  <span className="ml-auto text-[var(--color-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-brass)]">
                    →
                  </span>
                </div>
                <div className="text-xs leading-relaxed text-[var(--color-muted)]">{d}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-[var(--color-muted)]">
            Tap a card to jump straight in · use the ◀ ▶ buttons under the board (or your arrow keys) to step through any game.
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Board + eval bar + move scrubber */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-stretch justify-center gap-3">
            <div className="evalbar" title="Evaluation (White's perspective)">
              <div className="white" style={{ height: `${((snap?.evalFrac ?? 0.5) * 100).toFixed(1)}%` }} />
              <div className="mid" />
              <div className="num">{snap?.evalLabel ?? '0.0'}</div>
            </div>
            <div className="flex min-w-0 flex-1 justify-center">
              <div ref={boardRef} className="board" />
            </div>
          </div>
          {canBrowse && (
            <div className="flex w-full max-w-[560px] items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
              <NavBtn onClick={() => ctrl.navFirst()} label="First move">⏮</NavBtn>
              <NavBtn onClick={() => ctrl.navPrev()} label="Previous move">◀</NavBtn>
              <div className="flex-1 text-center text-xs text-[var(--color-muted)]">
                {reviewPly === null ? (
                  <span>
                    Live · move {Math.ceil(history.length / 2)} <span className="opacity-50">· use ← →</span>
                  </span>
                ) : (
                  <span className="text-[var(--color-ink)]">
                    Viewing move {Math.ceil((reviewPly + 1) / 2) || 0}
                    {reviewPly < 0 ? ' · start' : reviewPly % 2 === 0 ? ' (White)' : ' (Black)'} / {Math.ceil(history.length / 2)}
                  </span>
                )}
              </div>
              <NavBtn onClick={() => ctrl.navNext()} label="Next move">▶</NavBtn>
              <NavBtn onClick={() => ctrl.navLast()} label="Latest / live">⏭</NavBtn>
            </div>
          )}
        </div>

        {/* Panel */}
        <Card className="overflow-hidden">
          <div className="border-b border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              {snap?.thinking && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-brass)] border-r-transparent" />
              )}
              <div className="text-lg font-bold">{snap?.statusWho ?? 'Your move'}</div>
            </div>
            <div className="text-sm text-[var(--color-muted)]">{snap?.statusSub ?? 'White to play'}</div>
          </div>

          {snap?.banner && (
            <div className="mx-4 mt-3 rounded-lg border border-[var(--color-brass)]/50 bg-white/[0.03] px-3 py-2.5 text-center text-sm font-semibold text-[var(--color-brass)]">
              {snap.banner}
            </div>
          )}

          {/* Tabs */}
          <div className="m-1.5 flex gap-1 rounded-xl bg-black/20 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  'flex-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition ' +
                  (tab === t.id
                    ? 'bg-[var(--color-brass)] text-[#1a130a] shadow'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]')
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 p-4">
            {tab === 'play' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Btn primary onClick={() => ctrl.newGame(sideChoice)}>
                    New game
                  </Btn>
                  <Btn onClick={() => ctrl.flip()}>Flip</Btn>
                  <Btn onClick={() => ctrl.undo()}>Take back</Btn>
                </div>
                <Btn active={selfPlay} onClick={() => ctrl.finishGame()}>
                  {finishLabel}
                </Btn>
                <Field label="Play as">
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 p-1">
                    {(['white', 'black', 'random'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSideChoice(s)}
                        className={
                          'min-h-10 rounded-lg text-sm font-semibold capitalize transition ' +
                          (sideChoice === s
                            ? 'bg-[var(--color-brass)] text-[#1a130a]'
                            : 'text-[var(--color-ink)] hover:bg-white/[0.05]')
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
                <label className="grid gap-2">
                  <span className="flex items-baseline justify-between text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    Difficulty
                    <b className="font-semibold text-[var(--color-brass)]">
                      {diff.name} <span className="font-mono text-[10px] text-[var(--color-muted)]">~{diff.elo}</span>
                    </b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={elo}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setElo(v)
                      ctrl.setEloSlider(v)
                    }}
                    className="accent-[var(--color-brass)]"
                  />
                  <span className="flex justify-between text-[10px] text-[var(--color-muted)]">
                    <span>Beginner</span>
                    <span>Maximum</span>
                  </span>
                </label>
                <label className="grid gap-2">
                  <span className="flex justify-between text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    Think time <b className="font-mono text-[var(--color-brass)]">{(tt / 1000).toFixed(1)} s</b>
                  </span>
                  <input
                    type="range"
                    min={100}
                    max={3000}
                    step={100}
                    value={tt}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setTt(v)
                      ctrl.setThinkTime(v)
                    }}
                    className="accent-[var(--color-brass)]"
                  />
                </label>
                <Btn active={selfPlay} onClick={() => ctrl.watchFullGame()}>
                  {fullLabel}
                </Btn>
              </>
            )}

            {tab === 'train' && snap && (
              <OpeningsExplorer
                ctrl={ctrl}
                train={snap.train}
                replaying={replaying}
                selfPlay={selfPlay}
                sessionKey={sessionKey}
                annotation={snap.annotation}
                reviewPly={reviewPly}
              />
            )}

            {tab === 'games' && (
              <>
                <Field label="Search games">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="player, opening, e.g. Fischer or Berlin"
                    autoComplete="off"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brass)] focus:outline-none"
                  />
                </Field>
                <Field label="Browse by">
                  <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 p-1">
                    {(['opening', 'hero', 'theme', 'era'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setFacet(f)
                          setSearch('')
                        }}
                        className={
                          'min-h-10 rounded-lg text-xs font-semibold transition ' +
                          (facet === f && !search
                            ? 'bg-[var(--color-brass)] text-[#1a130a]'
                            : 'text-[var(--color-ink)] hover:bg-white/[0.05]')
                        }
                      >
                        {f === 'hero' ? 'Player' : f[0].toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Master game">
                  <GroupedSelect
                    value={gameSelValid ? gameSel : ''}
                    groups={gGroups}
                    onChange={setGameSel}
                    emptyText={search ? `No games match “${search}”` : 'No games'}
                  />
                </Field>
                <div className="text-xs leading-relaxed text-[var(--color-muted)]" dangerouslySetInnerHTML={{ __html: gameMeta }} />
                <div className="grid grid-cols-2 gap-2">
                  <Btn primary disabled={!gameSelValid} onClick={() => ctrl.startTrainer(gameSel, 'games', mgHints)}>
                    Play through
                  </Btn>
                  <Btn disabled={snap?.games.hintDisabled ?? true} onClick={() => ctrl.playBookMove('games')}>
                    Play game move
                  </Btn>
                </div>
                <Btn active={replaying && sessionKey === 'games'} disabled={!gameSelValid} onClick={() => ctrl.watch(gameSel, 'games')}>
                  {watchLabel('games', '▶ Watch this game')}
                </Btn>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-muted)]">
                  <input
                    type="checkbox"
                    checked={mgHints}
                    onChange={(e) => {
                      setMgHints(e.target.checked)
                      ctrl.setHints('games', e.target.checked)
                    }}
                    className="h-4 w-4 accent-[var(--color-brass)]"
                  />
                  Show hint (highlight the next move)
                </label>
                {snap && <StatusNote slot={snap.games} />}
              </>
            )}

            {tab === 'study' && (
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
                          onClick={() => ctrl.exploreUndo()}
                          disabled={!exploreMoves.length}
                          className="min-h-0 flex-none px-3 py-1.5"
                        >
                          Undo
                        </Btn>
                        <Btn onClick={() => ctrl.exitExplore()} className="min-h-0 flex-none px-3 py-1.5">
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
                  <Btn onClick={() => ctrl.startExplore()} className="justify-self-start min-h-0 flex-none px-3 py-1.5">
                    ↔ Explore — play your own moves
                  </Btn>
                )}

                {/* Game review */}
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Game review</span>
                  <div className="flex gap-2">
                    {review && (
                      <Btn onClick={() => ctrl.clearReview()} className="min-h-0 flex-none px-3 py-1.5">
                        Clear
                      </Btn>
                    )}
                    <Btn
                      primary
                      disabled={review?.running || !history.length}
                      onClick={() => ctrl.reviewGame()}
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
                      <Btn onClick={() => ctrl.resumeGame()} className="min-h-0 flex-none px-3 py-1.5">
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
                          onClick={() => ctrl.gotoPly(it.ply)}
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
                  <Btn disabled={snap?.analyzing} onClick={() => ctrl.analyze()} className="min-h-0 flex-none px-3 py-1.5">
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
            )}
          </div>
        </Card>
      </div>

      <footer className="border-t border-white/10 pt-4 text-xs leading-relaxed text-[var(--color-muted)]">
        Engine: <b className="text-[var(--color-ink)]">Stockfish 18</b> (WebAssembly, single-threaded lite build) running
        in your browser —{' '}
        <a className="text-[var(--color-brass)]/80" href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">
          stockfish.js
        </a>
        , licensed{' '}
        <a className="text-[var(--color-brass)]/80" href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">
          GPLv3
        </a>
        . Rules by{' '}
        <a className="text-[var(--color-brass)]/80" href="https://github.com/jhlywa/chess.js" target="_blank" rel="noopener">
          chess.js
        </a>
        . Piece artwork is original SVG for this project. · React + Tailwind
      </footer>

      {/* Promotion modal */}
      {promo && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60"
          onClick={() => {
            ctrl.cancelPromotion()
            setPromo(null)
          }}
        >
          <div className="rounded-2xl border border-white/10 bg-[var(--color-panel)] p-4 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-muted)]">Promote to</h3>
            <div className="flex gap-2">
              {['q', 'r', 'b', 'n'].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    ctrl.finishPromotion(t)
                    setPromo(null)
                  }}
                  className="grid h-16 w-16 place-items-center rounded-xl border border-white/10 bg-white/[0.03] hover:border-[var(--color-brass)]"
                  dangerouslySetInnerHTML={{ __html: pieceSVG(t, promo.color) }}
                  style={{ padding: 8 }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-[var(--color-brass)]/50 bg-[var(--color-panel)] px-4 py-2.5 text-sm shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}
