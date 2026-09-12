import { useEffect, useRef } from 'react'
import { useLocation, useOutletContext } from 'react-router'
import type { ChessController, SetKey, Snapshot } from '../core/controller'
import { GamesPanel } from '../panels/GamesPanel'
import { PlayPanel } from '../panels/PlayPanel'
import { StudyPanel } from '../panels/StudyPanel'
import { TrainPanel } from '../panels/TrainPanel'

type SideChoice = 'white' | 'black' | 'random'

export type WorkspaceOutletContext = {
  readonly controller: ChessController
  readonly snapshot: Snapshot | null
  readonly sideChoice: SideChoice
  readonly setSideChoice: (side: SideChoice) => void
  readonly elo: number
  readonly setElo: (value: number) => void
  readonly thinkTime: number
  readonly setThinkTime: (value: number) => void
  readonly difficulty: { readonly name: string; readonly elo: string }
  readonly selfPlay: boolean
  readonly replaying: boolean
  readonly sessionKey: SetKey
  readonly reviewPly: number | null
  readonly exploring: boolean
  readonly history: string[]
  readonly showToast: (message: string) => void
}

const INITIAL_HISTORY_ENTRY = 'default'

function RouteHeading({ children }: { readonly children: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { key } = useLocation()

  useEffect(() => {
    if (key === INITIAL_HISTORY_ENTRY) return
    heading.current?.focus()
  }, [key])

  return (
    <h2 ref={heading} tabIndex={-1} data-route-heading={children} className="sr-only">
      {children}
    </h2>
  )
}

export function PlayWorkspace() {
  const workspace = useOutletContext<WorkspaceOutletContext>()
  return (
    <>
      <RouteHeading>Play</RouteHeading>
      <PlayPanel
        snap={workspace.snapshot}
        elo={workspace.elo}
        tt={workspace.thinkTime}
        sideChoice={workspace.sideChoice}
        setSideChoice={workspace.setSideChoice}
        diff={workspace.difficulty}
        finishLabel={workspace.selfPlay ? '■ Stop' : '▶ Watch Stockfish finish this game'}
        fullLabel={workspace.selfPlay ? '■ Stop' : '▶ Watch a full engine game'}
        onNewGame={() => workspace.controller.newGame(workspace.sideChoice)}
        onFlip={() => workspace.controller.flip()}
        onUndo={() => workspace.controller.undo()}
        onSetElo={(value) => {
          workspace.setElo(value)
          workspace.controller.setEloSlider(value)
        }}
        onSetTt={(value) => {
          workspace.setThinkTime(value)
          workspace.controller.setThinkTime(value)
        }}
        controller={workspace.controller}
      />
    </>
  )
}

export function OpeningsWorkspace() {
  const workspace = useOutletContext<WorkspaceOutletContext>()
  return (
    <>
      <RouteHeading>Openings</RouteHeading>
      {workspace.snapshot && (
        <TrainPanel
          snap={workspace.snapshot}
          replaying={workspace.replaying}
          selfPlay={workspace.selfPlay}
          sessionKey={workspace.sessionKey}
          reviewPly={workspace.reviewPly}
          controller={workspace.controller}
        />
      )}
    </>
  )
}

export function GamesWorkspace() {
  const workspace = useOutletContext<WorkspaceOutletContext>()
  return (
    <>
      <RouteHeading>Games</RouteHeading>
      <GamesPanel
        snap={workspace.snapshot}
        replaying={workspace.replaying}
        selfPlay={workspace.selfPlay}
        sessionKey={workspace.sessionKey}
        controller={workspace.controller}
      />
    </>
  )
}

export function StudyWorkspace() {
  const workspace = useOutletContext<WorkspaceOutletContext>()
  return (
    <>
      <RouteHeading>Study</RouteHeading>
      <StudyPanel
        snap={workspace.snapshot}
        history={workspace.history}
        reviewPly={workspace.reviewPly}
        exploring={workspace.exploring}
        showToast={workspace.showToast}
        controller={workspace.controller}
      />
    </>
  )
}

export function UnknownWorkspace() {
  return <RouteHeading>Workspace not found</RouteHeading>
}
