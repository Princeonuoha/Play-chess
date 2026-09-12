import { type ChessController, type Snapshot } from '../core/controller'
import { Btn, Field } from '../ui/primitives'

type SideChoice = 'white' | 'black' | 'random'

export interface PlayPanelProps {
  snap: Snapshot | null
  elo: number
  tt: number
  sideChoice: SideChoice
  setSideChoice: (side: SideChoice) => void
  /** `difficulty(elo)` tier, computed by `App`. */
  diff: { name: string; elo: string }
  finishLabel: string
  fullLabel: string
  onNewGame: () => void
  onFlip: () => void
  onUndo: () => void
  onSetElo: (value: number) => void
  onSetTt: (value: number) => void
  controller: ChessController
}

/**
 * The `Play` tab body. Pure props-in: all state stays in `App`.
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
  const selfPlay = snap?.selfPlay ?? false

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Btn primary onClick={onNewGame}>
          New game
        </Btn>
        <Btn onClick={onFlip}>Flip</Btn>
        <Btn onClick={onUndo}>Take back</Btn>
      </div>
      <Btn active={selfPlay} onClick={() => controller.finishGame()}>
        {finishLabel}
      </Btn>
      <Field label="Play as">
        <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] p-1">
          {(['white', 'black', 'random'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSideChoice(s)}
              className={
                'min-h-10 rounded-[var(--radius-sm)] text-sm font-semibold capitalize transition ' +
                (sideChoice === s
                  ? 'bg-[color:var(--brass-base)] text-[color:var(--text-on-brass)]'
                  : 'text-[color:var(--text-primary)] hover:bg-[var(--surface-inset-hover)]')
              }
            >
              {s}
            </button>
          ))}
        </div>
      </Field>
      <label className="grid gap-2">
        <span className="flex items-baseline justify-between text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
          Difficulty
          <b className="font-semibold text-[color:var(--brass-base)]">
            {diff.name} <span className="font-[family-name:var(--type-font-numeric)] text-[10px] text-[color:var(--text-muted)]">~{diff.elo}</span>
          </b>
        </span>
        <input
          type="range"
          min={0}
          max={20}
          value={elo}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            onSetElo(v)
          }}
          className="accent-[color:var(--brass-base)]"
        />
        <span className="flex justify-between text-[10px] text-[color:var(--text-muted)]">
          <span>Beginner</span>
          <span>Maximum</span>
        </span>
      </label>
      <label className="grid gap-2">
        <span className="flex justify-between text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
          Think time <b className="font-[family-name:var(--type-font-numeric)] text-[color:var(--brass-base)]">{(tt / 1000).toFixed(1)} s</b>
        </span>
        <input
          type="range"
          min={100}
          max={3000}
          step={100}
          value={tt}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            onSetTt(v)
          }}
          className="accent-[color:var(--brass-base)]"
        />
      </label>
      <Btn active={selfPlay} onClick={() => controller.watchFullGame()}>
        {fullLabel}
      </Btn>
    </>
  )
}
