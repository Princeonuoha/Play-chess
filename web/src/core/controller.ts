/// <reference types="vite/client" />

import { Chess } from 'chess.js'
import type { Move, Square } from 'chess.js'
import { createEngine, type Engine } from './engine'
import { pieceSVG } from './pieces'
import { BOOK, type BookLine } from './book'
import { classify, type MoveLabel } from './grade'
import { buildPGN } from './pgn'

export type ActiveMode =
  | { kind: 'idle' }
  | { kind: 'trainer'; line: BookLine; ply: number; hints: boolean; target: number; bookLen: number }
  | { kind: 'selfPlay' }
  | { kind: 'replay'; line: BookLine; idx: number; timer: ReturnType<typeof setTimeout> | null }
  | { kind: 'review'; collect: { cp: number; mate: number | null; pv: string[]; bestUci: string } | null; resolve: (() => void) | null }
  | { kind: 'explore'; game: Chess; moves: string[]; startPly: number };

export type AnalysisOverlay = { data: Record<number, { depth: number; kind: string; val: number; pv: string[] }>; fen: string };

export type SetKey = 'train' | 'games'

export interface SessionSlot {
  statusHtml: string
  note: string
  hintDisabled: boolean
}

export interface AnalysisLine {
  ev: string
  pv: string
  best: boolean
}

export type { MoveLabel } from './grade'

export interface ReviewItem {
  ply: number
  moveNo: number
  side: 'w' | 'b'
  san: string
  from: string
  to: string
  label: MoveLabel
  lossCp: number | null
  betterSan: string | null
  betterPv: string | null
  evalWhite: string
  isYou: boolean
}

export const GRADE_GLYPH: Record<MoveLabel, string> = {
  Best: '★',
  Good: '✓',
  Inaccuracy: '?!',
  Mistake: '?',
  Blunder: '??',
}

/* DESIGN.md 8.5 A11Y-05. The shape each board state is drawn with, published on
   the element so the cue is assertable without sampling a colour. The cascade
   in `index.css` draws exactly these geometries. */
export const BOARD_CUE = {
  last: 'corner-brackets',
  hint: 'ring-dashed',
  sel: 'ring-solid',
  check: 'ring-double',
} as const

export interface StoryLine {
  kind: 'opening' | 'master'
  title: string
  text: string
}

export interface ReviewState {
  running: boolean
  done: boolean
  progress: string
  items: ReviewItem[]
  story: StoryLine[]
}

export interface AnnItem {
  ply: number
  moveNo: number
  side: 'w' | 'b'
  san: string
  evalWhite: string
  isBook: boolean
  betterSan: string | null // engine's preferred move when the book move differs
  theoryEnd?: boolean // first move after the known line ends
}

export interface AnnotationState {
  running: boolean
  done: boolean
  progress: string
  moves: AnnItem[]
}

export interface Snapshot {
  engineTag: string
  statusWho: string
  statusSub: string
  thinking: boolean
  banner: string | null
  evalFrac: number
  evalLabel: string
  history: string[]
  analysis: AnalysisLine[] | null
  analyzing: boolean
  selfPlay: boolean
  replaying: boolean
  sessionKey: SetKey
  train: SessionSlot
  games: SessionSlot
  review: ReviewState | null
  reviewPly: number | null
  annotation: AnnotationState | null
  exploring: boolean
  exploreMoves: string[]
  exploreStartPly: number
  selectedSquare: string | null
}

