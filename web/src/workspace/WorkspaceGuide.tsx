/* ---------------------------------------------------------------------------
 * DESIGN.md 8.3 first visit, as a dialog (plan todo 18).
 *
 * The defect this closes is geometric. As an in-flow block between the header
 * and the board, the welcome content stood 578px tall on a 375px phone and
 * pushed the board's top edge to y=738 — 178px past the §8.3 threshold, below
 * the fold on the very first screen a player ever sees. Todo 12 bought the
 * threshold back by collapsing the block to a 44px disclosure; this lifts it
 * out of the document entirely.
 *
 * Nothing is deleted to get there. Every destination, every description and the
 * transport hint are still present, still keyboard reachable and still
 * announced — they now live inside the 7.3 `DialogSurface`, a native `<dialog>`
 * rendered through a portal into `document.body`. A modal dialog is
 * `position: fixed` in the top layer, so it costs the document exactly zero
 * height: the board renders at the same y whether the guide is open or not,
 * which is what `tests/layout.spec.ts` and `tests/onboarding.spec.ts` assert.
 *
 * Focus is the other half of the contract (DESIGN.md 8.5 A11Y-10). `showModal()`
 * is the only mechanism that gives a real trap, inertness for the page behind,
 * and `::backdrop` without a library; `DialogSurface` routes Escape, the
 * backdrop, the dismiss control and every choice through the element's own
 * `close` event, so focus returns to the invoking control exactly once no
 * matter which exit the user took.
 *
 * `data-shell="intro"` stays on the content block: the first-visit surface is
 * still a named shell region for the geometry specs and the geometry script —
 * it moved out of the flow, it was not removed.
 * ------------------------------------------------------------------------- */
import type { RefObject } from 'react'
import { Btn, DialogSurface, Icon, Surface, type IconName } from '../ui/primitives'
import { WORKSPACE_ROUTES, type WorkspaceRoute } from './WorkspaceChrome'

/**
 * One clause per destination. The dialog body is `min(92vw, 26rem)` wide, so a
 * description that runs past a clause costs a line of height on a phone and
 * pushes the dismiss control towards the fold; the long-form explanation of
 * each route lives on the route itself, where it is contextual.
 */
const GUIDE_DESTINATIONS = [
  [WORKSPACE_ROUTES[0], 'Play Stockfish from Beginner to Maximum, as either colour.'],
  [WORKSPACE_ROUTES[1], 'Drill a real opening line against the book.'],
  [WORKSPACE_ROUTES[2], 'Replay famous master games, searchable by player or theme.'],
  [WORKSPACE_ROUTES[3], 'Have every move of a game graded, with the move you missed.'],
] as const satisfies readonly (readonly [WorkspaceRoute, string])[]

export function WorkspaceGuide({
  open,
  onClose,
  onSelect,
  fallbackFocus,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSelect: (route: WorkspaceRoute) => void
  readonly fallbackFocus: RefObject<HTMLElement>
}) {
  return (
    <DialogSurface
      open={open}
      title="Welcome — here's how it works"
      description="One board, four workspaces. Your game follows you between them, so nothing is lost when you switch."
      dismissLabel="Close the guide"
      onClose={onClose}
      fallbackFocus={fallbackFocus}
    >
      {/* The named first-visit region (DESIGN.md 8.3). It sits inside the
          dialog, so it is measured out of the document's flow. */}
      <div data-shell="intro" className="grid gap-3">
        <div className="grid gap-2">
          {GUIDE_DESTINATIONS.map(([route, description], index) => (
            /* `ui-contents` marks the initial focus target without adding a box
               to the dialog's grid, so the ring lands on the first choice. */
            <span
              key={route.path}
              className="ui-contents"
              data-dialog-autofocus={index === 0 ? true : undefined}
            >
              <Surface tone={2} onClick={() => onSelect(route)} actionLabel={`${route.label}: ${description}`}>
                <span className="flex items-center gap-2 text-[color:var(--brass-base)] [font:var(--type-heading)]">
                  <Icon name={route.icon} size="sm" />
                  {route.label}
                </span>
                <span className="text-[color:var(--text-muted)] [font:var(--type-body-sm)]">{description}</span>
              </Surface>
            </span>
          ))}
        </div>

        {/* Transport is the one thing a player cannot discover from the board
            itself, so it is stated — behind a disclosure, because it is
            reference material rather than the promise. */}
        <details className="ui-details">
          <summary className="ui-disclosure list-none gap-2">
            <Icon
              name="chevron-right"
              size="sm"
              className="text-[color:var(--brass-base)] transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease-out)] [[open]_&]:rotate-90"
            />
            <span className="[font:var(--type-body-sm)]">Moving and reviewing</span>
          </summary>
          <p className="pt-2 [font:var(--type-body-sm)]">
            Drag a piece, or tap it and tap its square. Step through any game with the arrow keys, or with the buttons under the
            board.
          </p>
        </details>
      </div>

      <Btn primary onClick={onClose}>
        Got it
      </Btn>
    </DialogSurface>
  )
}

/**
 * DESIGN.md 7.3 `Empty`'s quieter sibling: a route states what it is waiting
 * for while it has nothing to show, instead of rendering an unexplained blank.
 * It is help rather than a result, so it carries no live region and never takes
 * focus — it is read in DOM order, ahead of the surface it explains.
 */
export function RouteHint({
  route,
  icon,
  children,
}: {
  readonly route: WorkspaceRoute['label']
  readonly icon: IconName
  readonly children: string
}) {
  return (
    <p
      data-route-hint={route}
      className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2.5 text-[color:var(--text-muted)] [font:var(--type-body-sm)]"
    >
      <Icon name={icon} size="sm" className="mt-0.5 text-[color:var(--brass-base)]" />
      <span className="min-w-0 max-w-[var(--type-measure)]">{children}</span>
    </p>
  )
}
