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
        'rounded-[var(--radius-xl)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)]/80 backdrop-blur ' +
        'shadow-[var(--depth-inset-hairline),var(--depth-raised)] ' +
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
      className="grid h-9 min-w-9 place-items-center rounded-[var(--radius-sm)] text-sm text-[color:var(--text-primary)] transition hover:bg-[var(--surface-inset-hover)] active:scale-95"
    >
      {children}
    </button>
  )
}

const SAFE_AREA_TRACK = {
  paddingLeft: 'max(0.25rem, env(safe-area-inset-left))',
  paddingRight: 'max(0.25rem, env(safe-area-inset-right))',
  paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))',
  scrollMarginBottom: 'env(safe-area-inset-bottom)',
} as const

const NAV_ICON_ARTWORK = {
  '/play': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.2 8.4 16 12l-5.8 3.6Z" />
    </>
  ),
  '/openings': (
    <>
      <path d="M12 7.2V20" />
      <path d="M3 17.4V4.2h4.8A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 4.2-3H21v13.2h-5.4A3.6 3.6 0 0 0 12 20a3.6 3.6 0 0 0-3.6-2.6Z" />
    </>
  ),
  '/games': (
    <>
      <path d="M6.6 9.2H5.1a2.4 2.4 0 0 1 0-4.8h1.5" />
      <path d="M17.4 9.2h1.5a2.4 2.4 0 0 0 0-4.8h-1.5" />
      <path d="M4.8 20.4h14.4" />
      <path d="M10.2 14.4v2.3c0 1.1-1.4 1.6-2.1 2.4a3 3 0 0 0-.6 1.3" />
      <path d="M13.8 14.4v2.3c0 1.1 1.4 1.6 2.1 2.4a3 3 0 0 1 .6 1.3" />
      <path d="M17.4 3.6H6.6v5.8a5.4 5.4 0 0 0 10.8 0Z" />
    </>
  ),
  '/study': (
    <>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m20.4 20.4-4.9-4.9" />
    </>
  ),
} satisfies Record<WorkspaceRoute['path'], ReactNode>

function NavIcon({ path }: { readonly path: WorkspaceRoute['path'] }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      {NAV_ICON_ARTWORK[path]}
    </svg>
  )
}

export function WorkspaceNavigation() {
  return (
    <div data-nav-safe-area="true" style={SAFE_AREA_TRACK} className="m-1.5 flex gap-2 rounded-[var(--radius-lg)] bg-[var(--canvas-sunken)] p-1">
      <nav aria-label="Workspace" className="contents">
        {WORKSPACE_ROUTES.map((route) => (
          <NavLink
            key={route.path}
            to={route.path}
            className={({ isActive }) =>
              'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] px-1 py-2 text-center text-xs transition sm:px-2 sm:text-sm ' +
              (isActive
                ? 'bg-[color:var(--brass-base)] font-extrabold text-[color:var(--text-on-brass)] shadow-[var(--depth-flat)]'
                : 'font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]')
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon path={route.path} />
                <span>{route.label}</span>
                <span
                  aria-hidden="true"
                  data-nav-indicator={isActive ? 'active' : 'rest'}
                  className={
                    'h-0.5 w-6 rounded-[var(--radius-pill)] transition-colors duration-[var(--motion-base)] ' +
                    (isActive ? 'bg-[color:var(--text-on-brass)]' : 'bg-transparent')
                  }
                />
              </>
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
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--border-brass)] bg-[color:var(--surface-1)]/80 p-4 backdrop-blur sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold sm:text-lg">Welcome — here's how it works</h2>
        <button
          onClick={onDismiss}
          className="rounded-[var(--radius-sm)] border border-[color:var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
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
            className="group rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] p-3 text-left transition hover:border-[color:var(--border-brass)] hover:bg-[var(--surface-inset-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--border-focus)]"
          >
            <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold text-[color:var(--brass-base)]">
              <span>{icon}</span>
              <span>{route.label}</span>
              <span className="ml-auto text-[color:var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--brass-base)]">→</span>
            </div>
            <div className="text-xs leading-relaxed text-[color:var(--text-muted)]">{description}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-[color:var(--text-muted)]">
        Tap a card to jump straight in · use the ◀ ▶ buttons under the board (or your arrow keys) to step through any game.
      </div>
    </div>
  )
}

export function WorkspaceFooter() {
  return (
    <footer className="border-t border-[color:var(--border-subtle)] pt-4 text-xs leading-relaxed text-[color:var(--text-muted)]">
      Engine: <b className="text-[color:var(--text-primary)]">Stockfish 18</b> (WebAssembly, single-threaded lite build) running
      in your browser —{' '}
      <a className="text-[color:var(--text-link)]" href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">
        stockfish.js
      </a>
      , licensed{' '}
      <a className="text-[color:var(--text-link)]" href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">
        GPLv3
      </a>
      . Rules by{' '}
      <a className="text-[color:var(--text-link)]" href="https://github.com/jhlywa/chess.js" target="_blank" rel="noopener">
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
    <div className="fixed inset-0 z-[var(--z-dialog)] grid place-items-center bg-[var(--canvas-scrim)]" onClick={onCancel}>
      <div className="rounded-[var(--radius-xl)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-4 text-center shadow-[var(--depth-overlay)]" onClick={(event) => event.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-[color:var(--text-muted)]">Promote to</h3>
        <div className="flex gap-2">
          {['q', 'r', 'b', 'n'].map((piece) => (
            <button
              key={piece}
              onClick={() => onChoose(piece)}
              className="grid h-16 w-16 place-items-center rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] hover:border-[color:var(--brass-base)]"
              dangerouslySetInnerHTML={{ __html: pieceSVG(piece, promotion.color) }}
              style={{ padding: 8 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
