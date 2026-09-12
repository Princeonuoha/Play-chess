import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { type ChessController, type Snapshot, type SetKey } from '../core/controller'
import { BOOK, GAME_IDX, side, type BookLine } from '../core/book'
import {
  Btn,
  Empty,
  Field,
  GroupedSelect,
  InlineFeedback,
  Loading,
  SegmentedNav,
  StatusNote,
  Surface,
  type Group,
  type SegmentItem,
} from '../ui/primitives'

type Facet = 'opening' | 'hero' | 'theme' | 'era'

export interface GamesPanelProps {
  snap: Snapshot | null
  replaying: boolean
  selfPlay: boolean
  sessionKey: SetKey
  controller: ChessController
}

/**
 * The four library facets. Typed as `SegmentItem` so the DESIGN.md 7.3
 * `SegmentedNav` primitive owns the strip's visuals, roving focus and 44px
 * targets — the panel no longer hand-rolls a four-button grid.
 */
const FACETS = [
  { id: 'opening', label: 'Opening' },
  { id: 'hero', label: 'Player' },
  { id: 'theme', label: 'Theme' },
  { id: 'era', label: 'Era' },
] as const satisfies readonly (SegmentItem & { id: Facet })[]

const FACET_NOUN: Record<Facet, string> = {
  opening: 'opening',
  hero: 'player',
  theme: 'theme',
  era: 'era',
}

const isFacet = (id: string): id is Facet => FACETS.some((facet) => facet.id === id)

/**
 * Grouping and filtering are unchanged from the pre-redesign panel: the search
 * still matches variation/hero/opening/theme/era/white/black, an empty result
 * set still returns no groups, and browsing still groups by the active facet in
 * first-seen order. This todo is presentation only.
 */
function gameGroups(facet: Facet, query: string): Group[] {
  const q = query.trim().toLowerCase()
  const label = (l: BookLine) => `${l.variation}  (You: ${side(l)})`
  let indices = GAME_IDX
  if (q) {
    indices = GAME_IDX.filter((i) => {
      const l = BOOK[i]
      return [l.variation, l.hero, l.opening, l.theme, l.era, l.white, l.black].join(' ').toLowerCase().includes(q)
    })
    if (!indices.length) return []
    return [{ label: `${indices.length} result${indices.length > 1 ? 's' : ''}`, options: indices.map((i) => ({ value: i, label: label(BOOK[i]) })) }]
  }
  const groups: Record<string, { value: number; label: string }[]> = {}
  const order: string[] = []
  for (const i of indices) {
    const l = BOOK[i]
    const k = (l[facet] as string) || '—'
    if (!groups[k]) {
      groups[k] = []
      order.push(k)
    }
    groups[k].push({ value: i, label: label(BOOK[i]) })
  }
  return order.map((k) => ({ label: k, options: groups[k] }))
}

/**
 * Every master game's `variation` is authored as `Name · Occasion` (for example
 * `The “Immortal Game” · 1851`, `Fischer–Spassky · WCC 1972, Game 6`). Splitting
 * on that separator is a read of existing data, never a rewrite of it: the
 * option labels and the trainer status still use `variation` verbatim.
 */
function identity(line: BookLine): { name: string; occasion: string } {
  const [name, ...rest] = line.variation.split(' · ')
  return { name, occasion: rest.join(' · ') }
}

/**
 * One fact of the selected game. `.ui-field-label` is the shared DESIGN.md 7.3
 * `Field` label appearance reused as a class rather than re-declared, so the
 * summary's terms cannot drift away from every other label in the product.
 */
function Fact({ term, children }: { readonly term: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="ui-field-label">{term}</dt>
      <dd className="min-w-0 break-words text-[color:var(--text-secondary)] [font:var(--type-body-sm)]">{children}</dd>
    </div>
  )
}

/**
 * The selected game's context. It renders only for a selection that is actually
 * present in the current result set, which is what stops a filtered-away game
 * from sitting here looking selected while the picker below it reads empty.
 */
