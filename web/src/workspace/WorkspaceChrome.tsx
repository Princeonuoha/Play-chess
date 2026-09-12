import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { pieceSVG } from '../core/pieces'
import { Icon, IconButton, type IconName } from '../ui/primitives'

export type WorkspaceRoute = {
  readonly path: '/play' | '/openings' | '/games' | '/study'
  readonly label: 'Play' | 'Openings' | 'Games' | 'Study'
  /** DESIGN.md 5.1 family mark. */
  readonly icon: IconName
}

export const WORKSPACE_ROUTES = [
  { path: '/play', label: 'Play', icon: 'circle-play' },
  { path: '/openings', label: 'Openings', icon: 'book' },
  { path: '/games', label: 'Games', icon: 'trophy' },
  { path: '/study', label: 'Study', icon: 'search' },
] as const satisfies readonly WorkspaceRoute[]

export type Promotion = { readonly from: string; readonly to: string; readonly color: string }

export function Card({
  children,
  className = '',
  shell,
}: {
  readonly children: ReactNode
  readonly className?: string
  /** Marks the card as a named `data-shell` region for the layout geometry spec. */
  readonly shell?: string
}) {
  return (
    <div
      data-shell={shell}
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

/* ---------------------------------------------------------------------------
 * DESIGN.md 8.2 header row.
 *
 * One line at every viewport, `--icon-target-min` tall, carrying exactly three
 * things: the wordmark, engine state, and help. The pre-redesign header wrapped
 * to 88px on a 375px phone because the wordmark held its 30px display step
 * there; the step now starts at `--type-body` and climbs to `--type-display`
 * only once 768px makes it free, which is what collapses the row to 44px.
 *
 * The engine pill is authored here rather than delegated to the 7.3
 * `EngineStatus` primitive for one reason: `tests/baseline.spec.ts` and
 * `tests/smoke.spec.ts` — both outside this task's fence — assert on
 * `header > span.rounded-[var(--radius-pill)]` holding the controller's tag
 * verbatim (`loading engine…`), and `EngineStatus` writes its own copy. The
 * pill therefore reuses the primitive's own `.ui-engine` / `.ui-spinner` /
 * `.ui-dot` cascade rather than re-implementing its visuals, so there is still
 * exactly one engine-status appearance in the product.
 * ------------------------------------------------------------------------- */
export function WorkspaceHeader({
  engineTag,
  onHelp,
}: {
  readonly engineTag: string | undefined
  readonly onHelp: () => void
}) {
  const tag = engineTag ?? 'loading engine…'
  const loading = tag === 'loading engine…'
  const failed = tag === 'engine failed to load'

  return (
    <header data-shell="header" className="flex items-center gap-2 sm:gap-3">
      <h1 className="whitespace-nowrap tracking-tight [font:var(--type-body)] sm:[font:var(--type-title)] md:[font:var(--type-display)]">
        chesswithprince<span className="text-[color:var(--brass-base)]">.com</span>
      </h1>
      {/* DESIGN.md 8.5 A11Y-07: engine readiness is asynchronous, so it is announced. */}
      <span
        role="status"
        aria-busy={loading ? true : undefined}
        className="ui-engine ml-auto min-w-0 rounded-[var(--radius-pill)]"
      >
        {loading ? (
          <span className="ui-spinner" aria-hidden="true" />
        ) : (
          <span className="ui-dot" data-tone={failed ? 'critical' : undefined} aria-hidden="true" />
        )}
        {/* A phone cannot hold the whole build string beside the wordmark and a
            44px control; the tag elides its source suffix there and stays whole
            in the accessible name. */}
        <span className="truncate">{tag}</span>
      </span>
      <IconButton icon="help" label="How it works" onClick={onHelp} />
    </header>
  )
}

const SAFE_AREA_TRACK = {
  paddingLeft: 'max(0.25rem, env(safe-area-inset-left))',
  paddingRight: 'max(0.25rem, env(safe-area-inset-right))',
  paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))',
  scrollMarginBottom: 'env(safe-area-inset-bottom)',
} as const

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
                <Icon name={route.icon} />
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

/**
 * DESIGN.md 8.2 legal footer. Quiet — `--type-body-sm` in `--text-muted`,
 * separated by a hairline, pushed to the bottom edge by `mt-auto` — and
 * complete: the GPLv3 grant that lets this product ship Stockfish at all is
 * stated in full, never abbreviated, never collapsed behind a disclosure, and
 * its links are underlined so they are distinguishable without colour
 * (DESIGN.md 8.5 A11Y-05).
 */
function FooterLink({ href, children }: { readonly href: string; readonly children: string }) {
  return (
    <a
      className="text-[color:var(--text-link)] underline decoration-[color:var(--brass-rim)] underline-offset-2 hover:text-[color:var(--brass-lift)]"
      href={href}
      target="_blank"
      rel="noopener"
    >
      {children}
    </a>
  )
}

export function WorkspaceFooter() {
  return (
    <footer
      data-shell="footer"
      className="mt-auto border-t border-[color:var(--border-subtle)] pt-4 text-[color:var(--text-muted)] [font:var(--type-body-sm)]"
    >
      <p className="max-w-[var(--type-measure)]">
        Engine: <b className="text-[color:var(--text-secondary)]">Stockfish 18</b> (WebAssembly, single-threaded lite build) running
        in your browser — <FooterLink href="https://github.com/nmrugg/stockfish.js">stockfish.js</FooterLink>, licensed{' '}
        <FooterLink href="https://www.gnu.org/licenses/gpl-3.0.html">GPLv3</FooterLink>. Rules by{' '}
        <FooterLink href="https://github.com/jhlywa/chess.js">chess.js</FooterLink>. Piece artwork is original SVG for this project.
        · React + Tailwind
      </p>
    </footer>
  )
}

const PROMOTION_PIECES = [
  { piece: 'q', name: 'Queen' },
  { piece: 'r', name: 'Rook' },
  { piece: 'b', name: 'Bishop' },
  { piece: 'n', name: 'Knight' },
] as const

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
          {PROMOTION_PIECES.map(({ piece, name }) => (
            <button
              key={piece}
              onClick={() => onChoose(piece)}
              aria-label={`Promote to ${name}`}
              title={`Promote to ${name}`}
              className="grid h-16 w-16 min-h-[var(--icon-target-min)] min-w-[var(--icon-target-min)] place-items-center rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] hover:border-[color:var(--brass-base)]"
              dangerouslySetInnerHTML={{ __html: pieceSVG(piece, promotion.color) }}
              style={{ padding: 8 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
