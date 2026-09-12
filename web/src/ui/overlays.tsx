import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './icons'

/**
 * DESIGN.md 7.3 `DialogSurface`. A native `<dialog>` in a body portal, because
 * `showModal()` is the only mechanism that gives inertness for the page behind
 * it, top-layer stacking, and `::backdrop` without a library. Every route out —
 * Escape, the backdrop, the dismiss control, a choice — lands on the element's
 * own `close` event, so focus returns to the invoker exactly once no matter
 * which one the user took.
 */
const FOCUSABLE = 'button:not(:disabled), summary, [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** The caller's marked target, or the first focusable thing inside it. */
function initialFocus(node: HTMLDialogElement): HTMLElement | null {
  const marked = node.querySelector<HTMLElement>('[data-dialog-autofocus]')
  if (marked === null) return null
  return marked.matches(FOCUSABLE) ? marked : marked.querySelector<HTMLElement>(FOCUSABLE)
}

/**
 * DESIGN.md 8.5 A11Y-10 asks for a trap, and `showModal()` alone does not give
 * one: Chromium hands focus to the browser's own chrome when `Tab` leaves the
 * last control in the dialog, which drops `document.activeElement` back to the
 * body for a keypress. Wrapping the two ends closes that gap in the primitive
 * so no caller has to. `Escape` is deliberately untouched — a trap without an
 * exit is the defect this is not allowed to introduce.
 */
function wrapTab(node: HTMLDialogElement, event: React.KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== 'Tab') return
  const stops = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (stop) => stop.offsetWidth > 0 || stop.offsetHeight > 0 || stop.getClientRects().length > 0,
  )
  if (stops.length === 0) return
  const edge = event.shiftKey ? stops[0] : stops[stops.length - 1]
  if (document.activeElement !== edge) return
  event.preventDefault()
  ;(event.shiftKey ? stops[stops.length - 1] : stops[0]).focus()
}

export function DialogSurface({
  open,
  title,
  titleAs: Heading = 'h2',
  description,
  onClose,
  dismiss = 'head',
  dismissLabel = 'Close dialog',
  backdropClosable = true,
  children,
}: {
  readonly open: boolean
  readonly title: string
  /**
   * The dialog's own heading level. A dialog opened from inside a route's
   * `<h2>` section reads as that section's subordinate, so it may declare
   * `h3` rather than restart the document outline at `h2`.
   */
  readonly titleAs?: 'h2' | 'h3'
  readonly description?: string
  readonly onClose: () => void
  /**
   * `head` pairs the title with the dismiss `IconButton`. `none` hands the
   * dismiss duty to the caller, for a dialog whose exit has a consequence
   * worth wording (`Cancel promotion`) rather than a bare ×.
   */
  readonly dismiss?: 'head' | 'none'
  readonly dismissLabel?: string
  readonly backdropClosable?: boolean
  readonly children?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const invoker = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const node = dialog.current
    if (node === null) return
    if (open && !node.open) {
      invoker.current = document.activeElement as HTMLElement | null
      node.showModal()
      initialFocus(node)?.focus()
      return
    }
    if (!open && node.open) node.close()
  }, [open])

  /**
   * A caller that closes by unmounting — a promotion choice resolves the move
   * and the dialog stops existing — removes the element from the top layer
   * without the `close` event ever firing, which would strand focus on the
   * body. Restoring here as well keeps DESIGN.md 8.5 A11Y-10 true for that
   * route out too; the two paths are mutually exclusive, so focus is never
   * moved twice.
   */
  useEffect(
    () => () => {
      if (dialog.current?.open === true) invoker.current?.focus()
    },
    [],
  )

  if (typeof document === 'undefined') return null

  return createPortal(
    <dialog
      ref={dialog}
      className="ui-dialog"
      aria-labelledby={titleId}
      onClose={() => {
        invoker.current?.focus()
        onClose()
      }}
      onClick={(event) => {
        if (backdropClosable && event.target === dialog.current) onClose()
      }}
      onKeyDown={(event) => {
        if (dialog.current !== null) wrapTab(dialog.current, event)
      }}
    >
      {dismiss === 'head' ? (
        <div className="ui-dialog-head">
          <Heading className="ui-dialog-title" id={titleId}>
            {title}
          </Heading>
          <IconButton icon="close" label={dismissLabel} onClick={onClose} />
        </div>
      ) : (
        <Heading className="ui-dialog-title" id={titleId}>
          {title}
        </Heading>
      )}
      {description !== undefined && <p className="ui-dialog-body">{description}</p>}
      {children}
    </dialog>,
    document.body,
  )
}

export type ToastTone = 'default' | 'error'

export type ToastMessage = {
  readonly id: string
  readonly text: string
  readonly tone?: ToastTone
}

/**
 * DESIGN.md 7.3 `Toast` / 8.5 A11Y-07. Politeness is a property of the region,
 * not of a message, so the two politenesses are two permanent regions and a
 * message is rendered into the one its tone earns: routine confirmations wait
 * their turn, a failure interrupts. Both exist before the first message does,
 * because a live region created at announcement time is not announced.
 *
 * A toast never takes focus. Its countdown pauses while the pointer or the
 * keyboard is inside either lane, so a dismiss target cannot vanish from under
 * the user.
 */
export function ToastRegion({
  toasts,
  onDismiss,
  autoDismissMs = 0,
  dismissLabel = 'Dismiss notification',
}: {
  readonly toasts: readonly ToastMessage[]
  readonly onDismiss: (id: string) => void
  readonly autoDismissMs?: number
  readonly dismissLabel?: string
}) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (autoDismissMs <= 0 || paused || toasts.length === 0) return
    const timer = window.setTimeout(() => onDismiss(toasts[0].id), autoDismissMs)
    return () => window.clearTimeout(timer)
  }, [autoDismissMs, paused, toasts, onDismiss])

  const hold = {
    onPointerEnter: () => setPaused(true),
    onPointerLeave: () => setPaused(false),
    onFocusCapture: () => setPaused(true),
    onBlurCapture: () => setPaused(false),
  }

  const lane = (politeness: 'polite' | 'assertive') => (
    <div
      className="ui-toastregion"
      data-toast-lane={politeness}
      aria-live={politeness}
      aria-atomic="false"
      {...hold}
    >
      {toasts
        .filter((toast) => (toast.tone === 'error' ? politeness === 'assertive' : politeness === 'polite'))
        .map((toast) => (
          <Toast key={toast.id} toast={toast} dismissLabel={dismissLabel} onDismiss={onDismiss} />
        ))}
    </div>
  )

  return (
    <>
      {lane('polite')}
      {lane('assertive')}
    </>
  )
}

export function Toast({
  toast,
  onDismiss,
  dismissLabel = 'Dismiss notification',
}: {
  readonly toast: ToastMessage
  readonly onDismiss: (id: string) => void
  readonly dismissLabel?: string
}) {
  return (
    <div className="ui-toast" data-tone={toast.tone ?? 'default'}>
      <span>{toast.text}</span>
      <IconButton icon="close" label={dismissLabel} onClick={() => onDismiss(toast.id)} />
    </div>
  )
}
