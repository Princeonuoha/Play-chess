import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { ChessController, type Snapshot } from '../core/controller'
import {
  Card,
  NavBtn,
  PromotionDialog,
  type Promotion,
  type WorkspaceRoute,
  WorkspaceFooter,
  WorkspaceIntro,
  WorkspaceNavigation,
  WORKSPACE_ROUTES,
} from './WorkspaceChrome'
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
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          chesswithprince<span className="text-[var(--color-brass)]">.com</span>
        </h1>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-[var(--color-muted)]">
          {snapshot?.engineTag ?? 'loading engine…'}
        </span>
        <button
          onClick={() => setShowIntro(true)}
          className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-bold text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          aria-label="How it works"
          title="How it works"
        >
          ?
        </button>
      </header>

      {showIntro && <WorkspaceIntro onDismiss={dismissIntro} onSelect={selectIntroRoute} />}

      <main className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-stretch justify-center gap-3">
            <div className="evalbar" title="Evaluation (White's perspective)">
              <div className="white" style={{ height: `${((snapshot?.evalFrac ?? 0.5) * 100).toFixed(1)}%` }} />
              <div className="mid" />
              <div className="num">{snapshot?.evalLabel ?? '0.0'}</div>
            </div>
            <div className="flex min-w-0 flex-1 justify-center">
              <div ref={boardRef} className="board" />
            </div>
          </div>
          {canBrowse && (
            <div className="flex w-full max-w-[560px] items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
              <NavBtn onClick={() => controller.navFirst()} label="First move">⏮</NavBtn>
              <NavBtn onClick={() => controller.navPrev()} label="Previous move">◀</NavBtn>
              <div className="flex-1 text-center text-xs text-[var(--color-muted)]">
                {reviewPly === null ? (
                  <span>Live · move {Math.ceil(history.length / 2)} <span className="opacity-50">· use ← →</span></span>
                ) : (
                  <span className="text-[var(--color-ink)]">
                    Viewing move {Math.ceil((reviewPly + 1) / 2) || 0}
                    {reviewPly < 0 ? ' · start' : reviewPly % 2 === 0 ? ' (White)' : ' (Black)'} / {Math.ceil(history.length / 2)}
                  </span>
                )}
              </div>
              <NavBtn onClick={() => controller.navNext()} label="Next move">▶</NavBtn>
              <NavBtn onClick={() => controller.navLast()} label="Latest / live">⏭</NavBtn>
            </div>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              {snapshot?.thinking && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-brass)] border-r-transparent" />}
              <div className="text-lg font-bold">{snapshot?.statusWho ?? 'Your move'}</div>
            </div>
            <div className="text-sm text-[var(--color-muted)]">{snapshot?.statusSub ?? 'White to play'}</div>
          </div>
          {snapshot?.banner && (
            <div className="mx-4 mt-3 rounded-lg border border-[var(--color-brass)]/50 bg-white/[0.03] px-3 py-2.5 text-center text-sm font-semibold text-[var(--color-brass)]">
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
        <div className="fixed bottom-7 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-[var(--color-brass)]/50 bg-[var(--color-panel)] px-4 py-2.5 text-sm shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}
