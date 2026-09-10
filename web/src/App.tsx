import { useEffect, useRef, useState } from 'react'
import { ChessController, type Snapshot } from './core/controller'
import { pieceSVG } from './core/pieces'
import { BOOK, OPENING_IDX, side } from './core/book'
import { type Group } from './ui/primitives'
import { PlayPanel } from './panels/PlayPanel'
import { TrainPanel } from './panels/TrainPanel'
import { GamesPanel } from './panels/GamesPanel'
import { StudyPanel } from './panels/StudyPanel'

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

  const selfPlay = snap?.selfPlay ?? false
  const replaying = snap?.replaying ?? false
  const sessionKey = snap?.sessionKey ?? 'train'
  const finishLabel = selfPlay ? '■ Stop' : '▶ Watch Stockfish finish this game'
  const fullLabel = selfPlay ? '■ Stop' : '▶ Watch a full engine game'

  const reviewPly = snap?.reviewPly ?? null
  const exploring = snap?.exploring ?? false
  const history = snap?.history ?? []
  const canBrowse = history.length > 0 && !selfPlay && !replaying && !exploring && !(snap?.thinking ?? false)

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
              {/* board is imperative DOM inside a React ref by design (drag/animation perf); do not convert to JSX. */}
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
              <StudyPanel
                snap={snap}
                history={history}
                reviewPly={reviewPly}
                exploring={exploring}
                showToast={showToast}
                controller={ctrl}
              />
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
