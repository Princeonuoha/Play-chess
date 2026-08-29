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
  private trainer: { line: BookLine; ply: number; hints: boolean } | null = null
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
  private eloSlider = 8
  private pendingPromo: { from: string; to: string } | null = null

  // Panel-facing state emitted in the snapshot.
  private engineTag = 'loading engine…'
  private evalFrac = 0.5
  private evalLabel = '0.0'
  private analysis: AnalysisLine[] | null = null
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

  private renderPieces() {
    this.elPieces.innerHTML = ''
    const board = this.game.board()
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
    if (this.game.inCheck()) {
      const turn = this.game.turn()
      for (const row of this.game.board())
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
    const total = Math.ceil(this.trainer.line.moves.length / 2)
    const done = Math.ceil(this.trainer.ply / 2)
    return `<span class="path">${this.trLineLabel()} · move ${done}/${total}<br>${
      this.trainer.line.moves.slice(0, this.trainer.ply).join(' ') || '—'
    }</span>`
  }

  private maybeBookMove() {
    if (!this.trainer) return
    this.slots[this.sessionKey].hintDisabled = false
    if (this.trainer.ply >= this.trainer.line.moves.length) {
      this.endOfBook()
      return
    }
    if (this.game.turn() === this.humanColor) {
      this.setTrStatus(
        'info',
        (this.trainer.line.result ? 'Your move — play the game move.' : 'Your move — play the book move.') +
          this.trProgress(),
      )
      this.hintSquares = this.trainer.hints ? this.squaresForSan(this.trainer.line.moves[this.trainer.ply]) : null
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
    const label = this.trLineLabel()
    this.slots[this.sessionKey].hintDisabled = true
    this.hintSquares = null
    this.trainer = null
    if (line.result) {
      this.setTrStatus('good', `End of the game — ${line.white} vs ${line.black}, ${line.result}.`)
      this.renderHighlights()
      this.emit()
      return
    }
    this.setTrStatus(
      'good',
      `End of the ${label} line (${total} moves). You're on your own now — playing Stockfish from here.`,
    )
    this.renderHighlights()
    this.emit()
    if (!this.game.isGameOver() && this.game.turn() !== this.humanColor) this.engineMove()
  }

  startTrainer(idx: number, set: SetKey, hints: boolean) {
    this.epoch++
    this.stopReplay()
    this.sessionKey = set
    const line = BOOK[idx]
    this.trainer = { line, ply: 0, hints }
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
    this.epoch++
    const line = BOOK[idx]
    this.stopSelfPlay()
    this.stopReplay()
    this.exitTrainer()
    this.game.reset()
    this.engine.newGame()
    for (const san of line.moves) this.game.move(san)
    const h = this.game.history({ verbose: true }) as any[]
    this.lastMove = h.length ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null
    this.orientation = line.you === 'w' ? 'white' : 'black'
    this.selected = null
    this.hintSquares = null
    this.renderSquares()
    this.renderAll()
    this.startSelfPlay()
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
