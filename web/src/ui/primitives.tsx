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
        'min-h-11 rounded-xl px-3 text-sm font-semibold transition select-none ' +
        'active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brass)] ' +
        'disabled:opacity-40 disabled:cursor-not-allowed ' +
        (brass
          ? 'bg-[var(--color-brass)] text-[#1a130a] hover:bg-[var(--color-brass-2)] shadow-lg shadow-black/30'
          : 'border border-white/10 bg-white/[0.03] text-[var(--color-ink)] hover:bg-white/[0.07]') +
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
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  )
}
