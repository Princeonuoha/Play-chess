import { useEffect, useRef, useState } from 'react'
import {
  ChessController,
  type Snapshot,
  type MoveLabel,
  type ReviewItem,
} from './core/controller'
import { pieceSVG } from './core/pieces'
import { BOOK, OPENING_IDX, side } from './core/book'
import { Btn, type Group } from './ui/primitives'
import { PlayPanel } from './panels/PlayPanel'
import { TrainPanel } from './panels/TrainPanel'
import { GamesPanel } from './panels/GamesPanel'

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

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'train', label: 'Openings' },
  { id: 'games', label: 'Games' },
  { id: 'study', label: 'Study' },
]

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

  const review = snap?.review ?? null
  const reviewPly = snap?.reviewPly ?? null
  const exploring = snap?.exploring ?? false
  const exploreMoves = snap?.exploreMoves ?? []
  const history = snap?.history ?? []
  const canBrowse = history.length > 0 && !selfPlay && !replaying && !exploring && !(snap?.thinking ?? false)
  const rows: { n: number; w: string; b: string }[] = []
  for (let i = 0; i < history.length; i += 2) rows.push({ n: i / 2 + 1, w: history[i] || '', b: history[i + 1] || '' })

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
              <PlayPanel
                snap={snap}
                elo={elo}
                tt={tt}
                sideChoice={sideChoice}
                setSideChoice={setSideChoice}
                diff={diff}
                finishLabel={finishLabel}
                fullLabel={fullLabel}
                onNewGame={() => ctrl.newGame(sideChoice)}
                onFlip={() => ctrl.flip()}
                onUndo={() => ctrl.undo()}
                onSetElo={(v) => {
                  setElo(v)
                  ctrl.setEloSlider(v)
                }}
                onSetTt={(v) => {
                  setTt(v)
                  ctrl.setThinkTime(v)
                }}
                controller={ctrl}
              />
            )}

            {tab === 'train' && snap && (
              <TrainPanel
                snap={snap}
                replaying={replaying}
                selfPlay={selfPlay}
                sessionKey={sessionKey}
                reviewPly={reviewPly}
                controller={ctrl}
              />
            )}

            {tab === 'games' && (
              <GamesPanel
                snap={snap}
                replaying={replaying}
                selfPlay={selfPlay}
                sessionKey={sessionKey}
                controller={ctrl}
              />
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
