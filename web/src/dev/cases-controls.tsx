import { useState } from 'react'
import { Btn, Field, GroupedSelect } from '../ui/primitives'
import { Icon, IconButton, Shim, Slider, Surface } from './pending'
import { LONG_BODY, LONG_LABEL, type ShowcaseGroup } from './case-types'

const OPENING_GROUPS = [
  { label: 'Open games', options: [{ value: 1, label: 'Ruy Lopez — Berlin Defence' }, { value: 2, label: 'Italian Game — Giuoco Piano' }] },
  { label: 'Indian defences', options: [{ value: 3, label: LONG_LABEL }] },
]

function ErrorField({ id }: { id: string }) {
  return (
    <div className="sc-stack">
      <Field label="Think time (ms)">
        <Shim attrs={{ 'aria-invalid': 'true', 'aria-errormessage': id }}>
          <input type="number" defaultValue={-1} className="sc-input sc-input--error" aria-describedby={id} />
        </Shim>
      </Field>
      <p className="sc-fielderror" id={id}>
        <Icon name="alert" size="sm" />
        <span>Error — think time must be between 100 and 5000 milliseconds.</span>
      </p>
    </div>
  )
}

export function useControlGroups(): readonly ShowcaseGroup[] {
  const [elo, setElo] = useState(9)

  return [
    {
      name: 'Btn',
      source: 'web/src/ui/primitives.tsx:6',
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
        { state: 'hover', node: <Btn>Undo move</Btn> },
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
          state: 'loading',
          node: (
            <Shim attrs={{ 'aria-busy': 'true' }}>
              <Btn primary className="sc-btn-locked">
                <span className="sc-btn-inner">
                  <span className="sc-spinner" aria-hidden="true" />
                  Review this game
                </span>
              </Btn>
            </Shim>
          ),
        },
      ],
    },
    {
      name: 'IconButton',
      source: 'PENDING todo 11 — ad hoc in web/src/App.tsx:62',
      pending: 'todo-11',
      cases: [
        { state: 'default', node: <IconButton icon="search" label="Search master games" /> },
        { state: 'hover', node: <IconButton icon="book" label="Open the opening book" /> },
        { state: 'focus', seed: true, node: <IconButton icon="board" label="Flip the board" /> },
        { state: 'active', node: <IconButton icon="retry" label="Retry engine boot" /> },
        {
          state: 'disabled',
          node: (
            <div className="sc-stack">
              <IconButton icon="trophy" label="Play through this game" disabled />
              <p className="sc-contract">No master game is loaded, so there is nothing to play through.</p>
            </div>
          ),
        },
      ],
    },
    {
      name: 'Field',
      source: 'web/src/ui/primitives.tsx:42',
      cases: [
        {
          state: 'default',
          node: (
            <div className="sc-stack">
              <Field label="Your colour">
                <input type="text" className="sc-input" defaultValue="White" aria-describedby="sc-side-desc" />
              </Field>
              <p className="sc-contract" id="sc-side-desc">
                Choosing black gives Stockfish the first move.
              </p>
            </div>
          ),
        },
        {
          state: 'focus',
          seed: true,
          node: (
            <Field label="Your colour">
              <input type="text" className="sc-input" defaultValue="White" />
            </Field>
          ),
        },
        {
          state: 'disabled',
          node: (
            <div className="sc-field--disabled">
              <Field label="Your colour">
                <input type="text" className="sc-input" defaultValue="White" disabled />
              </Field>
            </div>
          ),
        },
        { state: 'error', node: <ErrorField id="sc-tt-error" /> },
      ],
    },
    {
      name: 'GroupedSelect',
      source: 'web/src/ui/primitives.tsx:56',
      cases: [
        { state: 'default', node: <GroupedSelect value={1} groups={OPENING_GROUPS} onChange={() => {}} /> },
        { state: 'hover', node: <GroupedSelect value={2} groups={OPENING_GROUPS} onChange={() => {}} /> },
        { state: 'focus', seed: true, node: <GroupedSelect value={1} groups={OPENING_GROUPS} onChange={() => {}} /> },
        {
          state: 'disabled',
          node: (
            <div className="sc-stack">
              <Shim attrs={{ disabled: 'true' }}>
                <GroupedSelect value={1} groups={OPENING_GROUPS} onChange={() => {}} />
              </Shim>
              <p className="sc-contract">The opening book is still loading, so no line can be chosen yet.</p>
            </div>
          ),
        },
        {
          state: 'empty',
          node: (
            <div className="sc-stack">
              <GroupedSelect value="" groups={[]} onChange={() => {}} emptyText={'No openings match "zukertort gambit"'} />
              <div className="sc-state-block" data-sc-region="true">
                <Icon name="inbox" size="lg" className="sc-icon-mark" />
                <p>No openings match &quot;zukertort gambit&quot;. Clear the search to see all 312 lines.</p>
                <Btn>Clear search</Btn>
              </div>
            </div>
          ),
        },
      ],
    },
    {
      name: 'Slider',
      source: 'PENDING todo 11 — ad hoc in web/src/panels/PlayPanel.tsx',
      pending: 'todo-11',
      cases: [
        { state: 'default', node: <Slider label="Strength" value={elo} valueText={`Casual · ${1320 + elo * 88} Elo`} onChange={setElo} /> },
        {
          state: 'hover',
          node: (
            <div className="sc-slider-probe" data-sc-hover-probe="true" data-sc-hover-props="--sc-thumb-ring">
              <Slider label="Strength" value={12} valueText="Expert · 2380 Elo" />
            </div>
          ),
        },
        { state: 'focus', seed: true, node: <Slider label="Strength" value={6} valueText="Beginner · 1848 Elo" /> },
        {
          state: 'active',
          node: (
            <div className="sc-slider-probe">
              <Slider label="Strength" value={16} valueText="Master · 2734 Elo" />
            </div>
          ),
        },
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
      source: 'PENDING todo 11 — ad hoc Card in web/src/App.tsx:48',
      pending: 'todo-11',
      cases: [
        { state: 'default', node: <Surface title="Move list" body={LONG_BODY} /> },
        { state: 'hover', node: <Surface title="Kasparov vs Topalov, 1999" body="Wijk aan Zee · Pirc Defence · 44 moves" interactive actionLabel="Play through Kasparov vs Topalov, 1999" /> },
        { state: 'focus', seed: true, node: <Surface title="Fischer vs Spassky, 1972" body="Reykjavik · Game 6 · 41 moves" interactive actionLabel="Play through Fischer vs Spassky, 1972" /> },
      ],
    },
  ]
}
