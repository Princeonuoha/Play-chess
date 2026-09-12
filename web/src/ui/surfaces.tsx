import { useRef, type CSSProperties, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

/**
 * DESIGN.md 7.3 `Surface`. A non-interactive surface is a named region and
 * never responds to hover; an interactive one is a single `<button>`, because
 * the contract allows exactly one focusable control to represent the whole
 * action rather than a card full of competing targets.
 */
export function Surface({
  label,
  title,
  body,
  tone = 1,
  onClick,
  actionLabel,
  className = '',
  children,
}: {
  readonly label?: string
  readonly title?: string
  readonly body?: string
  readonly tone?: 1 | 2 | 3
  readonly onClick?: () => void
  readonly actionLabel?: string
  readonly className?: string
  readonly children?: ReactNode
}) {
  const inner = (
    <>
      {title !== undefined && <span className="ui-surface-title">{title}</span>}
      {body !== undefined && <span className="ui-surface-body">{body}</span>}
      {children}
    </>
  )

  if (onClick !== undefined) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel ?? title ?? label}
        data-tone={tone}
        className={`ui-surface ui-surface--interactive ${className}`.trim()}
      >
        {inner}
      </button>
    )
  }

  return (
    <section aria-label={label ?? title} data-tone={tone} className={`ui-surface ${className}`.trim()}>
      {title !== undefined && <h3 className="ui-surface-title">{title}</h3>}
      {body !== undefined && <p className="ui-surface-body">{body}</p>}
      {children}
    </section>
  )
}

export type SegmentItem = {
  readonly id: string
  readonly label: string
  readonly icon?: IconName
  readonly disabled?: boolean
}

/**
 * DESIGN.md 7.3 `SegmentedNav`. Selection is one travelling object — the brass
 * fill and its 2px mark are the same element, positioned from the selected
 * index — so the eye follows a move instead of a blink. Arrow keys rove focus
 * inside the group; a disabled item stays focusable so its state is
 * discoverable rather than silently skipped.
 */
export function SegmentedNav({
  label,
  items,
  selectedId,
  onSelect,
  controlsPanels = false,
}: {
  readonly label: string
  readonly items: readonly SegmentItem[]
  readonly selectedId: string
  readonly onSelect?: (id: string) => void
  readonly controlsPanels?: boolean
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = items.findIndex((item) => item.id === selectedId)

  const moveFocus = (event: React.KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowLeft' ? -1
      : event.key === 'Home' ? -index
      : event.key === 'End' ? items.length - 1 - index
      : 0
    if (step === 0) return
    event.preventDefault()
    buttons.current[(index + step + items.length) % items.length]?.focus()
  }

  return (
    <div
      role={controlsPanels ? 'tablist' : 'group'}
      aria-label={label}
      className="ui-seg"
      style={{ '--ui-seg-count': items.length, '--ui-seg-index': Math.max(selectedIndex, 0) } as CSSProperties}
    >
      {selectedIndex >= 0 && <span className="ui-seg-indicator" aria-hidden="true" />}
      {items.map((item, index) => {
        const selected = item.id === selectedId
        return (
          <button
            key={item.id}
            type="button"
            ref={(node) => {
              buttons.current[index] = node
            }}
            role={controlsPanels ? 'tab' : undefined}
            aria-selected={controlsPanels ? selected : undefined}
            aria-pressed={controlsPanels ? undefined : selected}
            aria-disabled={item.disabled === true ? 'true' : undefined}
            tabIndex={selected || (selectedIndex < 0 && index === 0) ? 0 : -1}
            data-selected={selected ? 'true' : 'false'}
            className="ui-seg-item"
            onKeyDown={(event) => moveFocus(event, index)}
            onClick={() => {
              if (item.disabled !== true) onSelect?.(item.id)
            }}
          >
            {item.icon !== undefined && <Icon name={item.icon} size="sm" />}
            <span className="ui-seg-label">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
