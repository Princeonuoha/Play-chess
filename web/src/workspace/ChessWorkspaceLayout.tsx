import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { ChessController, type Snapshot } from '../core/controller'
import {
  Card,
  engineState,
  PromotionDialog,
  type Promotion,
  type WorkspaceRoute,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceNavigation,
  WORKSPACE_ROUTES,
} from './WorkspaceChrome'
import { WorkspaceGuide } from './WorkspaceGuide'
import { BoardConsole } from './BoardConsole'
import { EngineStatus, IconButton, ToastRegion, type ToastMessage, type ToastTone } from '../ui/primitives'
import type { WorkspaceOutletContext } from './WorkspaceRoutes'

/** Long enough to read a confirmation, short enough not to sit over the board. */
const TOAST_DISMISS_MS = 2200

/** Beyond three the stack stops being readable and starts being a wall. */
const TOAST_STACK_MAX = 3

function difficulty(value: number): { readonly name: string; readonly elo: string } {
  if (value >= 20) return { name: 'Maximum', elo: 'Max' }
  const elo = Math.round(1320 + ((3000 - 1320) * value) / 19)
  let name = 'Beginner'
  if (elo >= 2400) name = 'Master'
  else if (elo >= 2050) name = 'Expert'
  else if (elo >= 1750) name = 'Intermediate'
  else if (elo >= 1500) name = 'Casual'
  return { name, elo: String(elo) }
}