function SelectedGame({ line }: { readonly line: BookLine }) {
  const { name, occasion } = identity(line)
  const hero = line.you === 'w' ? line.white : line.black

  return (
    <>
      <h3 className="min-w-0 break-words [font:var(--type-heading)]">
        {name}
      </h3>
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 [font:var(--type-body)]">
        <span className="break-words text-[color:var(--text-primary)]">{line.white}</span>
        <span className="text-[color:var(--text-muted)]">vs</span>
        <span className="break-words text-[color:var(--text-primary)]">{line.black}</span>
        {line.result !== undefined && (
          <span className="rounded-[var(--radius-pill)] border border-[color:var(--border-brass)] px-2 py-0.5 text-[color:var(--brass-base)] [font:var(--type-numeric)]">
            {line.result}
          </span>
        )}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {occasion !== '' && <Fact term="Played">{occasion}</Fact>}
        {line.opening !== undefined && <Fact term="Opening">{line.opening}</Fact>}
        {line.theme !== undefined && <Fact term="Theme">{line.theme}</Fact>}
        {line.era !== undefined && <Fact term="Era">{line.era}</Fact>}
        <Fact term="You play">{`${side(line)} · ${hero ?? '—'}`}</Fact>
        <Fact term="Length">{`${Math.ceil(line.moves.length / 2)} moves`}</Fact>
      </dl>
      {line.idea !== undefined && (
        <p className="min-w-0 max-w-[var(--type-measure)] break-words text-[color:var(--text-secondary)] [font:var(--type-body-sm)]">
          {line.idea}
        </p>
      )}
    </>
  )
}

/**
 * The `Games` (master games) tab body: a library on top, then the one selected
 * game and every way to replay it.
 *
 * The facet/search/selection/hint state is owned here rather than in `App`: it is
 * consumed exclusively by this tab, so it moved down with the JSX (P4 hook audit,
 * `.omo/notes/p4-app-hook-audit.md`). Only genuinely shared values arrive as props.
 *
 * Todo 16 replaced the panel's local controls with DESIGN.md 7.3 primitives
 * (`SegmentedNav`, `Surface`, `Empty`, `Loading`, `InlineFeedback`) and made the
 * selected game's context explicit. The native `<select>` inside `GroupedSelect`
 * stays exactly as it was — 7.3 keeps it for platform picker and screen-reader
 * behavior, so no custom listbox replaces it.
 */
