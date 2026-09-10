import { useEffect, useMemo, useState } from 'react'
import { type ChessController, type Snapshot, type SetKey } from '../core/controller'
import { BOOK, GAME_IDX, side, type BookLine } from '../core/book'
import { Btn, Field, GroupedSelect, StatusNote, type Group } from '../ui/primitives'

type Facet = 'opening' | 'hero' | 'theme' | 'era'

export interface GamesPanelProps {
  snap: Snapshot | null
  replaying: boolean
  selfPlay: boolean
  sessionKey: SetKey
  controller: ChessController
}

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

function metaHtml(l: BookLine | undefined): string {
  if (!l) return ''
  let meta = l.idea ? '<b>Idea:</b> ' + l.idea : ''
  if (l.game) {
    const bits = [l.opening, l.theme, l.era].filter(Boolean)
    if (bits.length) meta += ` <span style="opacity:.7">· ${bits.join(' · ')}</span>`
  }
  return meta
}

/**
 * The `Games` (master games) tab body.
 *
 * The facet/search/selection/hint state is owned here rather than in `App`: it is
 * consumed exclusively by this tab, so it moved down with the JSX (P4 hook audit,
 * `.omo/notes/p4-app-hook-audit.md`). Only genuinely shared values arrive as props.
 * `gameGroups` / `metaHtml` came out of `App.tsx` verbatim for the same reason.
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

  const watchLabel =
    replaying && sessionKey === 'games' ? '■ Stop replay' : selfPlay ? '■ Stop' : '▶ Watch this game'

  const gameMeta = metaHtml(BOOK[gameSel])
  const gameSelValid = gGroups.some((g) => g.options.some((o) => o.value === gameSel))

  return (
    <>
      <Field label="Search games">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="player, opening, e.g. Fischer or Berlin"
          autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brass)] focus:outline-none"
        />
      </Field>
      <Field label="Browse by">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 p-1">
          {(['opening', 'hero', 'theme', 'era'] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFacet(f)
                setSearch('')
              }}
              className={
                'min-h-10 rounded-lg text-xs font-semibold transition ' +
                (facet === f && !search
                  ? 'bg-[var(--color-brass)] text-[#1a130a]'
                  : 'text-[var(--color-ink)] hover:bg-white/[0.05]')
              }
            >
              {f === 'hero' ? 'Player' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Master game">
        <GroupedSelect
          value={gameSelValid ? gameSel : ''}
          groups={gGroups}
          onChange={setGameSel}
          emptyText={search ? `No games match “${search}”` : 'No games'}
        />
      </Field>
      <div className="text-xs leading-relaxed text-[var(--color-muted)]" dangerouslySetInnerHTML={{ __html: gameMeta }} />
      <div className="grid grid-cols-2 gap-2">
        <Btn primary disabled={!gameSelValid} onClick={() => controller.startTrainer(gameSel, 'games', mgHints)}>
          Play through
        </Btn>
        <Btn disabled={snap?.games.hintDisabled ?? true} onClick={() => controller.playBookMove('games')}>
          Play game move
        </Btn>
      </div>
      <Btn active={replaying && sessionKey === 'games'} disabled={!gameSelValid} onClick={() => controller.watch(gameSel, 'games')}>
        {watchLabel}
      </Btn>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-muted)]">
        <input
          type="checkbox"
          checked={mgHints}
          onChange={(e) => {
            setMgHints(e.target.checked)
            controller.setHints('games', e.target.checked)
          }}
          className="h-4 w-4 accent-[var(--color-brass)]"
        />
        Show hint (highlight the next move)
      </label>
      {snap && <StatusNote slot={snap.games} />}
    </>
  )
}
