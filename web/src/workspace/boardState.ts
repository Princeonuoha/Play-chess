/* ---------------------------------------------------------------------------
 * DESIGN.md 8.5 A11Y-08 — the screen-reader board's source of truth.
 *
 * The visual board is imperative DOM owned by `ChessController` (DESIGN.md 8.7
 * D-02), and the controller is deliberately not touched by this task. So the
 * accessible surface does not read the board's pixels: it REBUILDS the viewed
 * position from the snapshot the controller already publishes, using the same
 * `chess.js` rules engine the controller itself uses. Same rules, same
 * legality, one derivation — the text can never disagree with the pieces.
 *
 * Three views have to be reproduced, exactly as `controller.ts` composes them:
 *
 *   live      → every SAN in `history`
 *   browsing  → `history` up to and including `reviewPly` (`gotoPly`)
 *   exploring → `history` up to `exploreStartPly`, then `exploreMoves`
 *
 * Nothing here mutates anything. It is pure, so it is unit-testable without a
 * browser and cannot introduce a rules change.
 * ------------------------------------------------------------------------- */

import { Chess } from 'chess.js'
import type { Move, Square } from 'chess.js'
import type { Snapshot } from '../core/controller'

const FILES = 'abcdefgh'

const PIECE_NAME: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export type LastMove = {
  readonly san: string
  readonly from: string
  readonly to: string
  readonly number: number
  readonly side: 'w' | 'b'
}

export type BoardState = {
  readonly game: Chess
  readonly turn: 'w' | 'b'
  readonly turnName: string
  readonly moveNumber: number
  readonly ranks: readonly string[]
  readonly lastMove: LastMove | null
  readonly inCheck: boolean
  readonly result: string | null
  /** The player is looking at an earlier ply rather than the live position. */
  readonly browsing: boolean
  readonly exploring: boolean
  /** True when a move entered here would be accepted by the board right now. */
  readonly canMove: boolean
  /** Why not, when `canMove` is false. */
  readonly blockedBecause: string | null
}

export const sideName = (side: 'w' | 'b'): string => (side === 'w' ? 'White' : 'Black')

export const pieceName = (type: string, colour: 'w' | 'b'): string =>
  `${sideName(colour).toLowerCase()} ${PIECE_NAME[type] ?? type}`

/** Replays SAN strings onto a fresh game, stopping at the first one the rules reject. */
function replay(sans: readonly string[]): { readonly game: Chess; readonly last: Move | null } {
  const game = new Chess()
  let last: Move | null = null
  for (const san of sans) {
    try {
      last = game.move(san)
    } catch {
      break
    }
  }
  return { game, last }
}

/** The SAN list the viewed position is built from, per `controller.ts`. */
export function viewedLine(snapshot: Snapshot | null): readonly string[] {
  if (snapshot === null) return []
  if (snapshot.exploring) {
    return [...snapshot.history.slice(0, Math.max(0, snapshot.exploreStartPly + 1)), ...snapshot.exploreMoves]
  }
  if (snapshot.reviewPly !== null) return snapshot.history.slice(0, Math.max(0, snapshot.reviewPly + 1))
  return snapshot.history
}

/** "Rank 8: a8 black rook, b8 black knight, …" — one line a screen reader can read straight through. */
function describeRank(game: Chess, rank: number): string {
  const occupied: string[] = []
  for (const file of FILES) {
    const square = `${file}${rank}`
    const cell = game.get(square as Square)
    if (cell) occupied.push(`${square} ${pieceName(cell.type, cell.color)}`)
  }
  return occupied.length === 0 ? `Rank ${rank}: empty.` : `Rank ${rank}: ${occupied.join(', ')}.`
}

function describeResult(game: Chess): string | null {
  if (!game.isGameOver()) return null
  if (game.isCheckmate()) return `Checkmate. ${sideName(game.turn() === 'w' ? 'b' : 'w')} wins.`
  if (game.isStalemate()) return 'Stalemate. The game is drawn.'
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material.'
  if (game.isThreefoldRepetition()) return 'Draw by threefold repetition.'
  return 'Draw by the fifty-move rule.'
}

/**
 * Whether the console may commit a move.
 *
 * `ChessController.canMoveNow()` is private, so this mirrors it from the
 * published snapshot rather than reaching into the instance. It is deliberately
 * a little stricter than the pointer path — a move typed while browsing history
 * would silently jump the board back to the live game, which is a surprise a
 * screen-reader user has no way to see coming — so browsing is reported as a
 * reason rather than accepted.
 */
function moveGate(snapshot: Snapshot | null, game: Chess): string | null {
  if (snapshot === null) return 'The board is still loading.'
  if (game.isGameOver()) return 'The game is over. Start a new game to play again.'
  if (snapshot.exploring) return null
  if (snapshot.selfPlay) return 'Stockfish is playing both sides.'
  if (snapshot.replaying) return 'A game is being replayed.'
  if (snapshot.analyzing) return 'The position is being analysed.'
  if (snapshot.reviewPly !== null) return 'You are browsing an earlier move. Press End to return to the live position.'
  if (snapshot.thinking) return 'Stockfish is thinking.'
  if (snapshot.statusWho !== 'Your move') return 'It is not your move.'
  return null
}

