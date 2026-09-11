/* ---------------------------------------------------------------------------
 * DEV-ONLY entry for the primitive showcase (plan todo 4).
 *
 * Reachable ONLY through `web/showcase.html`, which is not a Vite build input
 * (`vite build` defaults `rollupOptions.input` to `<root>/index.html` and the
 * project never widens it), so nothing below is emitted into `../dist`. The
 * `import.meta.env.PROD` guard makes that structural fact fail loudly instead
 * of silently if a future config change ever pulls this module into a build.
 * `src/dev/__tests__/showcase-tokens.test.ts` asserts the built bundle is free
 * of every showcase identifier.
 *
 * It renders the DESIGN.md §7.3 primitive/state matrix from data, so todo 11
 * can swap the `./pending` stand-ins for real `web/src/ui/` primitives and
 * reuse this page unchanged as its acceptance gate.
 * ------------------------------------------------------------------------- */

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useControlGroups } from './cases-controls'
import { useFeedbackGroups } from './cases-feedback'
import type { ShowcaseCase, ShowcaseGroup } from './case-types'

// Product cascade first (Tailwind + `@theme`), so `Btn`/`Field`/`GroupedSelect`/
// `StatusNote` render exactly as they do in the app; then the DESIGN.md token
// bridge and the showcase scaffolding layer on top.
import '../index.css'
import './showcase-tokens.css'
import './showcase.css'

if (import.meta.env.PROD) {
  throw new Error('showcase-main.tsx is dev-only and must never enter a production bundle')
}

/** Stable, queryable id for one matrix row — the spec addresses cases by this. */
function caseId(group: ShowcaseGroup, showcaseCase: ShowcaseCase): string {
  return `${group.name}:${showcaseCase.state}`
}

/**
 * A focusable element placed immediately before a `seed` case in DOM order.
 * Playwright focuses it and presses Tab, which lands keyboard focus on the
 * primitive itself — the only way to prove `:focus-visible` renders the §7.2
 * ring for real keyboard input rather than for a synthetic `.focus()` call.
 */
function FocusSeed({ id }: { id: string }) {
  return (
    <button type="button" className="sc-seed" data-sc-seed={id} aria-label={`Focus seed before ${id}`}>
      Tab from here
    </button>
  )
}

function Case({ group, showcaseCase }: { group: ShowcaseGroup; showcaseCase: ShowcaseCase }) {
  const id = caseId(group, showcaseCase)
  return (
    <div className="sc-cell" data-sc-case={id} data-sc-primitive={group.name} data-sc-state={showcaseCase.state}>
      <div className="sc-cell-head">
        <span className="sc-state">{showcaseCase.state}</span>
        {group.pending && <span className="sc-pending">{group.pending}</span>}
      </div>
      <div className="sc-cell-body">
        {showcaseCase.seed && <FocusSeed id={id} />}
        {showcaseCase.node}
      </div>
    </div>
  )
}

function Group({ group }: { group: ShowcaseGroup }) {
  return (
    <section className="sc-group" id={`sc-${group.name}`} data-sc-group={group.name} aria-labelledby={`sc-h-${group.name}`}>
      <div className="sc-group-head">
        <h2 className="sc-group-name" id={`sc-h-${group.name}`}>
          {group.name}
        </h2>
        <span className="sc-group-source">{group.source}</span>
      </div>
      <div className="sc-grid">
        {group.cases.map((showcaseCase) => (
          <Case group={group} key={caseId(group, showcaseCase)} showcaseCase={showcaseCase} />
        ))}
      </div>
    </section>
  )
}

function Showcase() {
  const groups = [...useControlGroups(), ...useFeedbackGroups()]
  const [highContrast, setHighContrast] = useState(false)
  const caseCount = groups.reduce((total, group) => total + group.cases.length, 0)

  return (
    <main className="sc-root" data-sc-ready="true">
      <header className="sc-head">
        <h1 className="sc-title">Primitive showcase</h1>
        <p className="sc-lede">
          Every primitive and state contracted in DESIGN.md §7.3, rendered against today&apos;s API plus dev-only
          stand-ins for the primitives todo 11 has yet to build. Dev and test only — this page is not a build input
          and never ships.
        </p>
        <div className="sc-meta">
          <span className="sc-meta-chip">DESIGN.md §7.3</span>
          <span className="sc-meta-chip" data-sc-count="groups">{groups.length} primitives</span>
          <span className="sc-meta-chip" data-sc-count="cases">{caseCount} states</span>
          <button
            type="button"
            className="sc-seed"
            aria-pressed={highContrast}
            data-sc-toggle="high-contrast"
            onClick={() => setHighContrast((on) => !on)}
          >
            High contrast: {highContrast ? 'on' : 'off'}
          </button>
        </div>
      </header>

      <div className="sc-variant" data-variant={highContrast ? 'high-contrast' : 'default'}>
        {groups.map((group) => (
          <Group group={group} key={group.name} />
        ))}
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Showcase />
  </StrictMode>,
)
