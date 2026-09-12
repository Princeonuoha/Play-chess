import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './icons'

/**
 * DESIGN.md 7.3 `DialogSurface`. A native `<dialog>` in a body portal, because
 * `showModal()` is the only mechanism that gives a real focus trap, inertness
 * for the page behind it, top-layer stacking, and `::backdrop` without a
 * library. Escape and backdrop are routed back through `onClose` so React
 * state stays the single source of open-ness, and focus returns to whatever
 * invoked the dialog.
 */
const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** The caller's marked target, or the first focusable thing inside it. */
function initialFocus(node: HTMLDialogElement): HTMLElement | null {
  const marked = node.querySelector<HTMLElement>('[data-dialog-autofocus]')
  if (marked === null) return null
  return marked.matches(FOCUSABLE) ? marked : marked.querySelector<HTMLElement>(FOCUSABLE)
}

export function DialogSurface({
  open,
  title,
  description,
  onClose,
  dismissLabel = 'Close dialog',
  backdropClosable = true,
  children,
}: {
  readonly open: boolean
  readonly title: string
  readonly description?: string
  readonly onClose: () => void
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
    if (!open && node.open) {
      node.close()
      invoker.current?.focus()
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <dialog
      ref={dialog}
      className="ui-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (backdropClosable && event.target === dialog.current) onClose()
      }}
    >
      <div className="ui-dialog-head">
        <h2 className="ui-dialog-title" id={titleId}>
          {title}
        </h2>
        <IconButton icon="close" label={dismissLabel} onClick={onClose} />
      </div>
      {description !== undefined && <p className="ui-dialog-body">{description}</p>}
      {children}
    </dialog>,
    document.body,
  )
}

export type ToastMessage = {
  readonly id: string
  readonly text: string
  readonly tone?: 'default' | 'error'
}

/**
 * DESIGN.md 7.3 `Toast`. The region is permanent so the live region exists
 * before the first message does; a toast never takes focus, and its countdown
 * pauses while the pointer or the keyboard is inside it so a dismiss target
 * cannot vanish from under the user.
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

  return (
    <div
      className="ui-toastregion"
      aria-live="polite"
      aria-atomic="false"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} dismissLabel={dismissLabel} onDismiss={onDismiss} />
      ))}
    </div>
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