export function readBoard(snapshot: Snapshot | null): BoardState {
  const line = viewedLine(snapshot)
  const { game, last } = replay(line)
  const turn = game.turn()
  const exploring = snapshot?.exploring ?? false
  const blockedBecause = moveGate(snapshot, game)

  return {
    game,
    turn,
    turnName: sideName(turn),
    moveNumber: Math.floor(line.length / 2) + 1,
    ranks: [8, 7, 6, 5, 4, 3, 2, 1].map((rank) => describeRank(game, rank)),
    lastMove:
      last === null
        ? null
        : {
            san: last.san,
            from: last.from,
            to: last.to,
            number: Math.ceil(line.length / 2),
            side: last.color,
          },
    inCheck: game.inCheck(),
    result: describeResult(game),
    browsing: !exploring && (snapshot?.reviewPly ?? null) !== null,
    exploring,
    canMove: blockedBecause === null,
    blockedBecause,
  }
}

const PROMOTION_WORD: Record<string, string> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }

/**
 * SAN as a screen reader should say it.
 *
 * `bxa8=Q` is read out as "b x a8 equals Q", which is not a move anyone would
 * recognise, so the promotion is worded. The check and mate markers are dropped
 * instead of worded because check and the result are already their own
 * sentences in the summary, and saying both would announce check twice.
 */
export function spokenSan(san: string): string {
  return san
    .replace(/=([QRBN])/, (_, piece: string) => ` promoting to ${PROMOTION_WORD[piece.toLowerCase()]}`)
    .replace(/[+#]$/, '')
}

/** "1. e4" / "1… e5" — the notation a player would say out loud. */
export function spokenMove(move: LastMove): string {
  return `${move.number}${move.side === 'w' ? '.' : '…'} ${spokenSan(move.san)}`
}

export function legalFrom(game: Chess, square: string): readonly Move[] {
  try {
    return game.moves({ square: square as Square, verbose: true }) as Move[]
  } catch {
    return []
  }
}

/** "e3, e4" with captures worded, so the destination list needs no legend. */
export function describeDestinations(moves: readonly Move[]): string {
  if (moves.length === 0) return 'no legal moves'
  return moves
    .map((move) => (move.flags.includes('c') || move.flags.includes('e') ? `${move.to} capture` : move.to))
    .join(', ')
}

export type Intent =
  | { readonly kind: 'move'; readonly move: Move }
  | { readonly kind: 'select'; readonly square: string }
  | { readonly kind: 'clear' }
  | { readonly kind: 'error'; readonly message: string }

const SQUARE = /^[a-h][1-8]$/

/**
 * Reads one line of player input against the viewed position.
 *
 * The grammar is the spoken one, resolved in the order a player means it:
 *
 *   1. with a square already selected, a bare destination square completes the
 *      move — this is what makes `g1` then `f3` the knight and never the pawn;
 *   2. otherwise SAN or long algebraic — `e4`, `Nf3`, `O-O`, `e2e4`, `e7e8q`;
 *   3. otherwise a bare square holding one of your own pieces selects it;
 *   4. `clear` / `deselect` drops the selection.
 *
 * Exactly the same resolution the pointer performs, expressed in words.
 */
export function readIntent(game: Chess, selected: string | null, raw: string): Intent {
  const text = raw.trim()
  if (text === '') return { kind: 'error', message: 'Type a square or a move first.' }
  const word = text.toLowerCase()
  if (word === 'clear' || word === 'deselect' || word === 'cancel') return { kind: 'clear' }

  const square = word.replace(/[^a-h1-8]/g, '')
  if (selected !== null && SQUARE.test(square) && square.length === 2) {
    const landing = legalFrom(game, selected).find((move) => move.to === square)
    if (landing) return { kind: 'move', move: landing }
  }

  const notated = text.replace(/[!?\s]/g, '').replace(/0/g, 'O')
  /* Check, mate and the promotion piece are all decorations on the same move:
     `bxa8`, `bxa8=Q` and `bxa8=N` are one instruction as far as the board is
     concerned, because the piece is chosen in the promotion dialog. Comparing
     the undecorated forms is what lets a player type what they would say. */
  const bare = (san: string) => san.replace(/[+#]/g, '').replace(/=[QRBNqrbn]/, '')
  const target = bare(notated)
  const verbose = game.moves({ verbose: true }) as Move[]
  const direct = verbose.find(
    (move) => move.san === notated || bare(move.san) === target || move.lan === word || `${move.from}${move.to}` === word,
  )
  if (direct) return { kind: 'move', move: direct }

  if (SQUARE.test(square) && square.length === 2) {
    const cell = game.get(square as Square)
    if (cell && cell.color === game.turn()) return { kind: 'select', square }
    if (cell) return { kind: 'error', message: `${square} holds a ${pieceName(cell.type, cell.color)}, which is not yours to move.` }
    return { kind: 'error', message: `${square} is empty.` }
  }

  return { kind: 'error', message: `${text} is not a legal move or a square on this board.` }
}
