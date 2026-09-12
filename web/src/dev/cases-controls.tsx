import { useState } from 'react'
import { Btn, Empty, Field, GroupedSelect, IconButton, Slider, Surface } from '../ui/primitives'
import { LONG_BODY, LONG_LABEL, type ShowcaseGroup } from './case-types'

const OPENING_GROUPS = [
  { label: 'Open games', options: [{ value: 1, label: 'Ruy Lopez — Berlin Defence' }, { value: 2, label: 'Italian Game — Giuoco Piano' }] },
  { label: 'Indian defences', options: [{ value: 3, label: LONG_LABEL }] },
]

const THINK_TIME_ERROR = 'Error — think time must be between 100 and 5000 milliseconds.'

export function useControlGroups(): readonly ShowcaseGroup[] {
  const [elo, setElo] = useState(9)

  return [
    {
      name: 'Btn',
      source: 'web/src/ui/controls.tsx',
      cases: [
        {
          state: 'default',
          node: (
            <>
              <Btn primary>New game</Btn>
              <Btn>Flip board</Btn>
            </>
          ),
        },
        { state: 'hover', node: <Btn primary>Undo move</Btn> },
        { state: 'focus', seed: true, node: <Btn primary>Start training</Btn> },
        { state: 'active', node: <Btn primary>Play through</Btn> },
        {
          state: 'disabled',
          node: (
            <div className="sc-stack">
              <Btn disabled>Undo move</Btn>
              <p className="sc-contract">No move has been played yet, so there is nothing to undo.</p>
            </div>
          ),
        },
        {
          // The pair is the assertion: same label, same primitive, one idle and
          // one busy, so the spec can prove the loading slot reflows nothing.
          state: 'loading',
          node: (
            <div className="sc-stack">
              <span data-sc-probe="btn-idle" className="sc-contents">
                <Btn primary loading={false}>
                  Review this game
                </Btn>
              </span>
              <span data-sc-probe="btn-loading" className="sc-contents">
                <Btn primary loading>
                  Review this game
                </Btn>
              </span>
            </div>
          ),
        },
      ],
    },
    {
      name: 'IconButton',
      source: 'web/src/ui/icons.tsx',
      cases: [
        { state: 'default', node: <IconButton icon="search" label="Search master games" onClick={() => {}} /> },
        { state: 'hover', node: <IconButton icon="book" label="Open the opening book" onClick={() => {}} /> },
        { state: 'focus', seed: true, node: <IconButton icon="circle-play" label="Flip the board" onClick={() => {}} /> },
        { state: 'active', node: <IconButton icon="retry" label="Retry engine boot" onClick={() => {}} /> },
        {
          state: 'disabled',
          node: (
            <div className="sc-stack">
              <IconButton icon="trophy" label="Play through this game" onClick={() => {}} disabled />
              <p className="sc-contract">No master game is loaded, so there is nothing to play through.</p>
            </div>
          ),
        },
      ],
    },
    {
      name: 'Field',
      source: 'web/src/ui/controls.tsx',
      cases: [
        {
          state: 'default',
          node: (
            <Field label="Your colour" description="Choosing black gives Stockfish the first move.">
              {(control) => <input {...control} type="text" className="ui-control" defaultValue="White" />}
            </Field>
          ),
        },
        {
          state: 'focus',
          seed: true,
          node: (
            <Field label="Your colour">
              {(control) => <input {...control} type="text" className="ui-control" defaultValue="White" />}
            </Field>
          ),
        },
        {
          state: 'disabled',
          node: (
            <Field label="Your colour" description="Strength is locked while Stockfish is playing itself." disabled>
              {(control) => <input {...control} type="text" className="ui-control" defaultValue="White" />}
            </Field>
          ),
        },
        {
          state: 'error',
          node: (
            <Field label="Think time (ms)" error={THINK_TIME_ERROR}>
              {(control) => <input {...control} type="number" className="ui-control" defaultValue={-1} />}
            </Field>
          ),
        },
      ],
    },
    {
      name: 'GroupedSelect',
      source: 'web/src/ui/controls.tsx',
      cases: [
        { state: 'default', node: <GroupedSelect value={1} groups={OPENING_GROUPS} onChange={() => {}} /> },
        { state: 'hover', node: <GroupedSelect value={2} groups={OPENING_GROUPS} onChange={() => {}} /> },
        { state: 'focus', seed: true, node: <GroupedSelect value={1} groups={OPENING_GROUPS} onChange={() => {}} /> },
        {
          state: 'disabled',
          node: (
            <div className="sc-stack">
              <GroupedSelect value={1} groups={OPENING_GROUPS} onChange={() => {}} disabled />
              <p className="sc-contract">The opening book is still loading, so no line can be chosen yet.</p>
            </div>
          ),
        },
        {
          state: 'empty',
          node: (
            <div className="sc-stack">
              <GroupedSelect value="" groups={[]} onChange={() => {}} emptyText={'No openings match "zukertort gambit"'} />
              <Empty
                message={'No openings match "zukertort gambit". Clear the search to see all 312 lines.'}
                actionLabel="Clear search"
              />
            </div>
          ),
        },
      ],
    },
    {
      name: 'Slider',
      source: 'web/src/ui/controls.tsx',
      cases: [
        { state: 'default', node: <Slider label="Strength" value={elo} valueText={`Casual · ${1320 + elo * 88} Elo`} onChange={setElo} /> },
        { state: 'hover', node: <Slider label="Strength" value={12} valueText="Expert · 2380 Elo" /> },
        { state: 'focus', seed: true, node: <Slider label="Strength" value={6} valueText="Beginner · 1848 Elo" /> },
        { state: 'active', node: <Slider label="Strength" value={16} valueText="Master · 2734 Elo" /> },
        {
          state: 'disabled',
          node: (
            <div className="sc-stack">
              <Slider label="Strength" value={4} valueText="Beginner · 1672 Elo" disabled />
              <p className="sc-contract">Strength is locked while Stockfish is playing itself.</p>
            </div>
          ),
        },
      ],
    },
    {
      name: 'Surface',
      source: 'web/src/ui/surfaces.tsx',
      cases: [
        { state: 'default', node: <Surface title="Move list" body={LONG_BODY} /> },
        {
          state: 'hover',
          node: (
            <Surface
              tone={2}
              title="Kasparov vs Topalov, 1999"
              body="Wijk aan Zee · Pirc Defence · 44 moves"
              actionLabel="Play through Kasparov vs Topalov, 1999"
              onClick={() => {}}
            />
          ),
        },
        {
          state: 'focus',
          seed: true,
          node: (
            <Surface
              tone={2}
              title="Fischer vs Spassky, 1972"
              body="Reykjavik · Game 6 · 41 moves"
              actionLabel="Play through Fischer vs Spassky, 1972"
              onClick={() => {}}
            />
          ),
        },
      ],
    },
  ]
}
