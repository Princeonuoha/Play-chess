import { useState } from 'react'
import {
  Btn,
  DialogSurface,
  Empty,
  EngineStatus,
  Error,
  InlineFeedback,
  Loading,
  SegmentedNav,
  StatusNote,
  ToastRegion,
  type SegmentItem,
  type ToastMessage,
} from '../ui/primitives'
import { WorkspaceNavPreview, type NavPreviewItem } from './pending'
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

const DESTINATIONS: readonly NavPreviewItem[] = [
  { id: 'play', label: 'Play', icon: 'circle-play' },
  { id: 'openings', label: 'Openings', icon: 'book' },
  { id: 'games', label: 'Games', icon: 'trophy' },
  { id: 'study', label: 'Study', icon: 'search' },
]

function DismissibleToast() {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([
    { id: 'pgn', text: 'PGN copied to your clipboard' },
  ])
  return <ToastRegion toasts={toasts} onDismiss={(id) => setToasts((all) => all.filter((t) => t.id !== id))} />
}

const STATIC_TOAST = (id: string, text: string): readonly ToastMessage[] => [{ id, text }]

export function useFeedbackGroups(): readonly ShowcaseGroup[] {
  const [selected, setSelected] = useState('review')
  const [dialogOpen, setDialogOpen] = useState(false)

  return [
    {
      name: 'SegmentedNav',
      source: 'web/src/ui/surfaces.tsx',
      cases: [
        { state: 'default', node: <SegmentedNav label="Sub-surface" items={SUB_SURFACES} selectedId={selected} onSelect={setSelected} controlsPanels /> },
        { state: 'hover', node: <SegmentedNav label="Sub-surface, hover" items={SUB_SURFACES} selectedId="explore" /> },
        { state: 'focus', seed: true, node: <SegmentedNav label="Sub-surface, focus" items={SUB_SURFACES} selectedId="analysis" /> },
        { state: 'active', node: <SegmentedNav label="Sub-surface, active" items={SUB_SURFACES} selectedId="review" /> },
        { state: 'disabled', node: <SegmentedNav label="Sub-surface, disabled" items={DISABLED_SUB_SURFACES} selectedId="analysis" /> },
      ],
    },
    {
      name: 'WorkspaceNav',
      source: 'PENDING todo 12 — routed nav ships in web/src/workspace/WorkspaceChrome.tsx and is rebuilt on SegmentedNav by the shell redesign',
      pending: 'todo-12',
      cases: [
        { state: 'default', node: <WorkspaceNavPreview items={DESTINATIONS} currentId="play" /> },
        { state: 'hover', node: <WorkspaceNavPreview items={DESTINATIONS} currentId="study" /> },
        { state: 'focus', seed: true, node: <WorkspaceNavPreview items={DESTINATIONS} currentId="openings" /> },
        { state: 'active', node: <WorkspaceNavPreview items={DESTINATIONS} currentId="play" /> },
        { state: 'loading', node: <WorkspaceNavPreview items={DESTINATIONS} currentId="play" pendingId="games" /> },
      ],
    },
    {
      name: 'EngineStatus',
      source: 'web/src/ui/feedback.tsx',
      cases: [
        { state: 'default', node: <EngineStatus state="ready" engine="Stockfish 18 lite" /> },
        { state: 'loading', node: <EngineStatus state="loading" /> },
        {
          state: 'error',
          node: (
            <EngineStatus
              state="error"
              detail="Stockfish could not start, so the board will not reply to your moves."
              onRetry={() => {}}
            />
          ),
        },
      ],
    },
    {
      name: 'StatusNote',
      source: 'web/src/ui/feedback.tsx',
      cases: [
        {
          state: 'default',
          node: (
            <StatusNote
              slot={{
                statusHtml: '<span class="good">Book move — Nimzo-Indian Defence</span>',
                note: 'Black pins the knight on c3 and fights for e4 without committing a central pawn.',
              }}
            />
          ),
        },
        {
          state: 'error',
          node: (
            <StatusNote
              tone="error"
              slot={{
                statusHtml: '<span class="bad">That move leaves the king in check</span>',
                note: 'Move the king, block the checking piece, or capture it before continuing.',
              }}
            />
          ),
        },
      ],
    },
    {
      name: 'InlineFeedback',
      source: 'web/src/ui/feedback.tsx',
      cases: [
        { state: 'default', node: <InlineFeedback /> },
        { state: 'loading', node: <InlineFeedback state="loading" message="Analyzing move 14…" /> },
        {
          state: 'empty',
          node: <InlineFeedback state="empty" message="No game has been reviewed yet." action={<Btn>Review this game</Btn>} />,
        },
        {
          state: 'error',
          node: (
            <InlineFeedback
              state="error"
              message="Error — the review stopped at move 14 because Stockfish restarted."
              action={<Btn icon="retry">Retry review</Btn>}
            />
          ),
        },
      ],
    },
    {
      name: 'DialogSurface',
      source: 'web/src/ui/overlays.tsx',
      cases: [
        {
          state: 'default',
          node: (
            <>
              <Btn primary onClick={() => setDialogOpen(true)}>
                Open promotion dialog
              </Btn>
              <DialogSurface
                open={dialogOpen}
                title="Promote to"
                description="Choose the piece your pawn becomes. Escape cancels and returns the pawn to its square."
                dismissLabel="Cancel promotion"
                onClose={() => setDialogOpen(false)}
              >
                <div className="ui-dialog-row">
                  <span className="ui-contents" data-dialog-autofocus>
                    <Btn primary onClick={() => setDialogOpen(false)}>
                      Queen
                    </Btn>
                  </span>
                  <Btn onClick={() => setDialogOpen(false)}>Rook</Btn>
                  <Btn onClick={() => setDialogOpen(false)}>Bishop</Btn>
                  <Btn onClick={() => setDialogOpen(false)}>Knight</Btn>
                </div>
              </DialogSurface>
            </>
          ),
        },
        {
          state: 'focus',
          node: (
            <Btn onClick={() => setDialogOpen(true)} className="sc-dialog-invoker">
              Open dialog and return focus here
            </Btn>
          ),
        },
        {
          state: 'active',
          node: <Btn onClick={() => setDialogOpen(true)}>Open dialog to press a choice</Btn>,
        },
      ],
    },
    {
      name: 'Toast',
      source: 'web/src/ui/overlays.tsx',
      cases: [
        { state: 'default', node: <DismissibleToast /> },
        {
          state: 'focus',
          seed: true,
          node: <ToastRegion toasts={STATIC_TOAST('saved', 'Game saved to your library')} onDismiss={() => {}} />,
        },
        {
          state: 'active',
          node: <ToastRegion toasts={STATIC_TOAST('flip', 'Board flipped — you are now playing black')} onDismiss={() => {}} />,
        },
      ],
    },
    {
      name: 'Loading',
      source: 'web/src/ui/feedback.tsx',
      cases: [{ state: 'loading', node: <Loading label="Searching 3,214 master games…" /> }],
    },
    {
      name: 'Empty',
      source: 'web/src/ui/feedback.tsx',
      cases: [
        {
          state: 'empty',
          node: (
            <Empty
              message="No master game matches these filters. Widen the era or clear the player name to see results."
              actionLabel="Clear filters"
            />
          ),
        },
      ],
    },
    {
      name: 'Error',
      source: 'web/src/ui/feedback.tsx',
      cases: [
        {
          state: 'error',
          node: (
            <Error
              message="Error — the opening book could not be loaded, so training is unavailable."
              detail={LONG_BODY}
            />
          ),
        },
      ],
    },
  ]
}
