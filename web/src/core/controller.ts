import { Chess } from 'chess.js'
import { createEngine, type Engine } from './engine'
import { pieceSVG } from './pieces'
import { BOOK, type BookLine } from './book'

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

export type MoveLabel = 'Best' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'

export interface ReviewItem {
  ply: number
  moveNo: number
  side: 'w' | 'b'
  san: string
  label: MoveLabel
  lossCp: number | null
  betterSan: string | null
  betterPv: string | null
  evalWhite: string
  isYou: boolean
}

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

  private orientation: 'white' | 'black' = 'white'
  private humanColor: 'w' | 'b' = 'w'
  private thinking = false
  private selected: string | null = null
  private lastMove: { from: string; to: string } | null = null
  private moveTime = 1000
  private animating = false
  private trainer: { line: BookLine; ply: number; hints: boolean; target: number; bookLen: number } | null = null
  private hintSquares: { from: string; to: string } | null = null
  private selfPlay = false
  private engineExpected = false
  private analyzing = false
  private analysisData: Record<number, { depth: number; kind: string; val: number; pv: string[] }> = {}
  private analysisFen = ''
  private replaying = false
  private replayLine: BookLine | null = null
  private replayIdx = 0
  private replayTimer: ReturnType<typeof setTimeout> | null = null
  private epoch = 0
  private eloSlider = 4
  private pendingPromo: { from: string; to: string } | null = null

  // Panel-facing state emitted in the snapshot.
  private engineTag = 'loading engine…'
  private evalFrac = 0.5
  private evalLabel = '0.0'
  private analysis: AnalysisLine[] | null = null
  private review: ReviewState | null = null
  private annotation: AnnotationState | null = null
  private reviewing = false
  private reviewCollect: { cp: number; mate: number | null; pv: string[]; bestUci: string } | null = null
  private reviewResolve: (() => void) | null = null
  private reviewPly: number | null = null
  private viewGame: Chess | null = null
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
    } else if (this.selfPlay) {
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
      analyzing: this.analyzing,
      selfPlay: this.selfPlay,
      replaying: this.replaying,
      sessionKey: this.sessionKey,
      train: { ...this.slots.train },
      games: { ...this.slots.games },
      review: this.review,
      reviewPly: this.reviewPly,
      annotation: this.annotation,
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
    return this.viewGame || this.game
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
        const { left, top } = this.squareXY(cell.square)
        el.style.left = left + '%'
        el.style.top = top + '%'
        el.innerHTML = pieceSVG(cell.type, cell.color)
        if (
          !this.viewGame &&
          cell.color === this.game.turn() &&
          cell.color === this.humanColor &&
          !this.thinking &&
          !this.game.isGameOver()
        ) {
          el.classList.add('mine')
        }
        this.elPieces.appendChild(el)
      }
    }
  }

  private renderHighlights() {
    this.elHl.innerHTML = ''
    const add = (sq: string, cls: string) => {
      const { left, top } = this.squareXY(sq)
      const d = document.createElement('div')
      d.className = 'hl ' + cls
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
  }

  private renderDots() {
    this.elDots.innerHTML = ''
    if (!this.selected) return
    const moves = this.game.moves({ square: this.selected as any, verbose: true }) as any[]
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
    const { left, top } = this.squareXY(toSq)
    requestAnimationFrame(() => {
      el.style.left = left + '%'
      el.style.top = top + '%'
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
      this.selfPlay = false
      if (this.trainer && this.trainer.line.result) {
        this.endOfBook()
        return
      }
      this.emit()
      return
    }
    if (this.selfPlay) {
      setTimeout(() => {
        if (this.selfPlay) this.engineMove()
      }, 350)
      return
    }
    if (this.trainer) {
      this.maybeBookMove()
      return
    }
    if (this.game.turn() !== this.humanColor) this.engineMove()
  }

  private tryHumanMove(from: string, to: string, promo?: string): boolean | 'promo' {
    const legal = (this.game.moves({ square: from as any, verbose: true }) as any[]).filter((m) => m.to === to)
    if (!legal.length) return false
    if (legal.some((m) => m.promotion) && !promo) {
      this.askPromotion(from, to, this.game.turn())
      return 'promo'
    }

    if (this.trainer) {
      const expected = this.trainer.line.moves[this.trainer.ply]
      const exp = this.squaresForSan(expected)
      const mv = this.game.move({ from, to, promotion: promo || 'q' })
      if (!mv) return false
      const match =
        exp && mv.from === exp.from && mv.to === exp.to && (exp.promotion || '') === (mv.promotion || '')
      if (match) {
        this.trainer.ply++
        this.hintSquares = null
        this.setTrStatus('good', '✓ ' + mv.san + (this.trainer.line.result ? '' : ' — book.'))
        this.showNoteFor(this.trainer.ply - 1)
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
    if (this.reviewing) {
      if (this.reviewCollect) this.reviewCollect.bestUci = uci
      const done = this.reviewResolve
      this.reviewResolve = null
      done && done()
      return
    }
    if (this.analyzing) {
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
      this.selfPlay = false
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
    if (this.reviewing) {
      if (this.reviewCollect) {
        const sc = line.match(/score (cp|mate) (-?\d+)/)
        const pvm = line.match(/ pv (.+)$/)
        if (sc) {
          if (sc[1] === 'cp') {
            this.reviewCollect.cp = parseInt(sc[2], 10)
            this.reviewCollect.mate = null
          } else {
            this.reviewCollect.mate = parseInt(sc[2], 10)
          }
        }
        if (pvm) this.reviewCollect.pv = pvm[1].trim().split(/\s+/)
      }
      return
    }
    if (this.analyzing) {
      this.collectAnalysis(line)
      return
    }
    if (this.thinking) this.parseInfo(line)
  }

  /* -------------------------- book / trainer -------------------------- */
  private squaresForSan(san: string): { from: string; to: string; promotion?: string } | null {
    for (const m of this.game.moves({ verbose: true }) as any[])
      if (sanEq(m.san, san)) return { from: m.from, to: m.to, promotion: m.promotion }
    try {
      const t = new Chess(this.game.fen())
      const m = t.move(san, { strict: false } as any)
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
    const line = this.trainer ? this.trainer.line : this.replayLine
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
    if (!this.trainer) return ''
    const l = this.trainer.line
    return l.game ? l.variation : `${l.opening} — ${l.variation}`
  }
  private trProgress() {
    if (!this.trainer) return ''
    const total = this.trainer.target ? this.trainer.target / 2 : Math.ceil(this.trainer.line.moves.length / 2)
    const done = Math.ceil(this.trainer.ply / 2)
    return `<span class="path">${this.trLineLabel()} · move ${done}/${total}<br>${
      this.trainer.line.moves.slice(0, this.trainer.ply).join(' ') || '—'
    }</span>`
  }

  private maybeBookMove() {
    if (!this.trainer) return
    this.slots[this.sessionKey].hintDisabled = false
    if (this.trainer.ply >= this.trainer.line.moves.length) {
      // Book ran out. For opening lines, keep coaching to move 20 by pulling the
      // engine's best move one at a time (suggested, never played out as a game).
      if (!this.trainer.line.result && this.trainer.ply < this.trainer.target && !this.game.isGameOver()) {
        this.extendCoach()
        return
      }
      this.endOfBook()
      return
    }
    if (this.game.turn() === this.humanColor) {
      const past = this.trainer.ply >= this.trainer.bookLen
      const prompt = this.trainer.line.result
        ? 'Your move — play the game move.'
        : past
          ? 'Your move — play the suggested best move.'
          : 'Your move — play the book move.'
      this.setTrStatus('info', prompt + this.trProgress())
      // Past known theory the best move is a suggestion, so always highlight it.
      this.hintSquares =
        this.trainer.hints || past ? this.squaresForSan(this.trainer.line.moves[this.trainer.ply]) : null
      this.renderHighlights()
      this.emit()
      return
    }
    const san = this.trainer.line.moves[this.trainer.ply]
    const sq = this.squaresForSan(san)
    const mv = sq ? this.game.move({ from: sq.from, to: sq.to, promotion: sq.promotion }) : this.game.move(san)
    if (!mv) {
      this.endOfBook()
      return
    }
    this.trainer.ply++
    this.showNoteFor(this.trainer.ply - 1)
    this.setTrStatus('info', this.trProgress())
    this.applyMove(mv)
  }

  private endOfBook() {
    const line = this.trainer!.line
    const total = Math.ceil(line.moves.length / 2)
    this.slots[this.sessionKey].hintDisabled = true
    this.hintSquares = null
    this.trainer = null
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
    if (!this.trainer) return
    const myEpoch = this.epoch
    this.setTrStatus('info', 'Finding the best move…' + this.trProgress())
    this.emit()
    const wasReviewing = this.reviewing
    this.reviewing = true
    await this.evalPosition(this.game.fen(), 350)
    this.reviewing = wasReviewing
    if (myEpoch !== this.epoch || !this.trainer) return // mode switched mid-think
    const b = this.reviewCollect?.bestUci
    const san = b && b !== '(none)' ? ChessController.uciToSan(this.game.fen(), b) : null
    if (!san) {
      this.endOfBook()
      return
    }
    this.trainer.line.moves.push(san)
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
    this.trainer = { line: cloned, ply: 0, hints, target: line.result ? 0 : 40, bookLen: cloned.moves.length }
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
    this.trainer = null
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
    this.replayLine = BOOK[idx]
    this.replayIdx = 0
    this.replaying = true
    this.humanColor = this.replayLine.you
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
    if (!this.replaying) return
    const line = this.replayLine!
    if (this.replayIdx >= line.moves.length) {
      this.stopReplay()
      return
    }
    const san = line.moves[this.replayIdx]
    const sq = this.squaresForSan(san)
    const mv = sq ? this.game.move({ from: sq.from, to: sq.to, promotion: sq.promotion }) : this.game.move(san)
    if (!mv) {
      this.stopReplay()
      return
    }
    const i = this.replayIdx++
    const hasNote = line.notes && line.notes[i]
    if (hasNote) this.showNoteFor(i)
    const moveNo = Math.floor(i / 2) + 1
    this.setTrStatus('info', `<span class="path">${line.variation} · ${moveNo}${i % 2 ? '…' : '.'}${mv.san}</span>`)
    this.lastMove = { from: mv.from, to: mv.to }
    this.selected = null
    this.elDots.innerHTML = ''
    this.animateThen(mv.from, mv.to, () => {
      this.renderAll()
      if (!this.replaying) return
      if (this.game.isGameOver() || this.replayIdx >= line.moves.length) {
        this.stopReplay()
        return
      }
      this.replayTimer = setTimeout(() => this.replayStep(), hasNote ? 1800 : 620)
    })
  }
  private stopReplay() {
    if (!this.replaying && !this.replayLine) return
    const line = this.replayLine
    this.epoch++
    this.replaying = false
    if (this.replayTimer) clearTimeout(this.replayTimer)
    this.replayTimer = null
    if (line && line.result && (this.game.isGameOver() || this.replayIdx >= line.moves.length)) {
      this.setTrStatus('good', `${line.white} vs ${line.black}, ${line.result}.`)
    }
    this.renderAll()
  }

  /* -------------------------- self-play -------------------------- */
  finishGame() {
    if (this.selfPlay) this.stopSelfPlay()
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
    this.selfPlay = true
    this.renderPieces()
    this.emit()
    if (!this.game.isGameOver()) this.engineMove()
  }
  private stopSelfPlay() {
    this.epoch++
    this.selfPlay = false
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
    const h = this.game.history({ verbose: true }) as any[]
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
    const h = this.game.history({ verbose: true }) as any[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.selected = null
    this.hintSquares = null
    this.thinking = false
    this.setEval(0, null)
    this.viewGame = null
    this.reviewPly = null
    this.renderSquares()
    this.renderAll()
  }

  // Watch button in a trainer/games set: replay a game, or play an opening out.
  watch(idx: number, set: SetKey) {
    if (this.selfPlay) {
      this.stopSelfPlay()
      return
    }
    if (this.replaying) {
      this.stopReplay()
      return
    }
    this.sessionKey = set
    if (BOOK[idx].result) this.startReplay(idx, set)
    else this.watchLineOut(idx)
  }

  // "Play book/game move" button.
  playBookMove(set: SetKey) {
    if (!this.trainer || this.sessionKey !== set || this.thinking || this.animating) return
    if (this.game.turn() !== this.humanColor) return
    const san = this.trainer.line.moves[this.trainer.ply]
    const sq = this.squaresForSan(san)
    if (!sq) return
    const mv = this.game.move({ from: sq.from, to: sq.to, promotion: sq.promotion })
    if (!mv) return
    this.trainer.ply++
    this.hintSquares = null
    this.setTrStatus('good', '▸ ' + mv.san + (this.trainer.line.result ? '' : ' — book.'))
    this.showNoteFor(this.trainer.ply - 1)
    this.applyMove(mv)
  }

  setHints(set: SetKey, checked: boolean) {
    if (!this.trainer || this.sessionKey !== set) return
    this.trainer.hints = checked
    this.hintSquares =
      checked && this.game.turn() === this.humanColor && this.trainer.ply < this.trainer.line.moves.length
        ? this.squaresForSan(this.trainer.line.moves[this.trainer.ply])
        : null
    this.renderHighlights()
  }

  /* -------------------------- analysis -------------------------- */
  private collectAnalysis(line: string) {
    const mpv = line.match(/multipv (\d+)/)
    const sc = line.match(/score (cp|mate) (-?\d+)/)
    const dep = line.match(/ depth (\d+)/)
    const pvm = line.match(/ pv (.+)$/)
    if (!sc || !pvm) return
    const idx = mpv ? parseInt(mpv[1], 10) : 1
    this.analysisData[idx] = {
      depth: dep ? parseInt(dep[1], 10) : 0,
      kind: sc[1],
      val: parseInt(sc[2], 10),
      pv: pvm[1].trim().split(/\s+/),
    }
  }
  analyze() {
    if (this.selfPlay || this.replaying || this.thinking || this.animating || this.game.isGameOver()) return
    this.analyzing = true
    this.analysisData = {}
    this.analysisFen = this.game.fen()
    this.emit()
    this.engine.whenReady().then(() => {
      this.engine.setStrength('max')
      this.engine.setMultiPV(3)
      this.engine.go(this.analysisFen, Math.max(1600, this.moveTime))
    })
  }
  private finishAnalysis() {
    this.analyzing = false
    this.engine.setMultiPV(1)
    this.renderAnalysis()
  }
  private renderAnalysis() {
    const keys = Object.keys(this.analysisData).map(Number).sort((a, b) => a - b)
    if (!keys.length) {
      this.clearAnalysis()
      return
    }
    const sideW = this.analysisFen.split(' ')[1] === 'w'
    const lines: AnalysisLine[] = []
    for (const k of keys) {
      const d = this.analysisData[k]
      let ev: string
      if (d.kind === 'mate') {
        const m = sideW ? d.val : -d.val
        ev = '#' + (m >= 0 ? '' : '-') + Math.abs(m)
      } else {
        const cp = (sideW ? d.val : -d.val) / 100
        ev = (cp >= 0 ? '+' : '') + cp.toFixed(2)
      }
      const tmp = new Chess(this.analysisFen)
      const sans: string[] = []
      for (const uci of d.pv.slice(0, 6)) {
        const mv = tmp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined })
        if (!mv) break
        sans.push(mv.san)
      }
      lines.push({ ev, pv: this.sanLine(this.analysisFen, sans), best: k === 1 })
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
      this.reviewCollect = { cp: 0, mate: null, pv: [], bestUci: '' }
      this.reviewResolve = resolve
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
    if (this.selfPlay || this.replaying || this.reviewing) return
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
    this.reviewing = true
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
        this.reviewing = false
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
      const c = this.reviewCollect!
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
      let label: MoveLabel
      if (playedBest || loss <= 15) label = 'Best'
      else if (loss <= 90) label = 'Good'
      else if (loss <= 175) label = 'Inaccuracy'
      else if (loss <= 330) label = 'Mistake'
      else label = 'Blunder'
      // eval after the move, White's perspective
      const afterStm = scores[i + 1]
      const afterTurn: 'w' | 'b' = fens[i + 1].split(' ')[1] === 'w' ? 'w' : 'b'
      const white = afterTurn === 'w' ? afterStm : -afterStm
      const evalWhite = this.fmtScore(white)
      const betterSan = label === 'Best' ? null : ChessController.uciToSan(fens[i], bestUci[i])
      items.push({
        ply: i,
        moveNo: Math.floor(i / 2) + 1,
        side: turn,
        san: sans[i],
        label,
        lossCp: label === 'Best' ? null : Math.round(loss),
        betterSan,
        betterPv: label === 'Best' ? null : bestPvSan[i] || null,
        evalWhite,
        isYou: turn === this.humanColor,
      })
    }

    this.reviewing = false
    this.viewGame = null
    this.reviewPly = null
    this.renderPieces()
    this.renderHighlights()
    this.review = { running: false, done: true, progress: '', items, story }
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
    const h = this.game.history({ verbose: true }) as any[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.renderAll()
  }

  clearReview() {
    this.review = null
    this.resumeGame()
  }

  /* -------------------------- move navigation (scrubber) -------------------------- */
  // Step through the current game without disturbing it. reviewPly is the viewed
  // ply (null = live, showing the latest position).
  private canBrowse() {
    return !this.selfPlay && !this.replaying && !this.thinking && !this.animating && this.game.history().length > 0
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
    this.reviewing = false
    this.review = null
    this.annotation = null
    this.viewGame = null
    this.reviewPly = null
  }

  /* -------------------------- opening annotation (best moves to move N) -------------------------- */
  // Take a known opening line, extend it with the engine's best play to a target
  // depth, and annotate every move: eval (White's view), where the book move
  // differs from the engine's pick, and where theory ends. Reuses the one-shot
  // eval plumbing (reviewing flag routes engine output to reviewCollect).
  async annotateOpening(bookMoves: string[], you: 'w' | 'b', targetPlies = 40, movetime = 350) {
    if (this.selfPlay || this.replaying || this.reviewing) return
    this.exitTrainer()
    this.stopSelfPlay()
    this.stopReplay()
    this.epoch++
    const myEpoch = this.epoch
    this.reviewing = true
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
        this.reviewing = false
        return
      }
      const fen = walker.fen()
      // Follow along on the board.
      this.viewGame = new Chess(fen)
      this.reviewPly = ply - 1 >= 0 ? ply - 1 : null
      const h = walker.history({ verbose: true }) as any[]
      this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
      this.renderPieces()
      this.renderHighlights()

      await this.evalPosition(fen, movetime)
      const c = this.reviewCollect!
      scores[ply] = ChessController.scoreVal(c.cp, c.mate)
      bests[ply] = c.bestUci

      let mv: any = null
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
      scores[ply] = ChessController.scoreVal(this.reviewCollect!.cp, this.reviewCollect!.mate)
    }
    if (myEpoch !== this.epoch) {
      this.reviewing = false
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
    this.reviewing = false
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
    const hh = this.game.history({ verbose: true }) as any[]
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
    this.game.header(
      'Event',
      'chesswithprince.com',
      'Site',
      'play.chesswithprince.com',
      'Date',
      new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      'White',
      this.humanColor === 'w' ? 'Player' : 'Stockfish 18',
      'Black',
      this.humanColor === 'w' ? 'Stockfish 18' : 'Player',
    )
    return this.game.pgn()
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
    if (this.thinking || this.animating || this.selfPlay || this.replaying) return
    this.epoch++
    this.exitReview()
    if (this.game.history().length === 0) return
    this.game.undo()
    if (this.game.turn() !== this.humanColor && this.game.history().length > 0) this.game.undo()
    const h = this.game.history({ verbose: true }) as any[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.selected = null
    this.hintSquares = null
    this.thinking = false
    if (this.trainer) {
      this.trainer.ply = h.length
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
    this.selfPlay = false
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
    return (
      !this.thinking &&
      !this.animating &&
      !this.selfPlay &&
      !this.replaying &&
      !this.analyzing &&
      !this.reviewing &&
      !this.viewGame &&
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

      if (this.selected && (!pc || pc.dataset.color !== this.humanColor || this.game.get(sq as any)?.color !== this.humanColor)) {
        if (this.canMoveNow() && this.tryHumanMove(this.selected, sq)) return
      }

      if (!pc || !this.canMoveNow()) {
        this.selected = null
        this.renderHighlights()
        this.renderDots()
        return
      }
      if (pc.dataset.color !== this.humanColor) {
        this.selected = null
        this.renderHighlights()
        this.renderDots()
        return
      }

      const from = pc.dataset.square!
      if (this.selected === from) {
        this.selected = null
        this.renderHighlights()
        this.renderDots()
        return
      }
      this.selected = from
      this.renderHighlights()
      this.renderDots()

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
      this.drag.el.style.left = (x / rect.width) * 100 - 6.25 + '%'
      this.drag.el.style.top = (y / rect.height) * 100 - 6.25 + '%'
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
      const { left, top } = this.squareXY(d.from)
      d.el.style.left = left + '%'
      d.el.style.top = top + '%'
    })
  }
}
