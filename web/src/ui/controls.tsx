import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

/**
 * DESIGN.md 7.3 `Btn`. The leading slot is reserved at rest for every button
 * that declares a `loading` prop, so swapping the spinner in changes no
 * geometry — that is the whole of the contract's "width is locked".
 */
export function Btn({
  children,
  onClick,
  primary,
  active,
  disabled,
  loading,
  icon,
  type = 'button',
  className = '',
}: {
  readonly children: ReactNode
  readonly onClick?: () => void
  readonly primary?: boolean
  readonly active?: boolean
  readonly disabled?: boolean
  readonly loading?: boolean
  readonly icon?: IconName
  readonly type?: 'button' | 'submit'
  readonly className?: string
}) {
  const brass = primary === true || active === true
  const reservesLead = loading !== undefined || icon !== undefined

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading === true ? true : undefined}
      className={`ui-btn ui-btn--${brass ? 'primary' : 'secondary'} ${className}`.trim()}
    >
      {reservesLead && (
        <span className="ui-btn-lead">
          {loading === true ? (
            <span className="ui-spinner" aria-hidden="true" />
          ) : icon !== undefined ? (
            <Icon name={icon} />
          ) : null}
        </span>
      )}
      <span className="ui-btn-label">{children}</span>
    </button>
  )
}

/** The identity and state a `Field` hands to the control it labels. */
export type FieldControl = {
  readonly id: string
  readonly 'aria-describedby': string | undefined
  readonly 'aria-invalid': true | undefined
  readonly 'aria-errormessage': string | undefined
  readonly disabled: boolean | undefined
}

/**
 * DESIGN.md 7.3 `Field`. Pass a node and the `<label>` wraps it, which is how
 * every existing panel uses it. Pass a function and the field hands back the
 * id, description, error, and disabled wiring the 7.3 row requires — the only
 * way to put `aria-invalid` and `aria-errormessage` on the control itself
 * rather than on a box around it.
 */
export function Field({
  label,
  children,
  description,
  error,
  disabled,
}: {
  readonly label: string
  readonly children: ReactNode | ((control: FieldControl) => ReactNode)
  readonly description?: string
  readonly error?: string
  readonly disabled?: boolean
}) {
  const uid = useId()
  const descriptionId = description === undefined ? undefined : `${uid}-description`
  const errorId = error === undefined ? undefined : `${uid}-error`
  const control: FieldControl = {
    id: `${uid}-control`,
    'aria-describedby': descriptionId,
    'aria-invalid': error === undefined ? undefined : true,
    'aria-errormessage': errorId,
    disabled,
  }

  return (
    <div className="ui-field" data-disabled={disabled === true ? 'true' : undefined}>
      {typeof children === 'function' ? (
        <>
          <label className="ui-field-label" htmlFor={control.id}>
            {label}
          </label>
          {children(control)}
        </>
      ) : (
        <label className="ui-field-stack">
          <span className="ui-field-label">{label}</span>
          {children}
        </label>
      )}
      {description !== undefined && (
        <p className="ui-field-desc" id={descriptionId}>
          {description}
        </p>
      )}
      {error !== undefined && (
        <p className="ui-field-error" id={errorId}>
          <Icon name="alert" size="sm" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export interface Group {
  label: string
  options: { value: number; label: string }[]
}

/** DESIGN.md 7.3 `GroupedSelect`. Native `<select>`, kept for platform pickers. */
export function GroupedSelect({
  value,
  groups,
  onChange,
  emptyText,
  control,
  disabled,
}: {
  value: number | ''
  groups: Group[]
  onChange: (v: number) => void
  emptyText?: string
  readonly control?: FieldControl
  readonly disabled?: boolean
}) {
  return (
    <select
      id={control?.id}
      aria-describedby={control?.['aria-describedby']}
      aria-invalid={control?.['aria-invalid']}
      aria-errormessage={control?.['aria-errormessage']}
      disabled={disabled ?? control?.disabled}
      value={value === '' ? '' : String(value)}
      onChange={(event) => onChange(parseInt(event.target.value, 10))}
      className="ui-control ui-select"
    >
      {groups.length === 0 && (
        <option value="" disabled>
          {emptyText || 'No results'}
        </option>
      )}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/**
 * DESIGN.md 7.3 `Slider`. `aria-valuetext` carries the human label so the
 * control never reads as a bare number, and the polite region beside it
 * repeats that label only once the value is committed — dragging across a
 * twenty-step range must not narrate twenty times.
 */
export function Slider({
  label,
  value,
  valueText,
  min = 0,
  max = 20,
  step = 1,
  disabled,
  onChange,
}: {
  readonly label: string
  readonly value: number
  readonly valueText: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly disabled?: boolean
  readonly onChange?: (next: number) => void
}) {
  const id = useId()
  const [committed, setCommitted] = useState(valueText)
  const fill = `${((value - min) / (max - min)) * 100}%`

  return (
    <div className="ui-slider">
      <div className="ui-slider-head">
        <label className="ui-field-label" htmlFor={id}>
          {label}
        </label>
        <span className="ui-slider-value">{valueText}</span>
      </div>
      <input
        id={id}
        className="ui-slider-input"
        style={{ '--ui-slider-fill': fill } as CSSProperties}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={valueText}
        onChange={(event) => onChange?.(Number(event.target.value))}
        onPointerUp={() => setCommitted(valueText)}
        onKeyUp={() => setCommitted(valueText)}
        onBlur={() => setCommitted(valueText)}
      />
      <span className="ui-sr-only" aria-live="polite">
        {committed}
      </span>
    </div>
  )
}
