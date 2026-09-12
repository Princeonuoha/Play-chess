import { type ReactNode } from 'react'
import { Btn } from './controls'
import { Icon } from './icons'

/**
 * DESIGN.md 7.3 `EngineStatus`. Ready is `role="status"` so the transition is
 * announced once; failure is `role="alert"` because it changes what the board
 * can do. Every tone pairs its colour with a word — the dot is never the
 * carrier.
 *
 * `announce` exists because the workspace shows engine readiness twice: the
 * header pill is the product's global announcer, so a second instance repeats
 * the state visually without claiming the live region a second time. Failure
 * always announces — it is the one transition that costs the player a move.
 */
export function EngineStatus({
  state,
  engine,
  detail,
  announce = true,
  onRetry,
}: {
  readonly state: 'ready' | 'loading' | 'error'
  readonly engine?: string
  readonly detail?: string
  readonly announce?: boolean
  readonly onRetry?: () => void
}) {
  if (state === 'error') {
    return (
      <div className="ui-feedback" role="alert">
        <p className="ui-engine">
          <span className="ui-dot" data-tone="critical" aria-hidden="true" />
          Engine failed
        </p>
        {detail !== undefined && <p className="ui-feedback-line">{detail}</p>}
        {onRetry !== undefined && (
          <div className="ui-feedback-actions">
            <Btn icon="retry" onClick={onRetry}>
              Retry
            </Btn>
          </div>
        )}
      </div>
    )
  }

  return (
    <p
      className="ui-engine"
      role={announce ? 'status' : undefined}
      aria-busy={state === 'loading' ? true : undefined}
    >
      {state === 'loading' ? (
        <>
          <span className="ui-spinner" aria-hidden="true" />
          Loading engine…
        </>
      ) : (
        <>
          <span className="ui-dot" aria-hidden="true" />
          {engine === undefined ? 'Ready' : `Ready · ${engine}`}
        </>
      )}
    </p>
  )
}

/**
 * DESIGN.md 7.3 `StatusNote`. The status string stays trusted controller HTML
 * (DESIGN.md 8.7 D-03); only the tone and the live-region semantics are new.
 * The error tone escalates to `role="alert"` so routine status updates never
 * interrupt.
 */
export function StatusNote({
  slot,
  tone = 'default',
}: {
  slot: { statusHtml: string; note: string }
  readonly tone?: 'default' | 'error'
}) {
  const isError = tone === 'error'
  return (
    <div
      className="ui-statusnote"
      data-tone={tone}
      role={isError ? 'alert' : undefined}
      aria-live={isError ? undefined : 'polite'}
    >
      {isError && (
        <p className="ui-statusnote-head">
          <Icon name="alert" size="sm" />
          Error
        </p>
      )}
      {slot.statusHtml && (
        <div
          className="tr-status ui-statusnote-status"
          dangerouslySetInnerHTML={{ __html: slot.statusHtml }}
        />
      )}
      {slot.note && <div className="ui-statusnote-note">{slot.note}</div>}
    </div>
  )
}

function Skeletons({ rows }: { readonly rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <span className="ui-skeleton" key={row} aria-hidden="true" />
      ))}
    </>
  )
}

/**
 * DESIGN.md 7.3 `InlineFeedback`. The container renders from first paint at a
 * reserved height, so a result appearing never shifts the panel under the
 * user's pointer. Skeletons are decorative; the operation name carries the
 * meaning.
 */
export function InlineFeedback({
  state = 'idle',
  message,
  action,
  skeletonRows = 2,
}: {
  readonly state?: 'idle' | 'loading' | 'empty' | 'error'
  readonly message?: string
  readonly action?: ReactNode
  readonly skeletonRows?: number
}) {
  const isError = state === 'error'
  return (
    <div
      className="ui-feedback"
      role={isError ? 'alert' : undefined}
      aria-live={isError ? undefined : 'polite'}
      aria-busy={state === 'loading' ? true : undefined}
    >
      {message !== undefined && (
        <p className="ui-feedback-line" data-tone={isError ? 'error' : undefined}>
          {isError && <Icon name="alert" size="sm" />}
          <span>{message}</span>
        </p>
      )}
      {state === 'loading' && <Skeletons rows={skeletonRows} />}
      {action !== undefined && <div className="ui-feedback-actions">{action}</div>}
    </div>
  )
}

/** DESIGN.md 7.3 `Loading`. Reserved-height skeletons behind a named operation. */
export function Loading({ label, rows = 3 }: { readonly label: string; readonly rows?: number }) {
  return (
    <div className="ui-feedback" aria-busy={true} aria-live="polite">
      <p className="ui-feedback-line">{label}</p>
      <Skeletons rows={rows} />
    </div>
  )
}

/** DESIGN.md 7.3 `Empty`. One explanation of why, and exactly one way out. */
export function Empty({
  message,
  actionLabel,
  onAction,
}: {
  readonly message: string
  readonly actionLabel: string
  readonly onAction?: () => void
}) {
  return (
    <div className="ui-stateblock">
      <Icon name="inbox" size="lg" className="ui-mark" />
      <p className="ui-stateblock-text">{message}</p>
      <Btn primary onClick={onAction}>
        {actionLabel}
      </Btn>
    </div>
  )
}

/**
 * DESIGN.md 7.3 `Error`. Plain language first; the raw failure stays behind a
 * disclosure so it can be reported without ever being the headline.
 */
function ErrorState({
  message,
  actionLabel = 'Retry',
  onAction,
  detail,
}: {
  readonly message: string
  readonly actionLabel?: string
  readonly onAction?: () => void
  readonly detail?: string
}) {
  return (
    <div className="ui-stateblock" data-tone="error" role="alert">
      <Icon name="alert" size="lg" className="ui-mark ui-mark--error" />
      <p className="ui-stateblock-text">{message}</p>
      <Btn primary icon="retry" onClick={onAction}>
        {actionLabel}
      </Btn>
      {detail !== undefined && (
        <details className="ui-details">
          <summary className="ui-disclosure">Technical detail</summary>
          <span>{detail}</span>
        </details>
      )}
    </div>
  )
}

export { ErrorState as Error }
