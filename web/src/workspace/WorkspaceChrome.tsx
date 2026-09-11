import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { pieceSVG } from '../core/pieces'

export type WorkspaceRoute = {
  readonly path: '/play' | '/openings' | '/games' | '/study'
  readonly label: 'Play' | 'Openings' | 'Games' | 'Study'
}

export const WORKSPACE_ROUTES = [
  { path: '/play', label: 'Play' },
  { path: '/openings', label: 'Openings' },
  { path: '/games', label: 'Games' },
  { path: '/study', label: 'Study' },
] as const satisfies readonly WorkspaceRoute[]

export type Promotion = { readonly from: string; readonly to: string; readonly color: string }

export function Card({ children, className = '' }: { readonly children: ReactNode; readonly className?: string }) {
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

export function NavBtn({ children, onClick, label }: { readonly children: ReactNode; readonly onClick: () => void; readonly label: string }) {
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

export function WorkspaceNavigation() {
  return (
    <div className="m-1.5 flex gap-1 rounded-xl bg-black/20 p-1">
      <nav aria-label="Workspace" className="contents">
        {WORKSPACE_ROUTES.map((route) => (
          <NavLink key={route.path} to={route.path} className="flex-1">
            {({ isActive }) => (
              <button
                type="button"
                className={
                  'w-full rounded-lg px-2 py-2.5 text-sm font-semibold transition ' +
                  (isActive
                    ? 'bg-[var(--color-brass)] text-[#1a130a] shadow'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]')
                }
              >
                {route.label}
              </button>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function WorkspaceIntro({
  onDismiss,
  onSelect,
}: {
  readonly onDismiss: () => void
  readonly onSelect: (route: WorkspaceRoute) => void
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-brass)]/30 bg-[var(--color-panel)]/80 p-4 backdrop-blur sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold sm:text-lg">Welcome — here's how it works</h2>
        <button
          onClick={onDismiss}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Got it
        </button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {([
          [WORKSPACE_ROUTES[0], '♟', 'Play against Stockfish. Pick a difficulty from Beginner to Maximum, choose your colour, and drag or tap to move.'],
          [WORKSPACE_ROUTES[1], '📖', 'Drill a real opening line. The app plays the theory for the other side and checks your moves against the book.'],
          [WORKSPACE_ROUTES[2], '🏆', 'Play through or watch famous master games — search by player, opening, theme, or era.'],
          [WORKSPACE_ROUTES[3], '🔎', 'Review any game: Stockfish grades every move, shows the better move you missed, and tells you how the masters handled the line.'],
        ] as const).map(([route, icon, description]) => (
          <button
            key={route.path}
            onClick={() => onSelect(route)}
            className="group rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[var(--color-brass)]/50 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brass)]"
          >
            <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold text-[var(--color-brass)]">
              <span>{icon}</span>
              <span>{route.label}</span>
              <span className="ml-auto text-[var(--color-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-brass)]">→</span>
            </div>
            <div className="text-xs leading-relaxed text-[var(--color-muted)]">{description}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-[var(--color-muted)]">
        Tap a card to jump straight in · use the ◀ ▶ buttons under the board (or your arrow keys) to step through any game.
      </div>
    </div>
  )
}

export function WorkspaceFooter() {
  return (
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
  )
}

export function PromotionDialog({
  promotion,
  onCancel,
  onChoose,
}: {
  readonly promotion: Promotion
  readonly onCancel: () => void
  readonly onChoose: (piece: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={onCancel}>
      <div className="rounded-2xl border border-white/10 bg-[var(--color-panel)] p-4 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-muted)]">Promote to</h3>
        <div className="flex gap-2">
          {['q', 'r', 'b', 'n'].map((piece) => (
            <button
              key={piece}
              onClick={() => onChoose(piece)}
              className="grid h-16 w-16 place-items-center rounded-xl border border-white/10 bg-white/[0.03] hover:border-[var(--color-brass)]"
              dangerouslySetInnerHTML={{ __html: pieceSVG(piece, promotion.color) }}
              style={{ padding: 8 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
