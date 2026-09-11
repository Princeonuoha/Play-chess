/* ---------------------------------------------------------------------------
 * DEV-ONLY stand-ins for DESIGN.md 7.1 primitives that do not exist yet.
 *
 * PENDING todo 11: `IconButton`, `Slider`, `Surface`, `SegmentedNav`,
 * `WorkspaceNav`, `EngineStatus`, `InlineFeedback`, `DialogSurface`, `Toast`,
 * `Loading`, `Empty`, and `Error` are contracted in DESIGN.md 7.3 but are not
 * implemented in `web/src/ui/primitives.tsx`. These stand-ins render the
 * documented contract so todo 11 has a gate to build against; they are never
 * imported by product code and never reach the production bundle.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef } from 'react'
import { Btn } from '../ui/primitives'

const ICON_PATHS = {
  check: 'M20 6 9 17l-5-5',
  info: 'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  close: 'M18 6 6 18M6 6l12 12',
  retry: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1Z',
  board: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  search: 'M21 21l-4.3-4.3M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
} as const

export type IconName = keyof typeof ICON_PATHS

/**
 * Applies attributes the current primitive API cannot express onto the real DOM
 * node a primitive renders, so the showcase can assert the DESIGN.md 7.3
 * contract against the element itself instead of a wrapper.
 * PENDING todo 11: delete once `Btn`, `Field`, and `GroupedSelect` accept
 * `loading`, `error`, and `disabled` props directly.
 */
export function Shim({ attrs, children }: { attrs: Record<string, string>; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const target = ref.current?.firstElementChild
    if (!target) return
    for (const [name, value] of Object.entries(attrs)) target.setAttribute(name, value)
  })
  return (
    <span className="sc-contents" ref={ref}>
      {children}
    </span>
  )
}

export function Icon({
  name,
  size = 'md',
  label,
  className = '',
}: {
  name: IconName
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}) {
  return (
    <svg
      className={`sc-icon ${className}`}
      data-size={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

export function IconButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: IconName
  label: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" className="sc-iconbtn" aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
    </button>
  )
}

export function Slider({
  label,
  value,
  valueText,
  disabled,
  onChange,
}: {
  label: string
  value: number
  valueText: string
  disabled?: boolean
  onChange?: (next: number) => void
}) {
  const id = `sc-slider-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="sc-slider">
      <div className="sc-slider-top">
        <label className="sc-state" htmlFor={id}>
          {label}
        </label>
        <span className="sc-slider-value">{valueText}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={20}
        step={1}
        value={value}
        disabled={disabled}
        aria-valuetext={valueText}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
    </div>
  )
}

export function Surface({
  title,
  body,
  interactive,
  actionLabel,
}: {
  title: string
  body: string
  interactive?: boolean
  actionLabel?: string
}) {
  if (interactive) {
    return (
      <button type="button" className="sc-surface sc-surface--interactive" aria-label={actionLabel ?? title}>
        <span className="sc-surface-title">{title}</span>
        <span className="sc-surface-body">{body}</span>
      </button>
    )
  }
  return (
    <section className="sc-surface" aria-label={title}>
      <h3 className="sc-surface-title">{title}</h3>
      <p className="sc-surface-body">{body}</p>
    </section>
  )
}

export type SegmentItem = {
  readonly id: string
  readonly label: string
  readonly icon?: IconName
  readonly disabled?: boolean
  readonly pending?: boolean
}

export function SegmentedNav({ items, selectedId }: { items: readonly SegmentItem[]; selectedId: string }) {
  return (
    <div className="sc-segmented" role="group" aria-label="Sub-surface">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="sc-segitem"
          data-selected={item.id === selectedId}
          aria-disabled={item.disabled ? 'true' : undefined}
          aria-pressed={item.id === selectedId}
        >
          {item.icon && <Icon name={item.icon} />}
          <span className="sc-seglabel">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

export function WorkspaceNav({
  items,
  currentId,
  pendingId,
}: {
  items: readonly SegmentItem[]
  currentId: string
  pendingId?: string
}) {
  return (
    <nav className="sc-segmented" aria-label="Workspace" aria-busy={pendingId ? 'true' : undefined}>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#sc-${item.id}`}
          className="sc-segitem"
          data-selected={item.id === currentId}
          data-pending={item.id === pendingId ? 'true' : undefined}
          aria-current={item.id === currentId ? 'page' : undefined}
        >
          {item.icon && <Icon name={item.icon} />}
          <span className="sc-seglabel">{item.label}</span>
        </a>
      ))}
    </nav>
  )
}

export function ModalDialog({
  open,
  title,
  body,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sc-dialog sc-dialog--modal"
      aria-labelledby="sc-modal-title"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="sc-dialog-head">
        <h2 className="sc-dialog-title" id="sc-modal-title">
          {title}
        </h2>
        <IconButton icon="close" label="Close dialog" onClick={onClose} />
      </div>
      <p className="sc-surface-body">{body}</p>
      <div className="sc-dialog-row">
        <Btn primary onClick={onClose}>
          Confirm
        </Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
    </dialog>
  )
}
