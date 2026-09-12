/* ---------- shared styled primitives ---------- */
// Moved verbatim out of App.tsx so the extracted tab panels (web/src/panels/*)
// can reuse them without importing App.tsx (which would be a circular import).
// ClassNames and design tokens are unchanged.

export function Btn({
  children,
  onClick,
  primary,
  active,
  disabled,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  primary?: boolean
  active?: boolean
  disabled?: boolean
  className?: string
}) {
  const brass = primary || active
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        'min-h-11 rounded-[var(--radius-lg)] px-3 text-sm font-semibold transition select-none ' +
        'active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--border-focus)] ' +
        'disabled:opacity-40 disabled:cursor-not-allowed ' +
        (brass
          ? 'bg-[color:var(--brass-base)] text-[color:var(--text-on-brass)] hover:bg-[color:var(--brass-lift)] shadow-[var(--depth-floating)]'
          : 'border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] text-[color:var(--text-primary)] hover:bg-[var(--surface-inset-hover)]') +
        ' ' +
        className
      }
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]">{label}</span>
      {children}
    </label>
  )
}

export interface Group {
  label: string
  options: { value: number; label: string }[]
}

export function GroupedSelect({
  value,
  groups,
  onChange,
  emptyText,
}: {
  value: number | ''
  groups: Group[]
  onChange: (v: number) => void
  emptyText?: string
}) {
  return (
    <select
      value={value === '' ? '' : String(value)}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="w-full cursor-pointer rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--canvas-sunken)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] focus:border-[color:var(--brass-base)] focus:outline-none"
    >
      {groups.length === 0 && (
        <option value="" disabled>
          {emptyText || 'No results'}
        </option>
      )}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function StatusNote({ slot }: { slot: { statusHtml: string; note: string } }) {
  return (
    <>
      {slot.statusHtml && (
        <div
          className="tr-status min-h-[18px] [font:var(--type-body-sm)]"
          dangerouslySetInnerHTML={{ __html: slot.statusHtml }}
        />
      )}
      {slot.note && (
        <div className="mt-0.5 border-l-[3px] border-[color:var(--brass-base)] py-1.5 pl-3 [font:var(--type-body-sm)] text-[color:var(--text-primary)]">
          {slot.note}
        </div>
      )}
    </>
  )
}
