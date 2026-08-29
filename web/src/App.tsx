import { useState } from 'react'

/* ---- Modern shell (step 1). Board + engine are ported next; this proves the
   Vite + React + TS + Tailwind toolchain and the new look. ---- */

type Tab = 'play' | 'openings' | 'games' | 'study'

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'openings', label: 'Openings' },
  { id: 'games', label: 'Games' },
  { id: 'study', label: 'Study' },
]

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        'rounded-2xl border border-white/10 bg-[var(--color-panel)]/80 backdrop-blur ' +
        'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_18px_40px_-20px_rgba(0,0,0,0.7)] ' +
        className
      }
    >
      {children}
    </div>
  )
}

function Btn({
  children,
  primary,
  className = '',
}: {
  children: React.ReactNode
  primary?: boolean
  className?: string
}) {
  return (
    <button
      className={
        'min-h-11 rounded-xl px-4 text-sm font-semibold transition ' +
        'active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brass)] ' +
        (primary
          ? 'bg-[var(--color-brass)] text-[#1a130a] hover:bg-[var(--color-brass-2)] shadow-lg shadow-black/30'
          : 'border border-white/10 bg-white/[0.03] text-[var(--color-ink)] hover:bg-white/[0.06]') +
        ' ' +
        className
      }
    >
      {children}
    </button>
  )
}

/* A static SVG board just to show the new visual language; the interactive board
   is the ported engine module (next step). */
function BoardPreview() {
  const squares = []
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const dark = (r + f) % 2 === 1
      squares.push(
        <div
          key={`${r}-${f}`}
          style={{ background: dark ? 'var(--color-board-d)' : 'var(--color-board-l)' }}
        />,
      )
    }
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-black/40 shadow-2xl shadow-black/50">
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">{squares}</div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('play')

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      {/* Header */}
      <header className="flex items-baseline gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          chesswithprince<span className="text-[var(--color-brass)]">.com</span>
        </h1>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-[var(--color-muted)]">
          Stockfish 18 · in your browser
        </span>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Board */}
        <div className="flex items-stretch gap-3">
          <div className="w-2.5 overflow-hidden rounded-full border border-white/10 bg-black/30">
            <div className="mt-[50%] h-1/2 w-full bg-white/80" />
          </div>
          <div className="flex-1">
            <BoardPreview />
          </div>
        </div>

        {/* Panel */}
        <Card className="overflow-hidden">
          <div className="border-b border-white/10 bg-white/[0.02] p-4">
            <div className="text-lg font-bold">Your move</div>
            <div className="text-sm text-[var(--color-muted)]">White to play</div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 bg-black/20 p-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  'flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition ' +
                  (tab === t.id
                    ? 'bg-[var(--color-brass)] text-[#1a130a] shadow'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]')
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Panel body */}
          <div className="grid gap-4 p-4">
            {tab === 'play' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Btn primary>New game</Btn>
                  <Btn>Flip</Btn>
                  <Btn>Take back</Btn>
                </div>
                <Btn>▶ Watch Stockfish finish this game</Btn>
                <div>
                  <div className="mb-1.5 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    Play as
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 p-1">
                    {['White', 'Black', 'Random'].map((s, i) => (
                      <button
                        key={s}
                        className={
                          'min-h-10 rounded-lg text-sm font-semibold transition ' +
                          (i === 0
                            ? 'bg-[var(--color-brass)] text-[#1a130a]'
                            : 'text-[var(--color-ink)] hover:bg-white/[0.05]')
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid gap-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <span className="flex justify-between">
                    Engine strength <b className="font-mono text-[var(--color-brass)]">2027</b>
                  </span>
                  <input type="range" className="accent-[var(--color-brass)]" defaultValue={60} />
                </label>
              </>
            )}
            {tab !== 'play' && (
              <div className="py-8 text-center text-sm text-[var(--color-muted)]">
                <span className="font-semibold capitalize text-[var(--color-ink)]">{tab}</span> —
                ported from the current app next.
              </div>
            )}
          </div>
        </Card>
      </div>

      <footer className="border-t border-white/10 pt-4 text-xs leading-relaxed text-[var(--color-muted)]">
        Engine: <b className="text-[var(--color-ink)]">Stockfish 18</b> (WebAssembly) running in your
        browser · new UI preview (React + Tailwind) · build web-shell
      </footer>
    </div>
  )
}
