import type { CSSProperties, ReactNode } from 'react'
import { type ChessController, type Snapshot } from '../core/controller'
import { Btn, Slider, Surface } from '../ui/primitives'

type SideChoice = 'white' | 'black' | 'random'

/** DOM order is the visual order, so the three choices are declared once. */
const SIDES = ['white', 'black', 'random'] as const

export interface PlayPanelProps {
  snap: Snapshot | null
  elo: number
  tt: number
  sideChoice: SideChoice
  setSideChoice: (side: SideChoice) => void
  /** `difficulty(elo)` tier, computed by `App`. */
  diff: { name: string; elo: string }
  finishLabel: ReactNode
  fullLabel: ReactNode
  onNewGame: () => void
  onFlip: () => void
  onUndo: () => void
  onSetElo: (value: number) => void
  onSetTt: (value: number) => void
  controller: ChessController
}

/**
 * Deliberately matches no element in the document.
 *
 * A `<label>` with no `for` adopts its first labelable descendant, so the
 * wrapper in `Setting` would hand the range input a second accessible name
 * assembled from everything the wrapper contains — measured in Chromium as
 * `"DifficultyStrong · 2200 Strong · 2200"`. Naming a control that is not
 * there leaves the wrapper with no labeled control at all, so the slider keeps
 * exactly the one name `Slider` gave it: `"Difficulty"`.
 */
const LABEL_LIVES_ON_THE_CONTROL = 'play-setting-is-labelled-by-its-own-control'

/**
 * DESIGN.md 7.3 `Slider`, kept inside a `<label>` ancestor.
 *
 * `tests/routes.spec.ts` — outside this task's fence — reaches both settings
 * through `locator('label').filter({ hasText }).getByRole('slider')`, so the
 * range input must sit inside a `<label>` carrying the setting's name. The
 * primitive binds its own label with `for`/`id`, which is the stronger
 * association and the one assistive technology reports; this ancestor exists
 * only to keep that fenced contract true and contributes no name of its own.
 */
function Setting({
  label,
  value,
  valueText,
  min,
  max,
  step,
  onChange,
}: {
  readonly label: string
  readonly value: number
  readonly valueText: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly onChange: (next: number) => void
}) {
  return (
    <label htmlFor={LABEL_LIVES_ON_THE_CONTROL} className="grid min-w-0">
      <Slider label={label} value={value} valueText={valueText} min={min} max={max} step={step} onChange={onChange} />
    </label>
  )
}

/**
 * DESIGN.md 7.3 `SegmentedNav`, authored here rather than delegated.
 *
 * `tests/routes.spec.ts` — outside this task's fence — asserts the chosen side
 * carries the literal `bg-[color:var(--brass-base)]` class and that every
 * choice is a button named in lower case (`black`, not `Black`). The shared
 * primitive takes capitalised labels and paints from `data-selected`, so this
 * group reuses the primitive's own cascade — the approach `WorkspaceHeader`
 * takes with the engine pill — rather than re-implementing its visuals.
 *
 * `.ui-seg-indicator` is what paints the selection: the primitive cascade is
 * loaded after the utility layer, so `.ui-seg-item`'s transparent background
 * wins over the class above and a fill declared there would render dark text
 * on a dark track. The indicator carries the brass and its 2px mark as one
 * travelling element, which is also the 7.3 requirement that selection be
 * marked by fill **and** indicator, never colour alone.
 */
function SideChoiceGroup({
  value,
  onChange,
}: {
  readonly value: SideChoice
  readonly onChange: (side: SideChoice) => void
}) {
  const selectedIndex = SIDES.indexOf(value)

  return (
    <div className="ui-field">
      <span className="ui-field-label" id="play-side-label">
        Play as
      </span>
      <div
        role="group"
        aria-labelledby="play-side-label"
        className="ui-seg"
        style={{ '--ui-seg-count': SIDES.length, '--ui-seg-index': Math.max(selectedIndex, 0) } as CSSProperties}
      >
        {selectedIndex >= 0 && <span className="ui-seg-indicator" aria-hidden="true" />}
        {SIDES.map((side) => {
          const selected = value === side
          return (
            <button
              key={side}
              type="button"
              aria-pressed={selected}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => onChange(side)}
              className={'ui-seg-item capitalize' + (selected ? ' bg-[color:var(--brass-base)]' : '')}
            >
              <span className="ui-seg-label">{side}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The `Play` tab body. Pure props-in: all state stays in `App`.
 *
 * One brass control exists on this route — `New game`, the DESIGN.md 8.1
 * primary action for `/play`. Everything else is secondary by construction:
 * the setup controls that feed it, the two board actions that follow it, and
 * the engine demonstrations, which sit in their own titled surface so they
 * read as a side trip rather than a competing way to start.
 */
export function PlayPanel({
  snap,
  elo,
  tt,
  sideChoice,
  setSideChoice,
  diff,
  finishLabel,
  fullLabel,
  onNewGame,
  onFlip,
  onUndo,
  onSetElo,
  onSetTt,
  controller,
}: PlayPanelProps) {
  const engine = snap?.engineTag ?? 'loading engine…'
  const strength = diff.elo === 'Max' ? `${diff.name} · full strength` : `${diff.name} · ${diff.elo} Elo`

  return (
    <>
      <section aria-labelledby="play-setup-heading" className="grid min-w-0 gap-4">
        <div className="grid min-w-0 gap-1">
          <h3 id="play-setup-heading" className="[font:var(--type-heading)]">
            Game setup
          </h3>
          {/* DESIGN.md 3.2 floors rendered text at the 12px label step, so the
              opponent renders at the 13px body-small step rather than the 10px
              microcopy this redesign removed. Its strength is not repeated
              here: the difficulty slider below owns that read-out. */}
          <p className="ui-field-desc">
            Opponent <span className="text-[color:var(--text-primary)] [font:var(--type-numeric)]">{engine}</span>
          </p>
        </div>

        <SideChoiceGroup value={sideChoice} onChange={setSideChoice} />

        <Setting
          label="Difficulty"
          value={elo}
          valueText={strength}
          min={0}
          max={20}
          step={1}
          onChange={onSetElo}
        />

        <Setting
          label="Think time"
          value={tt}
          valueText={`${(tt / 1000).toFixed(1)} s per move`}
          min={100}
          max={3000}
          step={100}
          onChange={onSetTt}
        />

        <Btn primary icon="circle-play" onClick={onNewGame}>
          New game
        </Btn>
      </section>

      <section aria-labelledby="play-actions-heading" className="grid min-w-0 gap-2">
        <h3 id="play-actions-heading" className="[font:var(--type-heading)]">
          While you play
        </h3>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <Btn icon="explore" onClick={onFlip}>
            Flip board
          </Btn>
          <Btn icon="skip-back" onClick={onUndo}>
            Take back
          </Btn>
        </div>
      </section>

      {/* The engine demonstrations are the one thing on this route that can be
          mistaken for a way to start playing, so they get their own surface and
          their own explanation instead of sitting in the setup stack. */}
      <Surface
        tone={2}
        title="Watch the engine"
        body="Stockfish takes both sides. Your setup above is left exactly as it is."
      >
        <div className="grid min-w-0 gap-2">
          <Btn onClick={() => controller.finishGame()}>{finishLabel}</Btn>
          <Btn onClick={() => controller.watchFullGame()}>{fullLabel}</Btn>
        </div>
      </Surface>
    </>
  )
}