export function GamesPanel({ snap, replaying, selfPlay, sessionKey, controller }: GamesPanelProps) {
  const [facet, setFacet] = useState<Facet>('opening')
  const [search, setSearch] = useState('')
  const [gameSel, setGameSel] = useState<number>(GAME_IDX[0])
  const [mgHints, setMgHints] = useState(false)

  const gGroups = useMemo(() => gameGroups(facet, search), [facet, search])

  // Keep the game selection valid as facet/search change.
  useEffect(() => {
    const flat = gGroups.flatMap((g) => g.options.map((o) => o.value))
    if (flat.length && !flat.includes(gameSel)) setGameSel(flat[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gGroups])

  const query = search.trim()
  const resultCount = gGroups.reduce((total, group) => total + group.options.length, 0)
  const gameSelValid = gGroups.some((g) => g.options.some((o) => o.value === gameSel))
  const selected = gameSelValid ? BOOK[gameSel] : undefined
  const replayingGames = replaying && sessionKey === 'games'
  const playingThrough = snap !== null && !snap.games.hintDisabled

  const watchLabel = replayingGames ? 'Stop replay' : selfPlay ? 'Stop' : 'Watch this game'
  const selectedName = selected === undefined ? '' : identity(selected).name

  const feedback: { state: 'idle' | 'loading'; message: string | undefined } =
    replayingGames && selected !== undefined
      ? { state: 'loading', message: `Replaying ${selectedName} — ${selected.white} vs ${selected.black}.` }
      : selected === undefined
        ? { state: 'idle', message: 'Replay controls stay off until a master game is selected.' }
        : playingThrough
          ? { state: 'idle', message: `Playing through ${selectedName}. Play game move advances the score for you.` }
          : { state: 'idle', message: undefined }

  return (
    <>
      {/* The region is named "Game library", not "Master game library": `getByLabel`
          matches accessible names by substring, and `tests/smoke.spec.ts` (outside this
          task's fence) resolves the picker with `getByLabel('Master game')`. A region
          whose name contained that string would make that locator ambiguous. */}
      <Surface label="Game library">
        <Field label="Search games" description="Matches player, opening, theme, era, and either colour.">
          {(control) => (
            <input
              id={control.id}
              aria-describedby={control['aria-describedby']}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="player, opening, e.g. Fischer or Berlin"
              autoComplete="off"
              className="ui-control"
            />
          )}
        </Field>

        <div className="grid min-w-0 gap-2">
          <p className="ui-field-label">Browse by</p>
          <SegmentedNav
            label="Browse by"
            items={FACETS}
            selectedId={query === '' ? facet : ''}
            onSelect={(id) => {
              if (!isFacet(id)) return
              setFacet(id)
              setSearch('')
            }}
          />
        </div>

        <p className="min-w-0 break-words text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
          <span className="text-[color:var(--text-primary)] [font:var(--type-numeric)]">{resultCount}</span>{' '}
          {query === ''
            ? `master games, grouped by ${FACET_NOUN[facet]}`
            : `of ${GAME_IDX.length} games match “${query}”`}
        </p>

        <Field
          label="Master game"
          error={resultCount === 0 ? `No games match “${query}”.` : undefined}
        >
          {(control) => (
            <GroupedSelect
              control={control}
              value={gameSelValid ? gameSel : ''}
              groups={gGroups}
              onChange={setGameSel}
              emptyText={query === '' ? 'No games' : `No games match “${query}”`}
            />
          )}
        </Field>

        {resultCount === 0 && (
          <Empty
            message={`Nothing in the library matches “${query}”. Clear the search to browse all ${GAME_IDX.length} master games again.`}
            actionLabel="Clear search"
            onAction={() => setSearch('')}
          />
        )}
      </Surface>

      <Surface label="Selected game" tone={2}>
        {selected === undefined ? (
          <p className="min-w-0 break-words text-[color:var(--text-secondary)] [font:var(--type-body-sm)]">
            No master game is selected, so there is nothing to play through yet.
          </p>
        ) : (
          <SelectedGame line={selected} />
        )}

        <div className="grid gap-2 pt-1">
          <Btn primary icon="play" disabled={selected === undefined} onClick={() => controller.startTrainer(gameSel, 'games', mgHints)}>
            Play through
          </Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn
              active={replayingGames}
              icon={replayingGames || selfPlay ? 'stop' : 'circle-play'}
              disabled={selected === undefined && !replayingGames && !selfPlay}
              onClick={() => controller.watch(gameSel, 'games')}
            >
              {watchLabel}
            </Btn>
            <Btn icon="skip-forward" disabled={snap?.games.hintDisabled ?? true} onClick={() => controller.playBookMove('games')}>
              Play game move
            </Btn>
          </div>
        </div>

        <label className="flex min-h-[var(--icon-target-min)] cursor-pointer items-center gap-2 text-[color:var(--text-muted)] [font:var(--type-body-sm)]">
          <input
            type="checkbox"
            checked={mgHints}
            onChange={(e) => {
              setMgHints(e.target.checked)
              controller.setHints('games', e.target.checked)
            }}
            className="h-4 w-4 accent-[color:var(--brass-base)]"
          />
          Show hint (highlight the next move)
        </label>

        <InlineFeedback state={feedback.state} message={feedback.message} skeletonRows={1} />
      </Surface>

      {snap === null ? <Loading label="Preparing the master-game workspace…" rows={2} /> : <StatusNote slot={snap.games} />}
    </>
  )
}
