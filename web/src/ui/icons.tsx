/* ---------------------------------------------------------------------------
 * The ONE icon family (DESIGN.md 5.1, plan todo 10).
 *
 * Local typed SVG, no icon package: DESIGN.md 5.1 requires "one package, or one
 * local typed set", and a local set keeps the bundle cost to the bytes actually
 * drawn here. Every icon in the product comes from `ICON_ARTWORK` below, so the
 * family can never fork:
 *
 *   - one geometry grid      — `viewBox="0 0 24 24"`, every path authored on it
 *   - one stroke system      — `fill="none"`, `stroke="currentColor"`,
 *                              `stroke-width: var(--icon-stroke)` (1.75),
 *                              round caps and joins
 *   - one size scale         — `var(--icon-size-sm|md|lg)` (16 / 20 / 24px)
 *   - one accessibility rule — a named icon is `role="img"` + `aria-label`;
 *                              an unnamed icon is `aria-hidden` and therefore
 *                              decorative, per DESIGN.md 5.3
 *
 * Size and stroke are read from `web/src/index.css` (the todo 9 token
 * authority) as `var()` references rather than literals, so a token change
 * moves every icon at once and `scripts/verify-icons.mjs` can prove that no
 * second stroke width or size ever enters the product.
 *
 * Todo 11 removed the dev-only stand-in that used to shadow this module: the
 * DESIGN.md 7.3 gallery now draws its marks from here, so there has never been
 * and can never be a second `Icon`.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react'

/**
 * Icon artwork. Authored on a 24x24 grid, stroked — never filled — so the
 * single stroke system is the only thing that describes weight.
 *
 * `circle-play` / `book` / `trophy` / `search` are the workspace navigation
 * marks introduced by todo 7, absorbed here verbatim so navigation and the
 * onboarding cards draw the same destination from the same source.
 */
const ICON_ARTWORK = {
  'circle-play': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.2 8.4 16 12l-5.8 3.6Z" />
    </>
  ),
  book: (
    <>
      <path d="M12 7.2V20" />
      <path d="M3 17.4V4.2h4.8A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 4.2-3H21v13.2h-5.4A3.6 3.6 0 0 0 12 20a3.6 3.6 0 0 0-3.6-2.6Z" />
    </>
  ),
  trophy: (
    <>
      <path d="M6.6 9.2H5.1a2.4 2.4 0 0 1 0-4.8h1.5" />
      <path d="M17.4 9.2h1.5a2.4 2.4 0 0 0 0-4.8h-1.5" />
      <path d="M4.8 20.4h14.4" />
      <path d="M10.2 14.4v2.3c0 1.1-1.4 1.6-2.1 2.4a3 3 0 0 0-.6 1.3" />
      <path d="M13.8 14.4v2.3c0 1.1 1.4 1.6 2.1 2.4a3 3 0 0 1 .6 1.3" />
      <path d="M17.4 3.6H6.6v5.8a5.4 5.4 0 0 0 10.8 0Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m20.4 20.4-4.9-4.9" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.7-2.6 2.7" />
      <path d="M12 17.1h.01" />
    </>
  ),
  play: <path d="M7.8 5.4 18.6 12 7.8 18.6Z" />,
  stop: <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="1.4" />,
  'skip-back': (
    <>
      <path d="M18.6 5.4 9.6 12l9 6.6Z" />
      <path d="M5.4 5.4v13.2" />
    </>
  ),
  'skip-forward': (
    <>
      <path d="M5.4 5.4 14.4 12l-9 6.6Z" />
      <path d="M18.6 5.4v13.2" />
    </>
  ),
  'chevron-left': <path d="m14.4 5.4-6.6 6.6 6.6 6.6" />,
  'chevron-right': <path d="m9.6 5.4 6.6 6.6-6.6 6.6" />,
  'arrow-left': (
    <>
      <path d="M19.2 12H4.8" />
      <path d="m10.8 5.4-6 6.6 6 6.6" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4.8 12h14.4" />
      <path d="m13.2 5.4 6 6.6-6 6.6" />
    </>
  ),
  explore: (
    <>
      <path d="M4.2 12h15.6" />
      <path d="m8.4 7.2-4.8 4.8 4.8 4.8" />
      <path d="m15.6 7.2 4.8 4.8-4.8 4.8" />
    </>
  ),
  /* DESIGN.md 7.3 state marks. They live here, not at their call sites,
     because `scripts/verify-icons.mjs` fails any `<svg>` authored outside this
     module — so a primitive can never grow artwork of its own. */
  alert: (
    <>
      <path d="M12 3.6 2.4 20.4h19.2Z" />
      <path d="M12 10.2v4.2" />
      <path d="M12 17.4h.01" />
    </>
  ),
  check: <path d="m4.8 12.6 4.8 4.8 9.6-10.8" />,
  close: (
    <>
      <path d="M6.6 6.6 17.4 17.4" />
      <path d="M17.4 6.6 6.6 17.4" />
    </>
  ),
  retry: (
    <>
      <path d="M20.4 12a8.4 8.4 0 1 1-2.46-5.94" />
      <path d="M20.4 4.2v4.8h-4.8" />
    </>
  ),
  inbox: (
    <>
      <path d="M21.6 13.8h-5.4l-1.8 2.4H9.6l-1.8-2.4H2.4" />
      <path d="M6.06 5.28 2.4 13.8v4.2a1.8 1.8 0 0 0 1.8 1.8h15.6a1.8 1.8 0 0 0 1.8-1.8v-4.2l-3.66-8.52a1.8 1.8 0 0 0-1.65-1.08H7.71a1.8 1.8 0 0 0-1.65 1.08Z" />
    </>
  ),
} as const satisfies Record<string, ReactNode>

