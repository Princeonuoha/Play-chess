import { useState } from 'react'
import { Btn, StatusNote } from '../ui/primitives'
import { Icon, IconButton, ModalDialog, SegmentedNav, WorkspaceNav, type SegmentItem } from './pending'
import { LONG_BODY, type ShowcaseGroup } from './case-types'

const SUB_SURFACES: readonly SegmentItem[] = [
  { id: 'review', label: 'Review' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'explore', label: 'Explore' },
]

const DISABLED_SUB_SURFACES: readonly SegmentItem[] = [
  { id: 'review', label: 'Review', disabled: true },
  { id: 'analysis', label: 'Analysis' },
  { id: 'explore', label: 'Explore' },
]

const DESTINATIONS: readonly SegmentItem[] = [
  { id: 'play', label: 'Play', icon: 'board' },
  { id: 'openings', label: 'Openings', icon: 'book' },
  { id: 'games', label: 'Games', icon: 'trophy' },
  { id: 'study', label: 'Study', icon: 'search' },
]

function InlineDialog({ id }: { id: string }) {
  return (
    <dialog className="sc-dialog" open aria-labelledby={id}>
      <div className="sc-dialog-head">
        <h3 className="sc-dialog-title" id={id}>
          Promote to
        </h3>
        <IconButton icon="close" label="Cancel promotion" />
      </div>
      <div className="sc-dialog-row">
        <Btn primary>Queen</Btn>
        <Btn>Rook</Btn>
        <Btn>Bishop</Btn>
        <Btn>Knight</Btn>
      </div>
    </dialog>
  )
}

function ToastRegion({ message }: { message: string }) {
  return (
    <div className="sc-toastregion" aria-live="polite" data-sc-region="true">
      <div className="sc-toast">
        <Icon name="check" size="sm" />
        <span>{message}</span>
        <IconButton icon="close" label="Dismiss notification" />
      </div>
    </div>
  )
}