const FILES = 'abcdefgh'
const stripSan = (s: string) => (s || '').replace(/[+#]/g, '')
const sanEq = (a: string, b: string) => stripSan(a) === stripSan(b)

/* One controller owns all game/engine/board state and the board DOM subtree.
   React renders the chrome and calls these methods; the controller pushes a
   Snapshot back whenever anything the panel shows changes. The board rendering,
   drag/animation, engine protocol, trainer and coordinate-based book matching
   are ported verbatim from the tested single-file app. */
export class ChessController {
  private game = new Chess()
  private engine: Engine
  private onSnapshot: (s: Snapshot) => void
  private onPromo: (from: string, to: string, color: string) => void

  private activeMode: ActiveMode = { kind: 'idle' }
  private analysisOverlay: AnalysisOverlay | null = null
  private orientation: 'white' | 'black' = 'white'
  private humanColor: 'w' | 'b' = 'w'
  private thinking = false
  private selected: string | null = null
  private lastMove: { from: string; to: string } | null = null
  private moveTime = 1000
  private animating = false
  private hintSquares: { from: string; to: string } | null = null
  private engineExpected = false
  private epoch = 0
  private eloSlider = 4
  private pendingPromo: { from: string; to: string } | null = null

  // Panel-facing state emitted in the snapshot.
  private engineTag = 'loading engine…'
  private evalFrac = 0.5
  private evalLabel = '0.0'
  private analysis: AnalysisLine[] | null = null
  private review: ReviewState | null = null
  private reviewPly: number | null = null
  private viewGame: Chess | null = null
  private annotation: AnnotationState | null = null
  private sessionKey: SetKey = 'train'
  private slots: Record<SetKey, SessionSlot> = {
    train: { statusHtml: '', note: '', hintDisabled: true },
    games: { statusHtml: '', note: '', hintDisabled: true },
  }

  // Board DOM
  private root!: HTMLElement
  private elSquares!: HTMLElement
  private elHl!: HTMLElement
  private elDots!: HTMLElement
  private elPieces!: HTMLElement
  private drag: { el: HTMLElement; from: string; offsetX: number; offsetY: number; moved: boolean } | null = null

  constructor(opts: {
    onSnapshot: (s: Snapshot) => void
    onPromo: (from: string, to: string, color: string) => void
  }) {
    this.onSnapshot = opts.onSnapshot
    this.onPromo = opts.onPromo
    this.engine = createEngine(() => {
      this.engineTag = 'engine failed to load'
      this.emit()
    })
    this.engine.on('best', (uci) => this.onBest(uci))
    this.engine.on('info', (line) => this.onInfo(line))
  }

  /* -------------------------- mount + snapshot -------------------------- */
  mount(boardEl: HTMLElement) {
    this.root = boardEl
    boardEl.innerHTML =
      '<div class="squares"></div><div class="layer hl-layer"></div>' +
      '<div class="layer dot-layer"></div><div class="layer piece-layer" style="pointer-events:auto"></div>'
    this.elSquares = boardEl.querySelector('.squares') as HTMLElement
    this.elHl = boardEl.querySelector('.hl-layer') as HTMLElement
    this.elDots = boardEl.querySelector('.dot-layer') as HTMLElement
    this.elPieces = boardEl.querySelector('.piece-layer') as HTMLElement
    this.attachPointer()
    this.renderSquares()
    this.renderAll()
  }

  boot() {
    this.engineTag = 'loading engine…'
    this.emit()
    this.engine
      .boot()
      .then((src) => {
        this.engineTag = src === 'local' ? 'Stockfish 18 · local' : 'Stockfish 18 · CDN'
        this.emit()
      })
      .catch(() => {
        this.engineTag = 'engine failed to load'
        this.emit()
      })
  }

  onResize() {
    this.renderPieces()
    this.renderHighlights()
    this.renderDots()
  }

  private snapshot(): Snapshot {
    const over = this.game.isGameOver()
    let who = 'Your move'
    let sub = 'White to play'
    let banner: string | null = null
    const toMove = this.game.turn() === 'w' ? 'White' : 'Black'
    if (over) {
      let msg = 'Game over'
      if (this.game.isCheckmate()) msg = (this.game.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate'
      else if (this.game.isStalemate()) msg = 'Draw — stalemate'
      else if (this.game.isThreefoldRepetition()) msg = 'Draw — threefold repetition'
      else if (this.game.isInsufficientMaterial()) msg = 'Draw — insufficient material'
      else if (this.game.isDraw()) msg = 'Draw — fifty-move rule'
      who = 'Game over'
      sub = toMove + ' to move'
      banner = msg
    } else if (this.activeMode.kind === 'selfPlay') {
      who = 'Stockfish vs Stockfish'
      sub = toMove + (this.thinking ? ' is thinking…' : ' to play')
    } else if (this.thinking) {
      who = 'Stockfish is thinking…'
      sub = toMove + ' to play'
    } else if (this.game.turn() === this.humanColor) {
      who = 'Your move'
      sub = toMove + ' to play' + (this.game.inCheck() ? ' — check' : '')
    } else {
      who = 'Stockfish to move'
      sub = toMove + ' to play'
    }
    return {
      engineTag: this.engineTag,
      statusWho: who,
      statusSub: sub,
      thinking: this.thinking,
      banner,
      evalFrac: this.evalFrac,
      evalLabel: this.evalLabel,
      history: this.game.history(),
      analysis: this.analysis,
      analyzing: this.analysisOverlay !== null,
      selfPlay: this.activeMode.kind === 'selfPlay',
      replaying: this.activeMode.kind === 'replay',
      sessionKey: this.sessionKey,
      train: { ...this.slots.train },
      games: { ...this.slots.games },
      review: this.review,
      reviewPly: this.reviewPly,
      annotation: this.annotation,
      exploring: this.activeMode.kind === 'explore',
      exploreMoves: this.activeMode.kind === 'explore' ? [...this.activeMode.moves] : [],
      exploreStartPly: this.activeMode.kind === 'explore' ? this.activeMode.startPly : 0,
      selectedSquare: this.selected,
    }
  }

  private emit() {
    this.onSnapshot(this.snapshot())
  }

  /* -------------------------- geometry -------------------------- */
  private fileIdx(sq: string) {
    return FILES.indexOf(sq[0])
  }
  private rankIdx(sq: string) {
    return parseInt(sq[1], 10) - 1
  }
  private squareXY(sq: string) {
    const f = this.fileIdx(sq)
    const r = this.rankIdx(sq)
    const x = this.orientation === 'white' ? f : 7 - f
    const y = this.orientation === 'white' ? 7 - r : r
    return { left: x * 12.5, top: y * 12.5 }
  }
  /* DESIGN.md 6.3 moves pieces on `transform`. A piece box is 12.5% of the
     board, so a board-percentage offset becomes a piece-relative translate by
     scaling it by 8 — `translate3d(100%, 0, 0)` is exactly one square right. */
  private translate(el: HTMLElement, left: number, top: number) {
    el.style.transform = `translate3d(${left * 8}%, ${top * 8}%, 0)`
  }
  private placePiece(el: HTMLElement, sq: string) {
    const { left, top } = this.squareXY(sq)
    this.translate(el, left, top)
  }
  private xyToSquare(px: number, py: number) {
    let x = Math.floor(px * 8)
    let y = Math.floor(py * 8)
    x = Math.max(0, Math.min(7, x))
    y = Math.max(0, Math.min(7, y))
    const f = this.orientation === 'white' ? x : 7 - x
    const r = this.orientation === 'white' ? 7 - y : y
    return FILES[f] + (r + 1)
  }

  /* -------------------------- board rendering -------------------------- */
  private renderSquares() {
    this.elSquares.innerHTML = ''
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const f = this.orientation === 'white' ? x : 7 - x
        const r = this.orientation === 'white' ? 7 - y : y
        const sq = FILES[f] + (r + 1)
        const div = document.createElement('div')
        div.className = 'sq ' + ((f + r) % 2 === 0 ? 'dark' : 'light')
        div.dataset.square = sq
        if (y === 7) {
          const c = document.createElement('span')
          c.className = 'coord file'
          c.textContent = FILES[f]
          div.appendChild(c)
        }
        if (x === 0) {
          const c = document.createElement('span')
          c.className = 'coord rank'
          c.textContent = String(r + 1)
          div.appendChild(c)
        }
        this.elSquares.appendChild(div)
      }
    }
  }

  private pos(): Chess {
    if (this.activeMode.kind === 'explore') return this.activeMode.game
    return this.viewGame || this.game
  }
  // The game the pointer input drives, and whose pieces can be picked up.
  private activeGame(): Chess {
    return this.activeMode.kind === 'explore' ? this.activeMode.game : this.game
  }
  private mover(): 'w' | 'b' {
    return this.activeMode.kind === 'explore' ? this.activeMode.game.turn() : this.humanColor
  }

  private renderPieces() {
    this.elPieces.innerHTML = ''
    const p = this.pos()
    const board = p.board()
    for (const row of board) {
      for (const cell of row) {
        if (!cell) continue
        const el = document.createElement('div')
        el.className = 'piece'
        el.dataset.square = cell.square
        el.dataset.color = cell.color
        this.placePiece(el, cell.square)
        el.innerHTML = pieceSVG(cell.type, cell.color)
        const canGrab = this.activeMode.kind === 'explore'
          ? cell.color === p.turn() && !p.isGameOver()
          : !this.viewGame &&
            cell.color === this.game.turn() &&
            cell.color === this.humanColor &&
            !this.thinking &&
            !this.game.isGameOver()
        if (canGrab) el.classList.add('mine')
        this.elPieces.appendChild(el)
      }
    }
  }

  private renderHighlights() {
    this.elHl.innerHTML = ''
    const add = (sq: string, cls: keyof typeof BOARD_CUE) => {
      const { left, top } = this.squareXY(sq)
      const d = document.createElement('div')
      d.className = 'hl ' + cls
      d.dataset.cue = BOARD_CUE[cls]
      d.style.left = left + '%'
      d.style.top = top + '%'
      this.elHl.appendChild(d)
    }
    if (this.lastMove) {
      add(this.lastMove.from, 'last')
      add(this.lastMove.to, 'last')
    }
    if (this.hintSquares) {
      add(this.hintSquares.from, 'hint')
      add(this.hintSquares.to, 'hint')
    }
    if (this.selected) add(this.selected, 'sel')
    const p = this.pos()
    if (p.inCheck()) {
      const turn = p.turn()
      for (const row of p.board())
        for (const c of row) if (c && c.type === 'k' && c.color === turn) add(c.square, 'check')
    }
    // Game-review grade badge on the moved square of the ply being viewed.
    if (this.review && this.review.done && this.review.items.length && this.activeMode.kind !== 'explore') {
      const total = this.game.history().length
      const vp = this.reviewPly === null ? total - 1 : this.reviewPly
      const it = this.review.items.find((x) => x.ply === vp)
      if (it && it.to) {
        const { left, top } = this.squareXY(it.to)
        const cell = document.createElement('div')
        cell.className = 'gb'
        cell.dataset.cue = 'grade-glyph'
        cell.style.left = left + '%'
        cell.style.top = top + '%'
        const pill = document.createElement('i')
        pill.className = 'gb-badge gb-' + it.label.toLowerCase()
        pill.textContent = GRADE_GLYPH[it.label]
        cell.appendChild(pill)
        this.elHl.appendChild(cell)
      }
    }
  }

  private renderDots() {
    this.elDots.innerHTML = ''
    if (!this.selected) return
    const moves = this.activeGame().moves({ square: this.selected as Square, verbose: true }) as Move[]
    for (const m of moves) {
      const { left, top } = this.squareXY(m.to)
      const d = document.createElement('div')
      d.className = 'dot' + (m.flags.includes('c') || m.flags.includes('e') ? ' cap' : '')
      d.style.left = left + '%'
      d.style.top = top + '%'
      d.innerHTML = '<i></i>'
      this.elDots.appendChild(d)
    }
  }

  private renderAll() {
    this.renderPieces()
    this.renderHighlights()
    this.renderDots()
    this.emit()
  }

  /* -------------------------- eval -------------------------- */
  private setEval(cpWhite: number, mate: number | null) {
    let frac: number
    let label: string
    if (mate !== null && mate !== undefined) {
      frac = mate > 0 ? 1 : 0
      label = '#' + Math.abs(mate)
    } else {
      const cp = Math.max(-1500, Math.min(1500, cpWhite))
      frac = 1 / (1 + Math.exp(-cp / 400))
      const v = cpWhite / 100
      label = (v >= 0 ? '+' : '') + v.toFixed(1)
    }
    this.evalFrac = frac
    this.evalLabel = label
  }
  private parseInfo(line: string) {
    const m = line.match(/score (cp|mate) (-?\d+)/)
    if (!m) return
    const sideToMove = this.game.turn()
    const sign = sideToMove === 'w' ? 1 : -1
    if (m[1] === 'cp') this.setEval(parseInt(m[2], 10) * sign, null)
    else this.setEval(0, parseInt(m[2], 10) * sign)
    this.emit()
  }

  /* -------------------------- move flow -------------------------- */
  private animateThen(fromSq: string, toSq: string, cb: () => void) {
    const el = this.elPieces.querySelector(`.piece[data-square="${fromSq}"]`) as HTMLElement | null
    if (!el) {
      cb()
      return
    }
    this.animating = true
    requestAnimationFrame(() => {
      this.placePiece(el, toSq)
    })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', finish)
      this.animating = false
      cb()
    }
    el.addEventListener('transitionend', finish)
    setTimeout(finish, 240)
  }

  private applyMove(moveObj: { from: string; to: string }) {
    this.lastMove = { from: moveObj.from, to: moveObj.to }
    this.selected = null
    this.clearAnalysis()
    this.elDots.innerHTML = ''
    const myEpoch = this.epoch
    this.animateThen(moveObj.from, moveObj.to, () => {
      if (myEpoch !== this.epoch) {
        this.renderAll()
        return
      }
      this.renderAll()
      this.afterMove()
    })
  }

  private afterMove() {
    if (this.game.isGameOver()) {
      if (this.activeMode.kind === 'selfPlay') this.activeMode = { kind: 'idle' }
      if (this.activeMode.kind === 'trainer' && this.activeMode.line.result) {
        this.endOfBook()
        return
      }
      this.emit()
      return
    }
    if (this.activeMode.kind === 'selfPlay') {
      setTimeout(() => {
        if (this.activeMode.kind === 'selfPlay') this.engineMove()
      }, 350)
      return
    }
    if (this.activeMode.kind === 'trainer') {
      this.maybeBookMove()
      return
    }
    if (this.game.turn() !== this.humanColor) this.engineMove()
  }

  private tryHumanMove(from: string, to: string, promo?: string): boolean | 'promo' {
    if (this.activeMode.kind === 'explore') return this.tryExploreMove(from, to, promo)
    const legal = (this.game.moves({ square: from as Square, verbose: true }) as Move[]).filter((m) => m.to === to)
    if (!legal.length) return false
    if (legal.some((m) => m.promotion) && !promo) {
      this.askPromotion(from, to, this.game.turn())
      return 'promo'
    }

    if (this.activeMode.kind === 'trainer') {
      const expected = this.activeMode.line.moves[this.activeMode.ply]
      const exp = this.squaresForSan(expected)
      const mv = this.game.move({ from, to, promotion: promo || 'q' })
      if (!mv) return false
      const match =
        exp && mv.from === exp.from && mv.to === exp.to && (exp.promotion || '') === (mv.promotion || '')
      if (match) {
        this.activeMode.ply++
        this.hintSquares = null
        this.setTrStatus('good', '✓ ' + mv.san + (this.activeMode.line.result ? '' : ' — book.'))
        this.showNoteFor(this.activeMode.ply - 1)
        this.applyMove(mv)
        return true
      }
      const userSan = mv.san
      this.game.undo()
      this.setTrStatus('bad', '✗ ' + userSan + ' is off book. The book move is ' + stripSan(expected) + '.')
      this.hintSquares = exp ? { from: exp.from, to: exp.to } : null
      this.renderHighlights()
      this.emit()
      return false
    }

    const mv = this.game.move({ from, to, promotion: promo || 'q' })
    if (!mv) return false
    this.applyMove(mv)
    return true
  }

  private engineMove() {
    if (this.game.isGameOver()) return
    this.thinking = true
    this.engineExpected = true
    this.renderPieces()
    this.emit()
    this.engine.whenReady().then(() => {
      this.engine.setStrength(this.currentElo())
      this.engine.go(this.game.fen(), this.moveTime)
    })
  }

  private onBest(uci: string) {
    if (this.activeMode.kind === 'review') {
      if (this.activeMode.collect) this.activeMode.collect.bestUci = uci
      const done = this.activeMode.resolve
      this.activeMode = { ...this.activeMode, resolve: null }
      done && done()
      return
    }
    if (this.analysisOverlay) {
      this.finishAnalysis()
      return
    }
    if (!this.engineExpected) {
      this.thinking = false
      this.emit()
      return
    }
    this.engineExpected = false
    this.thinking = false
    if (!uci || uci === '(none)') {
      if (this.activeMode.kind === 'selfPlay') this.activeMode = { kind: 'idle' }
      this.emit()
      return
    }
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promo = uci.length > 4 ? uci[4] : undefined
    const mv = this.game.move({ from, to, promotion: promo })
    if (mv) this.applyMove(mv)
    else this.renderAll()
  }

  private onInfo(line: string) {
    if (this.activeMode.kind === 'review') {
      if (this.activeMode.collect) {
        const sc = line.match(/score (cp|mate) (-?\d+)/)
        const pvm = line.match(/ pv (.+)$/)
        if (sc) {
          if (sc[1] === 'cp') {
            this.activeMode.collect.cp = parseInt(sc[2], 10)
            this.activeMode.collect.mate = null
          } else {
            this.activeMode.collect.mate = parseInt(sc[2], 10)
          }
        }
        if (pvm) this.activeMode.collect.pv = pvm[1].trim().split(/\s+/)
      }
      return
    }
    if (this.analysisOverlay) {
      this.collectAnalysis(line)
      return
    }
    if (this.thinking) this.parseInfo(line)
  }

  /* -------------------------- book / trainer -------------------------- */
  private squaresForSan(san: string): { from: string; to: string; promotion?: string } | null {
    for (const m of this.game.moves({ verbose: true }) as Move[])
      if (sanEq(m.san, san)) return { from: m.from, to: m.to, promotion: m.promotion }
    try {
      const t = new Chess(this.game.fen())
      const m = t.move(san, { strict: false })
      if (m) return { from: m.from, to: m.to, promotion: m.promotion }
    } catch (e) {}
    return null
  }

  private setTrStatus(kind: 'good' | 'bad' | 'info', text: string) {
    const cls = kind === 'good' ? 'good' : kind === 'bad' ? 'bad' : 'info'
    this.slots[this.sessionKey].statusHtml = `<span class="${cls}">${text}</span>`
    this.emit()
  }
  private showNoteFor(idx: number) {
    const line = this.activeMode.kind === 'trainer' || this.activeMode.kind === 'replay' ? this.activeMode.line : null
    const n = line && line.notes && line.notes[idx]
    if (n) {
      this.slots[this.sessionKey].note = n
      this.emit()
    }
  }
  private clearNote() {
    this.slots.train.note = ''
    this.slots.games.note = ''
    this.emit()
  }
  private trLineLabel() {
    if (this.activeMode.kind !== 'trainer') return ''
    const l = this.activeMode.line
    return l.game ? l.variation : `${l.opening} — ${l.variation}`
  }
  private trProgress() {
    if (this.activeMode.kind !== 'trainer') return ''
    const total = this.activeMode.target ? this.activeMode.target / 2 : Math.ceil(this.activeMode.line.moves.length / 2)
    const done = Math.ceil(this.activeMode.ply / 2)
    return `<span class="path">${this.trLineLabel()} · move ${done}/${total}<br>${
      this.activeMode.line.moves.slice(0, this.activeMode.ply).join(' ') || '—'
    }</span>`
  }

  private maybeBookMove() {
    if (this.activeMode.kind !== 'trainer') return
    this.slots[this.sessionKey].hintDisabled = false
    if (this.activeMode.ply >= this.activeMode.line.moves.length) {
      // Book ran out. For opening lines, keep coaching to move 20 by pulling the
      // engine's best move one at a time (suggested, never played out as a game).
      if (!this.activeMode.line.result && this.activeMode.ply < this.activeMode.target && !this.game.isGameOver()) {
        this.extendCoach()
        return
      }
      this.endOfBook()
      return
    }
    if (this.game.turn() === this.humanColor) {
      const past = this.activeMode.ply >= this.activeMode.bookLen
      const prompt = this.activeMode.line.result
        ? 'Your move — play the game move.'
        : past
          ? 'Your move — play the suggested best move.'
          : 'Your move — play the book move.'
      this.setTrStatus('info', prompt + this.trProgress())
      // Past known theory the best move is a suggestion, so always highlight it.
      this.hintSquares =
        this.activeMode.hints || past ? this.squaresForSan(this.activeMode.line.moves[this.activeMode.ply]) : null
      this.renderHighlights()
      this.emit()
      return
    }
    const san = this.activeMode.line.moves[this.activeMode.ply]
    const sq = this.squaresForSan(san)
    const mv = sq ? this.game.move({ from: sq.from, to: sq.to, promotion: sq.promotion }) : this.game.move(san)
    if (!mv) {
      this.endOfBook()
      return
    }
    this.activeMode.ply++
    this.showNoteFor(this.activeMode.ply - 1)
    this.setTrStatus('info', this.trProgress())
    this.applyMove(mv)
  }

  private endOfBook() {
    if (this.activeMode.kind !== 'trainer') return
    const line = this.activeMode.line
    const total = Math.ceil(line.moves.length / 2)
    this.slots[this.sessionKey].hintDisabled = true
    this.hintSquares = null
    this.activeMode = { kind: 'idle' }
    if (line.result) {
      this.setTrStatus('good', `End of the game — ${line.white} vs ${line.black}, ${line.result}.`)
    } else {
      // Opening line: stop at the end. The engine never takes over and plays on.
      this.setTrStatus('good', `You reached move ${total} — nicely played. Pick another opening or replay this one.`)
    }
    this.renderHighlights()
    this.emit()
  }

  // Coaching extension: past the known book line, pull Stockfish's single best
  // move for the current position and append it to the line, so training keeps
  // suggesting best moves (and highlighting them as hints) to move 20 — the
  // engine never plays a free game against the student.
  private async extendCoach() {
    if (this.activeMode.kind !== 'trainer') return
    const trainerMode = this.activeMode
    const myEpoch = this.epoch
    this.setTrStatus('info', 'Finding the best move…' + this.trProgress())
    this.emit()
    this.activeMode = { kind: 'review', collect: null, resolve: null }
    await this.evalPosition(this.game.fen(), 350)
    const reviewMode = this.activeMode
    if (reviewMode.kind === 'review') this.activeMode = trainerMode
    if (myEpoch !== this.epoch || reviewMode.kind !== 'review') return // mode switched mid-think
    const b = reviewMode.collect?.bestUci
    const san = b && b !== '(none)' ? ChessController.uciToSan(this.game.fen(), b) : null
    if (!san) {
      this.endOfBook()
      return
    }
    trainerMode.line.moves.push(san)
    this.maybeBookMove()
  }

  startTrainer(idx: number, set: SetKey, hints: boolean) {
    this.startTrainerLine(BOOK[idx], set, hints)
  }

  // Train an arbitrary line (used by the Opening Explorer, which supplies lines
  // from the bundled openings DB rather than a fixed BOOK index).
  startTrainerLine(line: BookLine, set: SetKey, hints: boolean) {
    this.epoch++
    this.exitReview()
    this.stopReplay()
    this.stopSelfPlay()
    this.sessionKey = set
    // Clone the line (fresh moves array) so the to-move-20 coaching extension
    // never mutates the shared DB/BOOK entry. Opening lines coach to move 20
    // (40 plies); master games (result set) play only their own moves.
    const cloned: BookLine = { ...line, moves: [...line.moves] }
    this.activeMode = { kind: 'trainer', line: cloned, ply: 0, hints, target: line.result ? 0 : 40, bookLen: cloned.moves.length }
    this.humanColor = line.you
    this.orientation = this.humanColor === 'w' ? 'white' : 'black'
    this.game.reset()
    this.engine.newGame()
    this.selected = null
    this.lastMove = null
    this.hintSquares = null
    this.thinking = false
    this.setEval(0, null)
    this.clearNote()
    this.renderSquares()
    this.renderAll()
    this.slots[set].hintDisabled = false
    const role = line.result
      ? `play <b>${line.you === 'w' ? line.white : line.black}</b>'s moves`
      : `train as ${this.humanColor === 'w' ? 'White' : 'Black'}`
    this.setTrStatus('info', `${line.result ? 'Play through: ' : 'Training '}<b>${this.trLineLabel()}</b> — ${role}.`)
    this.maybeBookMove()
  }

  private exitTrainer() {
    if (this.activeMode.kind === 'trainer') this.activeMode = { kind: 'idle' }
    this.hintSquares = null
    this.slots.train.hintDisabled = true
    this.slots.games.hintDisabled = true
    this.slots.train.statusHtml = ''
    this.slots.games.statusHtml = ''
    this.clearNote()
    this.renderHighlights()
    this.emit()
  }

  /* -------------------------- replay -------------------------- */
  startReplay(idx: number, set: SetKey) {
    this.epoch++
    this.exitReview()
    this.stopSelfPlay()
    this.exitTrainer()
    this.sessionKey = set
    this.activeMode = { kind: 'replay', line: BOOK[idx], idx: 0, timer: null }
    this.humanColor = this.activeMode.line.you
    this.orientation = this.humanColor === 'w' ? 'white' : 'black'
    this.game.reset()
    this.engine.newGame()
    this.selected = null
    this.lastMove = null
    this.hintSquares = null
    this.thinking = false
    this.setEval(0, null)
    this.clearNote()
    this.renderSquares()
    this.renderAll()
    this.replayStep()
  }
  private replayStep() {
    if (this.activeMode.kind !== 'replay') return
    const line = this.activeMode.line
    if (this.activeMode.idx >= line.moves.length) {
      this.stopReplay()
      return
    }
    const san = line.moves[this.activeMode.idx]
    const sq = this.squaresForSan(san)
    const mv = sq ? this.game.move({ from: sq.from, to: sq.to, promotion: sq.promotion }) : this.game.move(san)
    if (!mv) {
      this.stopReplay()
      return
    }
    const i = this.activeMode.idx++
    const hasNote = line.notes && line.notes[i]
    if (hasNote) this.showNoteFor(i)
    const moveNo = Math.floor(i / 2) + 1
    this.setTrStatus('info', `<span class="path">${line.variation} · ${moveNo}${i % 2 ? '…' : '.'}${mv.san}</span>`)
    this.lastMove = { from: mv.from, to: mv.to }
    this.selected = null
    this.elDots.innerHTML = ''
    this.animateThen(mv.from, mv.to, () => {
      this.renderAll()
      if (this.activeMode.kind !== 'replay') return
      if (this.game.isGameOver() || this.activeMode.idx >= line.moves.length) {
        this.stopReplay()
        return
      }
      this.activeMode.timer = setTimeout(() => this.replayStep(), hasNote ? 1800 : 620)
    })
  }
  private stopReplay() {
    if (this.activeMode.kind !== 'replay') return
    const replayMode = this.activeMode
    const line = replayMode.line
    this.epoch++
    if (replayMode.timer) clearTimeout(replayMode.timer)
    this.activeMode = { kind: 'idle' }
    if (line && line.result && (this.game.isGameOver() || replayMode.idx >= line.moves.length)) {
      this.setTrStatus('good', `${line.white} vs ${line.black}, ${line.result}.`)
    }
    this.renderAll()
  }

  /* -------------------------- self-play -------------------------- */
  finishGame() {
    if (this.activeMode.kind === 'selfPlay') this.stopSelfPlay()
    else this.startSelfPlay()
  }
  watchFullGame() {
    this.epoch++
    this.exitReview()
    this.stopSelfPlay()
    this.exitTrainer()
    this.game.reset()
    this.engine.newGame()
    this.selected = null
    this.lastMove = null
    this.hintSquares = null
    this.setEval(0, null)
    this.renderSquares()
    this.renderAll()
    this.startSelfPlay()
  }
  private startSelfPlay() {
    this.epoch++
    this.stopReplay()
    this.exitTrainer()
    this.activeMode = { kind: 'selfPlay' }
    this.renderPieces()
    this.emit()
    if (!this.game.isGameOver()) this.engineMove()
  }
  private stopSelfPlay() {
    this.epoch++
    if (this.activeMode.kind === 'selfPlay') this.activeMode = { kind: 'idle' }
    this.engineExpected = false
    this.engine.stop()
    this.thinking = false
    this.renderAll()
  }
  watchLineOut(idx: number) {
    const l = BOOK[idx]
    this.watchMovesOut(l.moves, l.you)
  }

  // Play an arbitrary move list out with the engine (Opening Explorer "Watch").
  watchMovesOut(moves: string[], you: 'w' | 'b') {
    this.epoch++
    this.exitReview()
    this.stopSelfPlay()
    this.stopReplay()
    this.exitTrainer()
    this.game.reset()
    this.engine.newGame()
    for (const san of moves) {
      try {
        if (!this.game.move(san)) break
      } catch (e) {
        break
      }
    }
    const h = this.game.history({ verbose: true }) as Move[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.orientation = you === 'w' ? 'white' : 'black'
    this.selected = null
    this.hintSquares = null
    this.renderSquares()
    this.renderAll()
    this.startSelfPlay()
  }

  // Load a line onto the board (no engine) so it can be stepped with the
  // scrubber. Used when a user selects an opening in the Explorer.
  previewLine(moves: string[], you: 'w' | 'b') {
    this.epoch++
    this.exitReview()
    this.stopSelfPlay()
    this.stopReplay()
    this.exitTrainer()
    this.humanColor = you
    this.orientation = you === 'w' ? 'white' : 'black'
    this.game.reset()
    this.engine.newGame()
    for (const san of moves) {
      try {
        if (!this.game.move(san)) break
      } catch (e) {
        break
      }
    }
    const h = this.game.history({ verbose: true }) as Move[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.selected = null
    this.hintSquares = null
    this.thinking = false
    this.setEval(0, null)
    this.renderSquares()
    this.renderAll()
  }

  togglePlayback(idx: number, set: SetKey) {
    if (this.activeMode.kind === 'selfPlay') {
      this.stopSelfPlay()
      return
    }
    if (this.activeMode.kind === 'replay') {
      this.stopReplay()
      return
    }
    this.sessionKey = set
    if (BOOK[idx].result) this.startReplay(idx, set)
    else this.watchLineOut(idx)
  }

  // "Play book/game move" button.
  playBookMove(set: SetKey) {
    if (this.activeMode.kind !== 'trainer' || this.sessionKey !== set || this.thinking || this.animating) return
    if (this.game.turn() !== this.humanColor) return
    const san = this.activeMode.line.moves[this.activeMode.ply]
    const sq = this.squaresForSan(san)
    if (!sq) return
    const mv = this.game.move({ from: sq.from, to: sq.to, promotion: sq.promotion })
    if (!mv) return
    this.activeMode.ply++
    this.hintSquares = null
    this.setTrStatus('good', '• ' + mv.san + (this.activeMode.line.result ? '' : ' — book.'))
    this.showNoteFor(this.activeMode.ply - 1)
    this.applyMove(mv)
  }

  setHints(set: SetKey, checked: boolean) {
    if (this.activeMode.kind !== 'trainer' || this.sessionKey !== set) return
    this.activeMode.hints = checked
    this.hintSquares =
      checked && this.game.turn() === this.humanColor && this.activeMode.ply < this.activeMode.line.moves.length
        ? this.squaresForSan(this.activeMode.line.moves[this.activeMode.ply])
        : null
    this.renderHighlights()
  }

  /* -------------------------- analysis -------------------------- */
  private collectAnalysis(line: string) {
    if (!this.analysisOverlay) return
    const mpv = line.match(/multipv (\d+)/)
    const sc = line.match(/score (cp|mate) (-?\d+)/)
    const dep = line.match(/ depth (\d+)/)
    const pvm = line.match(/ pv (.+)$/)
    if (!sc || !pvm) return
    const idx = mpv ? parseInt(mpv[1], 10) : 1
    this.analysisOverlay.data[idx] = {
      depth: dep ? parseInt(dep[1], 10) : 0,
      kind: sc[1],
      val: parseInt(sc[2], 10),
      pv: pvm[1].trim().split(/\s+/),
    }
  }
  analyze() {
    if (
      this.activeMode.kind === 'selfPlay' ||
      this.activeMode.kind === 'replay' ||
      this.thinking ||
      this.animating ||
      this.pos().isGameOver()
    ) return
    this.beginAnalysis(this.pos().fen())
  }
  // Run a MultiPV analysis on an arbitrary position (used by Analyze and Explore).
  private beginAnalysis(fen: string) {
    if (this.analysisOverlay) this.engine.stop()
    this.analysisOverlay = { data: {}, fen }
    this.emit()
    this.engine.whenReady().then(() => {
      if (!this.analysisOverlay || this.analysisOverlay.fen !== fen) return
      this.engine.setStrength('max')
      this.engine.setMultiPV(3)
      this.engine.go(fen, Math.max(1200, this.moveTime))
    })
  }
  private finishAnalysis() {
    const overlay = this.analysisOverlay
    this.analysisOverlay = null
    this.engine.setMultiPV(1)
    this.renderAnalysis(overlay)
  }
  private renderAnalysis(overlay: AnalysisOverlay | null) {
    if (!overlay) return
    const keys = Object.keys(overlay.data).map(Number).sort((a, b) => a - b)
    if (!keys.length) {
      this.clearAnalysis()
      return
    }
    const sideW = overlay.fen.split(' ')[1] === 'w'
    const lines: AnalysisLine[] = []
    for (const k of keys) {
      const d = overlay.data[k]
      let ev: string
      if (d.kind === 'mate') {
        const m = sideW ? d.val : -d.val
        ev = '#' + (m >= 0 ? '' : '-') + Math.abs(m)
      } else {
        const cp = (sideW ? d.val : -d.val) / 100
        ev = (cp >= 0 ? '+' : '') + cp.toFixed(2)
      }
      const tmp = new Chess(overlay.fen)
      const sans: string[] = []
      for (const uci of d.pv.slice(0, 6)) {
        const mv = tmp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined })
        if (!mv) break
        sans.push(mv.san)
      }
      lines.push({ ev, pv: this.sanLine(overlay.fen, sans), best: k === 1 })
    }
    this.analysis = lines
    this.emit()
  }
  private sanLine(fen: string, sans: string[]) {
    const parts = fen.split(' ')
    let n = parseInt(parts[5], 10) || 1
    let white = parts[1] === 'w'
    let out = ''
    for (let i = 0; i < sans.length; i++) {
      if (white) out += n + '.'
      else if (i === 0) out += n + '…'
      out += sans[i] + ' '
      if (!white) n++
      white = !white
    }
    return out.trim()
  }
  private clearAnalysis() {
    this.analysis = null
    this.emit()
  }

  /* -------------------------- game review -------------------------- */
  // Analyse each position once, then derive per-move accuracy and the stronger
  // move, and narrate any known opening / master game the game followed.
  private evalPosition(fen: string, movetime: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.activeMode.kind === 'review') {
        this.activeMode = { ...this.activeMode, collect: { cp: 0, mate: null, pv: [], bestUci: '' }, resolve }
      }
      this.engine.whenReady().then(() => {
        this.engine.setStrength('max')
        this.engine.setMultiPV(1)
        this.engine.go(fen, movetime)
      })
    })
  }

  private static scoreVal(cp: number, mate: number | null): number {
    if (mate !== null) return mate > 0 ? 100000 - mate * 100 : -100000 - mate * 100
    return cp
  }

  private static uciToSan(fen: string, uci: string): string | null {
    try {
      const t = new Chess(fen)
      const mv = t.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined })
      return mv ? mv.san : null
    } catch (e) {
      return null
    }
  }

  private static uciPvToSan(fen: string, pv: string[], max = 5): string {
    const t = new Chess(fen)
    const sans: string[] = []
    for (const uci of pv.slice(0, max)) {
      const mv = t.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined })
      if (!mv) break
      sans.push(mv.san)
    }
    // number them from the pv's starting position
    const parts = fen.split(' ')
    let n = parseInt(parts[5], 10) || 1
    let white = parts[1] === 'w'
    let out = ''
    for (let i = 0; i < sans.length; i++) {
      if (white) out += n + '.'
      else if (i === 0) out += n + '…'
      out += sans[i] + ' '
      if (!white) n++
      white = !white
    }
    return out.trim()
  }

  async reviewGame(movetime = 400) {
    if (
      this.activeMode.kind === 'selfPlay' ||
      this.activeMode.kind === 'replay' ||
      (this.activeMode.kind === 'review' && this.activeMode.collect !== null)
    ) return
    const sans = this.game.history()
    if (!sans.length) return
    // Reconstruct every position (FEN) the game passed through.
    const walker = new Chess()
    const fens: string[] = [walker.fen()]
    for (const san of sans) {
      walker.move(san)
      fens.push(walker.fen())
    }

    this.epoch++
    const myEpoch = this.epoch
    this.activeMode = {
      kind: 'review',
      collect: null,
      resolve: null,
    }
    this.thinking = false
    this.engine.stop()
    const story = this.computeStory(sans)
    this.review = { running: true, done: false, progress: `Reviewing… 0/${sans.length}`, items: [], story }
    this.emit()

    // Analyse each position once → score (side-to-move) + best move.
    const scores: number[] = []
    const bestUci: string[] = []
    const bestPvSan: string[] = []
    for (let i = 0; i < fens.length; i++) {
      if (myEpoch !== this.epoch) {
        return
      }
      // Follow along on the board so the review feels alive.
      this.viewGame = new Chess(fens[i])
      this.reviewPly = i - 1 >= 0 ? i - 1 : null
      const h = new Chess()
      let last: { from: string; to: string } | null = null
      for (let k = 0; k < i; k++) {
        const mv = h.move(sans[k])
        if (k === i - 1 && mv) last = { from: mv.from, to: mv.to }
      }
      this.lastMove = last
      this.renderPieces()
      this.renderHighlights()

      await this.evalPosition(fens[i], movetime)
      if (this.activeMode.kind !== 'review' || !this.activeMode.collect) return
      const c = this.activeMode.collect
      scores[i] = ChessController.scoreVal(c.cp, c.mate)
      bestUci[i] = c.bestUci
      bestPvSan[i] = ChessController.uciPvToSan(fens[i], c.pv)
      this.review = { ...this.review!, progress: `Reviewing… ${Math.min(i + 1, sans.length)}/${sans.length}` }
      this.emit()
    }

    // Derive per-move labels.
    const items: ReviewItem[] = []
    for (let i = 0; i < sans.length; i++) {
      const turn: 'w' | 'b' = fens[i].split(' ')[1] === 'w' ? 'w' : 'b'
      const bestScore = scores[i]
      const playedScore = -scores[i + 1]
      const loss = Math.max(0, bestScore - playedScore)
      const playedBest = !!bestUci[i] && this.movesEqual(fens[i], sans[i], bestUci[i])
      const label = playedBest ? 'Best' : classify(loss)
      // eval after the move, White's perspective
      const afterStm = scores[i + 1]
      const afterTurn: 'w' | 'b' = fens[i + 1].split(' ')[1] === 'w' ? 'w' : 'b'
      const white = afterTurn === 'w' ? afterStm : -afterStm
      const evalWhite = this.fmtScore(white)
      const betterSan = label === 'Best' ? null : ChessController.uciToSan(fens[i], bestUci[i])
      let from = ''
      let to = ''
      try {
        const seg = new Chess(fens[i])
        const mo = seg.move(sans[i])
        if (mo) {
          from = mo.from
          to = mo.to
        }
      } catch (e) {}
      items.push({
        ply: i,
        moveNo: Math.floor(i / 2) + 1,
        side: turn,
        san: sans[i],
        from,
        to,
        label,
        lossCp: label === 'Best' ? null : Math.round(loss),
        betterSan,
        betterPv: label === 'Best' ? null : bestPvSan[i] || null,
        evalWhite,
        isYou: turn === this.humanColor,
      })
    }

    if (this.activeMode.kind === 'review') this.activeMode = { kind: 'idle' }
    this.viewGame = null
    this.reviewPly = null
    // The grade badge reads `review.done`, so the result has to be in place
    // before the board is repainted or the badge misses its own render.
    this.review = { running: false, done: true, progress: '', items, story }
    this.renderPieces()
    this.renderHighlights()
    this.emit()
  }

  private fmtScore(whiteCp: number): string {
    if (Math.abs(whiteCp) >= 90000) {
      const mate = Math.round((100000 - Math.abs(whiteCp)) / 100)
      return (whiteCp > 0 ? '#' : '#-') + Math.max(1, mate)
    }
    const v = whiteCp / 100
    return (v >= 0 ? '+' : '') + v.toFixed(1)
  }

  private movesEqual(fen: string, san: string, uci: string): boolean {
    const s = ChessController.uciToSan(fen, uci)
    return !!s && sanEq(s, san)
  }

  private computeStory(sans: string[]): StoryLine[] {
    const prefixLen = (moves: string[]) => {
      let n = 0
      const max = Math.min(moves.length, sans.length)
      while (n < max && sanEq(moves[n], sans[n])) n++
      return n
    }
    const out: StoryLine[] = []

    // Best-matching opening (non-game book line).
    let bestOpen = -1
    let bestOpenLen = 0
    let bestGame = -1
    let bestGameLen = 0
    for (let i = 0; i < BOOK.length; i++) {
      const len = prefixLen(BOOK[i].moves)
      if (BOOK[i].game) {
        if (len > bestGameLen) {
          bestGameLen = len
          bestGame = i
        }
      } else if (len > bestOpenLen) {
        bestOpenLen = len
        bestOpen = i
      }
    }

    if (bestOpen >= 0 && bestOpenLen >= 4) {
      const l = BOOK[bestOpen]
      const moveNo = Math.ceil(bestOpenLen / 2)
      const cont = l.moves.slice(bestOpenLen, bestOpenLen + 4).join(' ')
      let text = `You followed the ${l.opening} — ${l.variation} for the first ${moveNo} move${moveNo > 1 ? 's' : ''}.`
      if (l.idea) text += ` ${l.idea}`
      if (bestOpenLen < l.moves.length && cont) text += ` The book continues ${cont}.`
      out.push({ kind: 'opening', title: `${l.opening} — ${l.variation}`, text })
    }

    if (bestGame >= 0 && bestGameLen >= 4) {
      const l = BOOK[bestGame]
      const moveNo = Math.ceil(bestGameLen / 2)
      let text = `Your game tracked ${l.variation} (${l.white} vs ${l.black}, ${l.result}) through move ${moveNo}.`
      if (bestGameLen >= l.moves.length) {
        text += ` You reproduced the entire game.`
      } else {
        const theirs = l.moves[bestGameLen]
        const mover = bestGameLen % 2 === 0 ? l.white : l.black
        text += ` There ${mover} played ${stripSan(theirs)}`
        const note = l.notes && l.notes[bestGameLen]
        if (note) text += ` — ${note}`
        else text += `, and the game went on to finish ${l.result}.`
      }
      out.push({ kind: 'master', title: l.variation, text })
    }

    return out
  }

  gotoPly(ply: number) {
    // Show the position AFTER the given ply (0-indexed) without touching the live game.
    const sans = this.game.history()
    const t = new Chess()
    let last: { from: string; to: string } | null = null
    for (let k = 0; k <= ply && k < sans.length; k++) {
      const mv = t.move(sans[k])
      if (k === ply && mv) last = { from: mv.from, to: mv.to }
    }
    this.viewGame = t
    this.reviewPly = ply
    this.selected = null
    this.lastMove = last
    this.renderPieces()
    this.renderHighlights()
    this.emit()
  }

  resumeGame() {
    this.viewGame = null
    this.reviewPly = null
    this.selected = null
    const h = this.game.history({ verbose: true }) as Move[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.renderAll()
  }

  clearReview() {
    this.review = null
    this.resumeGame()
  }

  /* -------------------------- explore (analysis board) -------------------------- */
  // Start a free analysis board from the position currently being viewed. You can
  // play any legal moves for either side; the engine analyses each new position.
  startExplore() {
    const reviewPly = this.reviewPly
    if (
      this.activeMode.kind === 'selfPlay' ||
      this.activeMode.kind === 'replay' ||
      (this.activeMode.kind === 'review' && this.activeMode.collect !== null)
    ) return
    const sans = this.game.history()
    const vp = reviewPly === null ? sans.length - 1 : reviewPly
    const g = new Chess()
    let last: { from: string; to: string } | null = null
    for (let k = 0; k <= vp && k < sans.length; k++) {
      const mv = g.move(sans[k])
      if (k === vp && mv) last = { from: mv.from, to: mv.to }
    }
    this.activeMode = { kind: 'explore', game: g, moves: [], startPly: vp }
    this.selected = null
    this.hintSquares = null
    this.lastMove = last
    this.renderSquares()
    this.renderAll()
    this.beginAnalysis(g.fen())
  }

  private tryExploreMove(from: string, to: string, promo?: string): boolean | 'promo' {
    if (this.activeMode.kind !== 'explore') return false
    const g = this.activeMode.game
    const legal = (g.moves({ square: from as Square, verbose: true }) as Move[]).filter((m) => m.to === to)
    if (!legal.length) return false
    if (legal.some((m) => m.promotion) && !promo) {
      this.askPromotion(from, to, g.turn())
      return 'promo'
    }
    const mv = g.move({ from, to, promotion: promo || 'q' })
    if (!mv) return false
    this.activeMode.moves.push(mv.san)
    this.lastMove = { from: mv.from, to: mv.to }
    this.selected = null
    this.elDots.innerHTML = ''
    const myEpoch = this.epoch
    this.animateThen(mv.from, mv.to, () => {
      if (myEpoch !== this.epoch) {
        this.renderAll()
        return
      }
      this.renderAll()
      if (!g.isGameOver()) this.beginAnalysis(g.fen())
      else this.emit()
    })
    return true
  }

  exploreUndo() {
    if (this.activeMode.kind !== 'explore' || !this.activeMode.moves.length) return
    this.activeMode.game.undo()
    this.activeMode.moves.pop()
    const h = this.activeMode.game.history({ verbose: true }) as Move[]
    this.lastMove = h.length
      ? { from: h[h.length - 1].from, to: h[h.length - 1].to }
      : this.startLastMove(this.activeMode.startPly)
    this.selected = null
    this.renderAll()
    if (!this.activeMode.game.isGameOver()) this.beginAnalysis(this.activeMode.game.fen())
  }

  // Last-move highlight for the reviewed position an explore session started from.
  private startLastMove(vp: number): { from: string; to: string } | null {
    const sans = this.game.history()
    if (vp < 0 || !sans.length) return null
    const t = new Chess()
    let last: { from: string; to: string } | null = null
    for (let k = 0; k <= vp && k < sans.length; k++) {
      const mv = t.move(sans[k])
      if (k === vp && mv) last = { from: mv.from, to: mv.to }
    }
    return last
  }

  exitExplore() {
    if (this.activeMode.kind !== 'explore') return
    const startPly = this.activeMode.startPly
    this.activeMode = { kind: 'idle' }
    this.analysisOverlay = null
    this.analysis = null
    this.engine.stop()
    if (this.game.history().length) this.gotoPly(startPly)
    else this.resumeGame()
  }

  /* -------------------------- move navigation (scrubber) -------------------------- */
  // Step through the current game without disturbing it. reviewPly is the viewed
  // ply (null = live, showing the latest position).
  private canBrowse() {
    return (
      this.activeMode.kind !== 'selfPlay' &&
      this.activeMode.kind !== 'replay' &&
      !this.thinking &&
      !this.animating &&
      this.activeMode.kind !== 'explore' &&
      this.game.history().length > 0
    )
  }
  private viewedPly() {
    const total = this.game.history().length
    return this.reviewPly === null ? total - 1 : this.reviewPly
  }
  navFirst() {
    if (!this.canBrowse()) return
    this.gotoPly(-1)
  }
  navPrev() {
    if (!this.canBrowse()) return
    this.gotoPly(Math.max(-1, this.viewedPly() - 1))
  }
  navNext() {
    if (!this.canBrowse()) return
    const total = this.game.history().length
    const t = this.viewedPly() + 1
    if (t >= total - 1) this.resumeGame()
    else this.gotoPly(t)
  }
  navLast() {
    if (!this.canBrowse()) return
    this.resumeGame()
  }

  // Drop any review view/state (called when switching game modes).
  private exitReview() {
    this.review = null
    this.annotation = null
    this.viewGame = null
    this.reviewPly = null
    if (this.activeMode.kind === 'review' || this.activeMode.kind === 'explore') this.activeMode = { kind: 'idle' }
  }

  /* -------------------------- opening annotation (best moves to move N) -------------------------- */
  // Take a known opening line, extend it with the engine's best play to a target
  // depth, and annotate every move: eval (White's view), where the book move
  // differs from the engine's pick, and where theory ends. Reuses the one-shot
  // eval plumbing (reviewing flag routes engine output to reviewCollect).
  async annotateOpening(bookMoves: string[], you: 'w' | 'b', targetPlies = 40, movetime = 350) {
    if (
      this.activeMode.kind === 'selfPlay' ||
      this.activeMode.kind === 'replay' ||
      (this.activeMode.kind === 'review' && this.activeMode.collect !== null)
    ) return
    this.exitTrainer()
    this.stopSelfPlay()
    this.stopReplay()
    this.epoch++
    const myEpoch = this.epoch
    this.activeMode = {
      kind: 'review',
      collect: null,
      resolve: null,
    }
    this.humanColor = you
    this.orientation = you === 'w' ? 'white' : 'black'
    this.annotation = { running: true, done: false, progress: 'Analysing the line…', moves: [] }
    this.emit()

    const walker = new Chess()
    const validBook: string[] = []
    for (const m of bookMoves) {
      try {
        if (walker.move(m)) validBook.push(m)
        else break
      } catch (e) {
        break
      }
    }
    walker.reset()

    const fens: string[] = [walker.fen()]
    const sans: string[] = []
    const scores: number[] = []
    const bests: string[] = []
    const isBook: boolean[] = []

    let ply = 0
    while (ply < targetPlies) {
      if (myEpoch !== this.epoch) {
        return
      }
      const fen = walker.fen()
      // Follow along on the board.
      this.viewGame = new Chess(fen)
      this.reviewPly = ply - 1 >= 0 ? ply - 1 : null
      const h = walker.history({ verbose: true }) as Move[]
      this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
      this.renderPieces()
      this.renderHighlights()

      await this.evalPosition(fen, movetime)
      if (this.activeMode.kind !== 'review' || !this.activeMode.collect) return
      const c = this.activeMode.collect
      scores[ply] = ChessController.scoreVal(c.cp, c.mate)
      bests[ply] = c.bestUci

      let mv: Move | null = null
      if (ply < validBook.length) {
        mv = walker.move(validBook[ply])
        isBook[ply] = true
      } else {
        if (walker.isGameOver()) break
        const b = c.bestUci
        if (!b || b === '(none)') break
        mv = walker.move({ from: b.slice(0, 2), to: b.slice(2, 4), promotion: b.length > 4 ? b[4] : undefined })
        isBook[ply] = false
      }
      if (!mv) break
      sans[ply] = mv.san
      ply++
      fens[ply] = walker.fen()
      this.annotation = { ...this.annotation!, progress: `Analysing… move ${Math.ceil(ply / 2)} of ${targetPlies / 2}` }
      this.emit()
    }

    // Score the final position so the last move's eval is available.
    if (myEpoch === this.epoch && !walker.isGameOver()) {
      await this.evalPosition(walker.fen(), movetime)
      if (this.activeMode.kind !== 'review' || !this.activeMode.collect) return
      scores[ply] = ChessController.scoreVal(this.activeMode.collect.cp, this.activeMode.collect.mate)
    }
    if (myEpoch !== this.epoch) {
      return
    }

    const items: AnnItem[] = []
    for (let i = 0; i < ply; i++) {
      const turn: 'w' | 'b' = fens[i].split(' ')[1] === 'w' ? 'w' : 'b'
      const afterTurn: 'w' | 'b' = fens[i + 1] && fens[i + 1].split(' ')[1] === 'w' ? 'w' : 'b'
      const afterStm = scores[i + 1] ?? -scores[i]
      const white = afterTurn === 'w' ? afterStm : -afterStm
      let betterSan: string | null = null
      if (isBook[i] && bests[i]) {
        const bs = ChessController.uciToSan(fens[i], bests[i])
        if (bs && !sanEq(bs, sans[i])) betterSan = bs
      }
      items.push({
        ply: i,
        moveNo: Math.floor(i / 2) + 1,
        side: turn,
        san: sans[i],
        evalWhite: this.fmtScore(white),
        isBook: isBook[i],
        betterSan,
        theoryEnd: i === validBook.length && validBook.length > 0 && validBook.length < ply,
      })
    }

    // Load the full annotated line so the scrubber can walk it.
    if (this.activeMode.kind === 'review') this.activeMode = { kind: 'idle' }
    this.viewGame = null
    this.reviewPly = null
    this.game.reset()
    this.engine.newGame()
    for (const s of sans) {
      try {
        if (!this.game.move(s)) break
      } catch (e) {
        break
      }
    }
    const hh = this.game.history({ verbose: true }) as Move[]
    this.lastMove = hh.length ? { from: hh[hh.length - 1].from, to: hh[hh.length - 1].to } : null
    this.setEval(0, null)
    this.annotation = { running: false, done: true, progress: '', moves: items }
    this.renderSquares()
    this.renderAll()
  }

  clearAnnotation() {
    this.annotation = null
    this.resumeGame()
  }

  /* -------------------------- PGN -------------------------- */
  getPGN(): string | null {
    if (this.game.history().length === 0) return null
    return buildPGN(this.game.history({ verbose: true }) as Move[], {
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      white: this.humanColor === 'w' ? 'Player' : 'Stockfish 18',
      black: this.humanColor === 'w' ? 'Stockfish 18' : 'Player',
    })
  }

  /* -------------------------- promotion -------------------------- */
  private askPromotion(from: string, to: string, color: string) {
    this.pendingPromo = { from, to }
    this.onPromo(from, to, color)
  }
  finishPromotion(piece: string) {
    const p = this.pendingPromo
    this.pendingPromo = null
    if (p) this.tryHumanMove(p.from, p.to, piece)
  }
  cancelPromotion() {
    this.pendingPromo = null
    this.renderAll()
  }

  /* -------------------------- controls -------------------------- */
  private currentElo(): number | 'max' {
    const v = this.eloSlider
    return v >= 20 ? 'max' : Math.round(1320 + ((3000 - 1320) * v) / 19)
  }
  setEloSlider(v: number) {
    this.eloSlider = v
  }
  eloLabel(v: number): string {
    return v >= 20 ? 'Max' : String(Math.round(1320 + ((3000 - 1320) * v) / 19))
  }
  setThinkTime(ms: number) {
    this.moveTime = ms
  }

  flip() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white'
    this.renderSquares()
    this.renderAll()
  }

  undo() {
    if (
      this.thinking ||
      this.animating ||
      this.activeMode.kind === 'selfPlay' ||
      this.activeMode.kind === 'replay'
    ) return
    this.epoch++
    this.exitReview()
    if (this.game.history().length === 0) return
    this.game.undo()
    if (this.game.turn() !== this.humanColor && this.game.history().length > 0) this.game.undo()
    const h = this.game.history({ verbose: true }) as Move[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.selected = null
    this.hintSquares = null
    this.thinking = false
    if (this.activeMode.kind === 'trainer') {
      this.activeMode.ply = h.length
      this.renderSquares()
      this.renderAll()
      this.maybeBookMove()
      return
    }
    this.renderSquares()
    this.renderAll()
    if (!this.game.isGameOver() && this.game.turn() !== this.humanColor) this.engineMove()
  }

  newGame(sideChoice: 'white' | 'black' | 'random') {
    this.epoch++
    this.exitReview()
    if (this.activeMode.kind === 'selfPlay') this.activeMode = { kind: 'idle' }
    this.engineExpected = false
    this.engine.stop()
    this.stopReplay()
    this.exitTrainer()
    this.humanColor =
      sideChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : sideChoice === 'white' ? 'w' : 'b'
    this.orientation = this.humanColor === 'w' ? 'white' : 'black'
    this.game.reset()
    this.engine.newGame()
    this.selected = null
    this.lastMove = null
    this.hintSquares = null
    this.thinking = false
    this.setEval(0, null)
    this.renderSquares()
    this.renderAll()
    if (this.game.turn() !== this.humanColor) this.engineMove()
  }

  /* -------------------------- pointer input -------------------------- */
  private boardRect() {
    return this.root.getBoundingClientRect()
  }
  private canMoveNow() {
    if (this.activeMode.kind === 'explore') return !this.animating && !this.activeMode.game.isGameOver()
    return (
      !this.thinking &&
      !this.animating &&
      this.activeMode.kind !== 'selfPlay' &&
      this.activeMode.kind !== 'replay' &&
      !this.analysisOverlay &&
      this.activeMode.kind !== 'review' &&
      !this.game.isGameOver() &&
      this.game.turn() === this.humanColor
    )
  }
  private attachPointer() {
    this.elPieces.addEventListener('pointerdown', (e) => {
      const pc = (e.target as HTMLElement).closest('.piece') as HTMLElement | null
      const rect = this.boardRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const sq = this.xyToSquare(px, py)

      const mover = this.mover()
      const g = this.activeGame()
      if (this.selected && (!pc || pc.dataset.color !== mover || g.get(sq as Square)?.color !== mover)) {
        if (this.canMoveNow() && this.tryHumanMove(this.selected, sq)) return
      }

      if (!pc || !this.canMoveNow()) {
        this.selected = null
        this.renderHighlights()
        this.renderDots()
        this.emit()
        return
      }
      if (pc.dataset.color !== mover) {
        this.selected = null
        this.renderHighlights()
        this.renderDots()
        this.emit()
        return
      }

      const from = pc.dataset.square!
      if (this.selected === from) {
        this.selected = null
        this.renderHighlights()
        this.renderDots()
        this.emit()
        return
      }
      this.selected = from
      this.renderHighlights()
      this.renderDots()
      this.emit()

      const pr = pc.getBoundingClientRect()
      this.drag = {
        el: pc,
        from,
        offsetX: e.clientX - (pr.left + pr.width / 2),
        offsetY: e.clientY - (pr.top + pr.height / 2),
        moved: false,
      }
      pc.setPointerCapture(e.pointerId)
      pc.classList.add('drag')
    })

    this.elPieces.addEventListener('pointermove', (e) => {
      if (!this.drag) return
      this.drag.moved = true
      const rect = this.boardRect()
      const x = e.clientX - this.drag.offsetX - rect.left
      const y = e.clientY - this.drag.offsetY - rect.top
      this.translate(this.drag.el, (x / rect.width) * 100 - 6.25, (y / rect.height) * 100 - 6.25)
    })

    this.elPieces.addEventListener('pointerup', (e) => {
      if (!this.drag) return
      const d = this.drag
      this.drag = null
      d.el.classList.remove('drag')
      const rect = this.boardRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const to = this.xyToSquare(px, py)

      if (d.moved && to !== d.from) {
        const r = this.tryHumanMove(d.from, to)
        if (r === true || r === 'promo') return
      }
      this.placePiece(d.el, d.from)
    })
  }
}
