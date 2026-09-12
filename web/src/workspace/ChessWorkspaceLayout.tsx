import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { ChessController, type Snapshot } from '../core/controller'
import {
  Card,
  PromotionDialog,
  type Promotion,
  type WorkspaceRoute,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceIntro,
  WorkspaceNavigation,
  WORKSPACE_ROUTES,
} from './WorkspaceChrome'
import { IconButton } from '../ui/primitives'
import type { WorkspaceOutletContext } from './WorkspaceRoutes'

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
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  /** Collapsed on arrival so the board leads the first screen (DESIGN.md 8.3). */
  const [introExpanded, setIntroExpanded] = useState(false)
  const location = useLocation()
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
    if (location.pathname !== '/study' && snapshot?.reviewPly != null) controller.resumeGame()
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
  const openIntroExpanded = () => {
    setShowIntro(true)
    setIntroExpanded(true)
  }
  const selectIntroRoute = (route: WorkspaceRoute) => {
    navigate(route.path)
    dismissIntro()
  }
  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const selfPlay = snapshot?.selfPlay ?? false
  const replaying = snapshot?.replaying ?? false
  const sessionKey = snapshot?.sessionKey ?? 'train'
  const reviewPly = snapshot?.reviewPly ?? null
  const exploring = snapshot?.exploring ?? false
  const history = snapshot?.history ?? []
  const canBrowse = history.length > 0 && !selfPlay && !replaying && !exploring && !(snapshot?.thinking ?? false)
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
      <WorkspaceHeader engineTag={snapshot?.engineTag} onHelp={openIntroExpanded} />

      {showIntro && (
        <WorkspaceIntro
          expanded={introExpanded}
          onExpandedChange={setIntroExpanded}
          onDismiss={dismissIntro}
          onSelect={selectIntroRoute}
        />
      )}

      {/* DESIGN.md 8.2: one column on a phone in board → status → nav → inspector
          order, two top-aligned columns from 1024 up. */}
      <main
        data-shell="main"
        className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div data-shell="board-column" className="flex flex-col items-center gap-2">
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
      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[var(--z-toast)] -translate-x-1/2 rounded-[var(--radius-lg)] border border-[color:var(--border-brass)] bg-[color:var(--surface-1)] px-4 py-2.5 text-sm shadow-[var(--depth-floating)]">
          {toast}
        </div>
      )}
    </div>
  )
}