/** Every icon the product may draw. A name outside this union does not exist. */
export type IconName = keyof typeof ICON_ARTWORK

/** DESIGN.md 5.1: the only three sizes, each a token reference. */
export type IconSize = 'sm' | 'md' | 'lg'

const SIZE_TOKEN = {
  sm: 'var(--icon-size-sm)',
  md: 'var(--icon-size-md)',
  lg: 'var(--icon-size-lg)',
} as const satisfies Record<IconSize, string>

export const ICON_NAMES = Object.keys(ICON_ARTWORK) as readonly IconName[]

export type IconProps = {
  readonly name: IconName
  /** DESIGN.md 5.1 scale. Defaults to the `md` (20px) interface size. */
  readonly size?: IconSize
  /**
   * DESIGN.md 5.3. Supply `label` only when the icon is the sole carrier of its
   * meaning; omit it when visible text already says the same thing and the icon
   * is decorative.
   */
  readonly label?: string
  readonly className?: string
}

/**
 * The only icon renderer in the product. Size and stroke are token references,
 * never literals, so every icon shares one weight at every size.
 */
export function Icon({ name, size = 'md', label, className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: SIZE_TOKEN[size], height: SIZE_TOKEN[size], strokeWidth: 'var(--icon-stroke)' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-icon={name}
      className={'shrink-0 ' + className}
    >
      {ICON_ARTWORK[name]}
    </svg>
  )
}

/**
 * A leading icon plus its visible label. The icon is decorative here (DESIGN.md
 * 5.3) because the label is the accessible name, so a control keeps the name it
 * had when the label was a glyph string.
 */
export function IconLabel({
  icon,
  size = 'md',
  children,
}: {
  readonly icon: IconName
  readonly size?: IconSize
  readonly children: ReactNode
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Icon name={icon} size={size} />
      {children}
    </span>
  )
}

/**
 * An icon-only control. DESIGN.md 5.2 forbids an unlabeled one and 7.3 puts the
 * hit area floor at `--icon-target-min` (44px), so the label is required and
 * the target is not negotiable at the call site.
 */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  className = '',
}: {
  readonly icon: IconName
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        'grid min-h-[var(--icon-target-min)] min-w-[var(--icon-target-min)] place-items-center rounded-[var(--radius-sm)] ' +
        'text-[color:var(--text-primary)] transition hover:bg-[var(--surface-inset-hover)] active:scale-95 ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--border-focus)] ' +
        'disabled:opacity-40 disabled:cursor-not-allowed ' +
        className
      }
    >
      <Icon name={icon} />
    </button>
  )
}