export function ChessWorkspaceLayout() {
  const boardRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<ChessController | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [promotion, setPromotion] = useState<Promotion | null>(null)
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([])
  const toastSeq = useRef(0)
  const [sideChoice, setSideChoice] = useState<'white' | 'black' | 'random'>('white')
  const [elo, setElo] = useState(4)
  const [thinkTime, setThinkTime] = useState(1000)
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem('cwp_intro_seen') !== '1'
    } catch {
      return true
    }
  })
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const navigate = useNavigate()

  if (!controllerRef.current) {
    controllerRef.current = new ChessController({
      onSnapshot: setSnapshot,
      onPromo: (from, to, color) => setPromotion({ from, to, color }),
    })
  }
  const controller = controllerRef.current

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    controller.mount(board)
    controller.boot()
    const onResize = () => controller.onResize()
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'ArrowLeft') controller.navPrev()
      else if (event.key === 'ArrowRight') controller.navNext()
      else if (event.key === 'Home') controller.navFirst()
      else if (event.key === 'End') controller.navLast()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [controller])

  useEffect(() => {
    const leftStudy = previousPath.current === '/study' && location.pathname !== '/study'
    previousPath.current = location.pathname
    if (leftStudy && snapshot?.reviewPly != null) controller.resumeGame()
  }, [controller, location.pathname, snapshot?.reviewPly])

  const activeRoute = WORKSPACE_ROUTES.find((route) => route.path === location.pathname)
  useEffect(() => {
    if (activeRoute) document.title = `${activeRoute.label} — chesswithprince.com`
  }, [activeRoute])

  const dismissIntro = () => {
    setShowIntro(false)
    try {
      localStorage.setItem('cwp_intro_seen', '1')
    } catch {}
  }
  const openIntro = () => setShowIntro(true)
  const selectIntroRoute = (route: WorkspaceRoute) => {
    navigate(route.path)
    dismissIntro()
  }
  const showToast = useCallback((message: string, tone: ToastTone = 'default') => {
    toastSeq.current += 1
    const entry: ToastMessage = { id: `toast-${toastSeq.current}`, text: message, tone }
    setToasts((all) => [...all, entry].slice(-TOAST_STACK_MAX))
  }, [])
  const dismissToast = useCallback((id: string) => {
    setToasts((all) => all.filter((toast) => toast.id !== id))
  }, [])

  const selfPlay = snapshot?.selfPlay ?? false
  const replaying = snapshot?.replaying ?? false
  const sessionKey = snapshot?.sessionKey ?? 'train'
  const reviewPly = snapshot?.reviewPly ?? null
  const exploring = snapshot?.exploring ?? false
  const history = snapshot?.history ?? []
  const canBrowse = history.length > 0 && !selfPlay && !replaying && !exploring && !(snapshot?.thinking ?? false)
  const engine = engineState(snapshot?.engineTag)
  const outletContext: WorkspaceOutletContext = {
    controller,
    snapshot,
    sideChoice,
    setSideChoice,
    elo,
    setElo,
    thinkTime,
    setThinkTime,
    difficulty: difficulty(elo),
    selfPlay,
    replaying,
    sessionKey,
    reviewPly,
    exploring,
    history,
    showToast,
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 px-4 pb-6 pt-4 sm:gap-6 sm:px-6 lg:px-10">
      {/* DESIGN.md 8.5 A11Y-12. First stop in the tab order, invisible until it
          has focus, and it lands on the region that holds the board — so the
          first thing a keyboard user reaches after taking it is the board
          console, not four navigation links. */}
      <a className="ui-skiplink" href="#workspace-main">
        Skip to the board
      </a>
      <WorkspaceHeader engineTag={snapshot?.engineTag} onHelp={openIntro} />

      {/* DESIGN.md 8.2: one column on a phone in board → status → nav → inspector
          order, two top-aligned columns from 1024 up. */}
      <main
        id="workspace-main"
        tabIndex={-1}
        data-shell="main"
        className="grid items-start gap-4 focus:outline-none sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div data-shell="board-column" className="flex flex-col items-center gap-2">
          {/* DESIGN.md 8.5 A11Y-08 / A11Y-09. Ahead of the board in reading
              order so a screen reader meets the position as text before it
              meets an empty graphic, and so the move entry is the first thing
              the skip link hands the keyboard. */}
          <BoardConsole snapshot={snapshot} boardRef={boardRef} />
          <div className="flex w-full items-stretch justify-center gap-3">
            <div className="evalbar" title="Evaluation (White's perspective)">
              <div className="white" style={{ transform: `scaleY(${(snapshot?.evalFrac ?? 0.5).toFixed(3)})` }} />
              <div className="mid" />
              <div className="num">{snapshot?.evalLabel ?? '0.0'}</div>
            </div>
            {/* DESIGN.md 8.2 caps the board at 560px on a tablet and 600px on a
                desktop; capping the track lets `.board` keep owning its own
                square sizing. */}
            <div className="flex min-w-0 flex-1 justify-center sm:max-w-[560px] lg:max-w-[600px]">
              <div ref={boardRef} className="board" />
            </div>
          </div>
          {canBrowse && (
            <div className="flex w-full max-w-[560px] items-center gap-1 rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--canvas-sunken)] p-1">
              <IconButton icon="skip-back" onClick={() => controller.navFirst()} label="First move" />
              <IconButton icon="chevron-left" onClick={() => controller.navPrev()} label="Previous move" />
              <div className="flex-1 text-center text-[color:var(--text-muted)] [font:var(--type-label)]">
                {reviewPly === null ? (
                  <span>Live · move {Math.ceil(history.length / 2)} <span className="opacity-50">· use the arrow keys</span></span>
                ) : (
                  <span className="text-[color:var(--text-primary)]">
                    Viewing move {Math.ceil((reviewPly + 1) / 2) || 0}
                    {reviewPly < 0 ? ' · start' : reviewPly % 2 === 0 ? ' (White)' : ' (Black)'} / {Math.ceil(history.length / 2)}
                  </span>
                )}
              </div>
              <IconButton icon="chevron-right" onClick={() => controller.navNext()} label="Next move" />
              <IconButton icon="skip-forward" onClick={() => controller.navLast()} label="Latest / live" />
            </div>
          )}
        </div>

        <Card shell="inspector" className="overflow-hidden">
          <div
            data-shell="status"
            role="status"
            className="border-b border-[color:var(--border-subtle)] bg-[var(--surface-inset)] p-4"
          >
            <div className="flex items-center gap-2">
              {snapshot?.thinking && <span className="ui-spinner" aria-hidden="true" />}
              <div className="[font:var(--type-title)]">{snapshot?.statusWho ?? 'Your move'}</div>
            </div>
            <div className="text-[color:var(--text-muted)] [font:var(--type-body-sm)]">{snapshot?.statusSub ?? 'White to play'}</div>
          </div>
          {/* DESIGN.md 7.3 `EngineStatus`. Ready and loading are the header
              pill's job — it already carries and announces both, and a block
              that appears for the boot and then leaves would shift the panel
              under the player (`tests/board.spec.ts` measures exactly that).
              Failure is the state that changes what the board can do, so it is
              the one that earns space on every route. */}
          {engine === 'error' && (
            <div data-shell="engine-state" className="border-b border-[color:var(--border-subtle)] px-4 py-3">
              <EngineStatus
                state="error"
                detail="Stockfish could not start, so the board will not reply to your moves."
                onRetry={() => controller.boot()}
              />
            </div>
          )}
          {snapshot?.banner && (
            <div
              role="status"
              className="mx-4 mt-3 rounded-[var(--radius-sm)] border border-[color:var(--border-brass)] bg-[var(--surface-inset)] px-3 py-2.5 text-center text-[color:var(--brass-base)] [font:var(--type-heading)]"
            >
              {snapshot.banner}
            </div>
          )}
          <WorkspaceNavigation />
          <div className="grid gap-4 p-4">
            <Outlet context={outletContext} />
          </div>
        </Card>
      </main>

      <WorkspaceFooter />

      <WorkspaceGuide open={showIntro} onClose={dismissIntro} onSelect={selectIntroRoute} />

      {promotion && (
        <PromotionDialog
          promotion={promotion}
          onCancel={() => {
            controller.cancelPromotion()
            setPromotion(null)
          }}
          onChoose={(piece) => {
            controller.finishPromotion(piece)
            setPromotion(null)
          }}
        />
      )}
      <div className="ui-toastdock">
        <ToastRegion toasts={toasts} onDismiss={dismissToast} autoDismissMs={TOAST_DISMISS_MS} />
      </div>
    </div>
  )
}
