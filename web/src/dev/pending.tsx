/* ---------------------------------------------------------------------------
 * DEV-ONLY stand-in for the one DESIGN.md 7.1 primitive todo 11 does not own.
 *
 * PENDING todo 12. `WorkspaceNav` is contracted in DESIGN.md 7.1 as "a new
 * routed primitive built on `SegmentedNav`, using `NavLink`". The routed
 * navigation itself already ships — todo 7 built it at
 * `web/src/workspace/WorkspaceChrome.tsx` — but rebuilding it on the
 * `SegmentedNav` visuals is part of the shell redesign in todo 12, which owns
 * the mobile layout those visuals have to survive. Implementing a second
 * routed nav here would be exactly the duplication DESIGN.md 7.4 forbids, so
 * this preview renders the target visuals against the real primitive cascade
 * and nothing else.
 *
 * Every other primitive todo 4 stubbed here is now real in `web/src/ui/`.
 * This module is never imported by product code and never reaches the
 * production bundle.
 * ------------------------------------------------------------------------- */

import { Icon, type IconName } from '../ui/primitives'

export type NavPreviewItem = {
  readonly id: string
  readonly label: string
  readonly icon: IconName
}

export function WorkspaceNavPreview({
  items,
  currentId,
  pendingId,
}: {
  readonly items: readonly NavPreviewItem[]
  readonly currentId: string
  readonly pendingId?: string
}) {
  const currentIndex = Math.max(
    items.findIndex((item) => item.id === currentId),
    0,
  )

  return (
    <nav
      className="ui-seg ui-seg--stacked"
      aria-label="Workspace preview"
      aria-busy={pendingId === undefined ? undefined : true}
      style={{ '--ui-seg-count': items.length, '--ui-seg-index': currentIndex } as React.CSSProperties}
    >
      <span className="ui-seg-indicator" aria-hidden="true" />
      {items.map((item) => (
        <a
          key={item.id}
          href={`#sc-${item.id}`}
          className="ui-seg-item"
          data-selected={item.id === currentId ? 'true' : 'false'}
          data-pending={item.id === pendingId ? 'true' : undefined}
          aria-current={item.id === currentId ? 'page' : undefined}
        >
          <Icon name={item.icon} size="sm" />
          <span className="ui-seg-label">{item.label}</span>
        </a>
      ))}
    </nav>
  )
}