export function useFeedbackGroups(): readonly ShowcaseGroup[] {
  const [modalOpen, setModalOpen] = useState(false)

  return [
    {
      name: 'SegmentedNav',
      source: 'PENDING todo 11 — ad hoc tab strip in web/src/App.tsx:274',
      pending: 'todo-11',
      cases: [
        { state: 'default', node: <SegmentedNav items={SUB_SURFACES} selectedId="review" /> },
        { state: 'hover', node: <SegmentedNav items={SUB_SURFACES} selectedId="explore" /> },
        { state: 'focus', seed: true, node: <SegmentedNav items={SUB_SURFACES} selectedId="analysis" /> },
        { state: 'active', node: <SegmentedNav items={SUB_SURFACES} selectedId="review" /> },
        { state: 'disabled', node: <SegmentedNav items={DISABLED_SUB_SURFACES} selectedId="analysis" /> },
      ],
    },
    {
      name: 'WorkspaceNav',
      source: 'PENDING todo 7 / 11 — routed nav is not built yet',
      pending: 'todo-7',
      cases: [
        { state: 'default', node: <WorkspaceNav items={DESTINATIONS} currentId="play" /> },
        { state: 'hover', node: <WorkspaceNav items={DESTINATIONS} currentId="study" /> },
        { state: 'focus', seed: true, node: <WorkspaceNav items={DESTINATIONS} currentId="openings" /> },
        { state: 'active', node: <WorkspaceNav items={DESTINATIONS} currentId="play" /> },
        { state: 'loading', node: <WorkspaceNav items={DESTINATIONS} currentId="play" pendingId="games" /> },
      ],
    },
    {
      name: 'EngineStatus',
      source: 'PENDING todo 11 — ad hoc chip in web/src/App.tsx:163',
      pending: 'todo-11',
      cases: [
        {
          state: 'default',
          node: (
            <p className="sc-engine" role="status" data-sc-region="true">
              <span className="sc-dot sc-dot--positive" aria-hidden="true" />
              Ready · Stockfish 18 lite
            </p>
          ),
        },
        {
          state: 'loading',
          node: (
            <p className="sc-engine" role="status" aria-busy="true" data-sc-region="true">
              <span className="sc-spinner" aria-hidden="true" />
              Loading engine…
            </p>
          ),
        },
        {
          state: 'error',
          node: (
            <div className="sc-stack" role="alert" data-sc-region="true">
              <p className="sc-engine">
                <span className="sc-dot sc-dot--critical" aria-hidden="true" />
                Engine failed
              </p>
              <p className="sc-contract">Stockfish could not start, so the board will not reply to your moves.</p>
              <Btn>Retry</Btn>
            </div>
          ),
        },
      ],
    },
    {
      name: 'StatusNote',
      source: 'web/src/ui/primitives.tsx:91',
      cases: [
        {
          state: 'default',
          node: (
            <div className="sc-statusnote-scaffold" aria-live="polite" data-sc-region="true">
              <StatusNote
                slot={{
                  statusHtml: '<span class="good">Book move — Nimzo-Indian Defence</span>',
                  note: 'Black pins the knight on c3 and fights for e4 without committing a central pawn.',
                }}
              />
            </div>
          ),
        },
        {
          state: 'error',
          node: (
            <div className="sc-statusnote-scaffold sc-statusnote-scaffold--error" role="alert" data-sc-region="true">
              <p className="sc-note-head">
                <Icon name="alert" size="sm" className="sc-icon-mark--error" />
                Error
              </p>
              <StatusNote
                slot={{
                  statusHtml: '<span class="bad">That move leaves the king in check</span>',
                  note: 'Move the king, block the checking piece, or capture it before continuing.',
                }}
              />
            </div>
          ),
        },
      ],
    },
    {
      name: 'InlineFeedback',
      source: 'PENDING todo 11 — no implementation exists',
      pending: 'todo-11',
      cases: [
        { state: 'default', node: <div className="sc-feedback" aria-live="polite" data-sc-region="true" /> },
        {
          state: 'loading',
          node: (
            <div className="sc-feedback" aria-live="polite" aria-busy="true" data-sc-region="true">
              <p className="sc-feedback-line">Analyzing move 14…</p>
              <span className="sc-skeleton" aria-hidden="true" />
              <span className="sc-skeleton" aria-hidden="true" />
            </div>
          ),
        },
        {
          state: 'empty',
          node: (
            <div className="sc-feedback" aria-live="polite" data-sc-region="true">
              <p className="sc-feedback-line">No game has been reviewed yet.</p>
              <Btn>Review this game</Btn>
            </div>
          ),
        },
        {
          state: 'error',
          node: (
            <div className="sc-feedback" role="alert" data-sc-region="true">
              <p className="sc-feedback-line sc-feedback-line--error">
                <Icon name="alert" size="sm" className="sc-icon-mark--error" />
                Error — the review stopped at move 14 because Stockfish restarted.
              </p>
              <Btn>Retry review</Btn>
            </div>
          ),
        },
      ],
    },
    {
      name: 'DialogSurface',
      source: 'PENDING todo 11 / 18 — ad hoc divs in web/src/App.tsx:176 and :369',
      pending: 'todo-11',
      cases: [
        { state: 'default', node: <InlineDialog id="sc-dialog-default" /> },
        {
          state: 'focus',
          node: (
            <>
              <Btn primary onClick={() => setModalOpen(true)}>
                Open promotion dialog
              </Btn>
              <ModalDialog
                open={modalOpen}
                title="Promote to"
                body="Choose the piece your pawn becomes. Escape cancels and returns the pawn to its square."
                onClose={() => setModalOpen(false)}
              />
            </>
          ),
        },
        { state: 'active', node: <InlineDialog id="sc-dialog-active" /> },
      ],
    },
    {
      name: 'Toast',
      source: 'PENDING todo 11 — ad hoc div in web/src/App.tsx:399',
      pending: 'todo-11',
      cases: [
        { state: 'default', node: <ToastRegion message="PGN copied to your clipboard" /> },
        { state: 'focus', seed: true, node: <ToastRegion message="Game saved to your library" /> },
        { state: 'active', node: <ToastRegion message="Board flipped — you are now playing black" /> },
      ],
    },
    {
      name: 'Loading',
      source: 'PENDING todo 11 — no implementation exists',
      pending: 'todo-11',
      cases: [
        {
          state: 'loading',
          node: (
            <div className="sc-feedback" aria-busy="true" data-sc-region="true">
              <p className="sc-feedback-line">Searching 3,214 master games…</p>
              <span className="sc-skeleton" aria-hidden="true" />
              <span className="sc-skeleton" aria-hidden="true" />
              <span className="sc-skeleton" aria-hidden="true" />
            </div>
          ),
        },
      ],
    },
    {
      name: 'Empty',
      source: 'PENDING todo 11 — no implementation exists',
      pending: 'todo-11',
      cases: [
        {
          state: 'empty',
          node: (
            <div className="sc-state-block" data-sc-region="true">
              <Icon name="inbox" size="lg" className="sc-icon-mark" />
              <p>No master game matches these filters. Widen the era or clear the player name to see results.</p>
              <Btn primary>Clear filters</Btn>
            </div>
          ),
        },
      ],
    },
    {
      name: 'Error',
      source: 'PENDING todo 11 — no implementation exists',
      pending: 'todo-11',
      cases: [
        {
          state: 'error',
          node: (
            <div className="sc-state-block sc-state-block--error" role="alert" data-sc-region="true">
              <Icon name="alert" size="lg" className="sc-icon-mark--error" />
              <p>Error — the opening book could not be loaded, so training is unavailable.</p>
              <Btn primary>Retry</Btn>
              <details>
                <summary>Technical detail</summary>
                <span>{LONG_BODY}</span>
              </details>
            </div>
          ),
        },
      ],
    },
  ]
}
