/* ---------------------------------------------------------------------------
 * DESIGN.md 8.5 A11Y-08 / A11Y-09 — the board console.
 *
 * Lichess ships a screen-reader board as a feature, not a nicety (DESIGN.md
 * 1.4), and this is this product's version of it: an always-current textual
 * board plus a single move entry that makes the game playable with no pointer
 * at all. The imperative visual board is untouched — this is an ADDITIONAL
 * surface rendered beside it.
 *
 * It is `.ui-sr-only` at rest, because a sighted mouse user has the board
 * itself and DESIGN.md 1.2 does not allow a second thing competing with it. It
 * un-hides the moment focus lands inside, because an invisible focused text
 * field is a WCAG 2.4.7 failure — a keyboard user must SEE where they are.
 *
 * Committing a move goes through the board's own pointer handler rather than a
 * new controller entry point. That is the point: legality, promotion, trainer
 * book-matching, explore, animation and the engine reply all run the one tested
 * path, so the keyboard can never diverge from the pointer.
 * ------------------------------------------------------------------------- */

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import type { Square } from 'chess.js'
import type { Snapshot } from '../core/controller'
import { Btn, Field } from '../ui/primitives'
import {
  describeDestinations,
  legalFrom,
  pieceName,
  readBoard,
  readIntent,
  spokenMove,
  viewedLine,
} from './boardState'

type Point = { readonly x: number; readonly y: number }

function centreOf(board: HTMLElement, square: string): Point | null {
  const cell = board.querySelector<HTMLElement>(`.sq[data-square="${square}"]`)
  if (cell === null) return null
  const rect = cell.getBoundingClientRect()
  if (rect.width === 0) return null
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function pointerAt(type: 'pointerdown' | 'pointerup', at: Point): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerdown' ? 1 : 0,
    clientX: at.x,
    clientY: at.y,
  })
}

/** Whether the controller already holds this square selected, read off its own cue. */
function alreadySelected(board: HTMLElement, square: string): boolean {
  const ring = board.querySelector<HTMLElement>('.hl.sel')
  const cell = board.querySelector<HTMLElement>(`.sq[data-square="${square}"]`)
  if (ring === null || cell === null) return false
  const a = ring.getBoundingClientRect()
  const b = cell.getBoundingClientRect()
  return Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2
}

/**
 * Plays `from`→`to` as the board's own tap-then-tap gesture.
 *
 * The controller captures the pointer on `pointerdown` so a real drag keeps
 * receiving events after the finger leaves the piece. A typed move has no
 * device behind it, and `setPointerCapture` throws `NotFoundError` for a
 * pointer id nothing owns — which would escape as an uncaught page error. The
 * capture is therefore stubbed on that one element for the two synchronous
 * dispatches of the gesture and handed straight back.
 *
 * The release tap is sent to the piece layer rather than to a piece, so
 * `closest('.piece')` is null there and the controller reads it as "tapped a
 * destination" — which is exactly how a capture works by pointer too.
 */
export function playThroughBoard(board: HTMLElement, from: string, to: string): boolean {
  const start = centreOf(board, from)
  const end = centreOf(board, to)
  const layer = board.querySelector<HTMLElement>('.piece-layer')
  const piece = board.querySelector<HTMLElement>(`.piece[data-square="${from}"]`)
  if (start === null || end === null || layer === null || piece === null) return false

  if (!alreadySelected(board, from)) {
    const own = Object.getOwnPropertyDescriptor(piece, 'setPointerCapture')
    Object.defineProperty(piece, 'setPointerCapture', { value: () => {}, configurable: true, writable: true })
    try {
      piece.dispatchEvent(pointerAt('pointerdown', start))
      layer.dispatchEvent(pointerAt('pointerup', start))
    } finally {
      if (own === undefined) Reflect.deleteProperty(piece, 'setPointerCapture')
      else Object.defineProperty(piece, 'setPointerCapture', own)
    }
  }

  layer.dispatchEvent(pointerAt('pointerdown', end))
  return true
}

const INSTRUCTIONS =
  'Type a square such as e2 to pick a piece up and hear where it can go, then type the destination. ' +
  'A move in notation plays straight away: e4, Nf3, O-O, or e2e4. Type clear to drop the selection. ' +
  'Arrow keys browse the game, Home and End jump to its start and its live position. ' +
  'A pawn reaching the last rank opens the promotion dialog, where you choose the piece.'

export function BoardConsole({
  snapshot,
  boardRef,
}: {
  readonly snapshot: Snapshot | null
  readonly boardRef: RefObject<HTMLElement>
}) {
  const titleId = useId()
  const [selected, setSelected] = useState<string | null>(null)
  const [entry, setEntry] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const board = readBoard(snapshot)
  const line = viewedLine(snapshot)
  const lineKey = `${board.exploring ? 'x' : board.browsing ? 'b' : 'l'}:${line.join(' ')}`
  const seen = useRef<string | null>(null)

  /* Every position change clears the selection and states what changed. The
     visual board answers this with pieces; this is the same event in words. */
  useEffect(() => {
    if (seen.current === lineKey) return
    const first = seen.current === null
    seen.current = lineKey
    setSelected(null)
    if (first) return
    const played = board.lastMove === null ? 'Board reset to the starting position.' : `${spokenMove(board.lastMove)} played.`
    const check = board.result !== null ? ` ${board.result}` : board.inCheck ? ` ${board.turnName} is in check.` : ''
    setAnnouncement(`${played}${check}${board.result === null ? ` ${board.turnName} to move.` : ''}`)
  }, [lineKey, board.lastMove, board.result, board.inCheck, board.turnName])

  const selectedCell = selected === null ? null : board.game.get(selected as Square)
  const destinations = selected === null ? [] : legalFrom(board.game, selected)
  const selectionText =
    selected === null || selectedCell === undefined || selectedCell === null
      ? 'No square is selected.'
      : `Selected ${selected}, ${pieceName(selectedCell.type, selectedCell.color)}. Legal moves: ${describeDestinations(destinations)}.`

  const summary = [
    board.result ?? `${board.turnName} to move, move ${board.moveNumber}.`,
    board.lastMove === null ? 'No moves have been played.' : `Last move ${spokenMove(board.lastMove)}.`,
    board.inCheck ? `${board.turnName} is in check.` : 'Neither king is in check.',
  ].join(' ')

  const submit = () => {
    const node = boardRef.current
    if (node === null) return
    if (!board.canMove) {
      setAnnouncement(board.blockedBecause ?? 'That move cannot be played right now.')
      return
    }
    const intent = readIntent(board.game, selected, entry)
    if (intent.kind === 'clear') {
      setSelected(null)
      setEntry('')
      setAnnouncement('Selection cleared.')
      return
    }
    if (intent.kind === 'error') {
      setAnnouncement(intent.message)
      return
    }
    if (intent.kind === 'select') {
      const cell = board.game.get(intent.square as Square)
      setSelected(intent.square)
      setEntry('')
      setAnnouncement(
        `Selected ${intent.square}, ${cell ? pieceName(cell.type, cell.color) : 'piece'}. Legal moves: ${describeDestinations(
          legalFrom(board.game, intent.square),
        )}.`,
      )
      return
    }
    setEntry('')
    if (!playThroughBoard(node, intent.move.from, intent.move.to)) {
      setAnnouncement('The board is not ready for that move yet.')
      return
    }
    setSelected(null)
  }

  return (
    <section
      data-shell="board-console"
      aria-labelledby={titleId}
      className="board-console"
      onKeyDown={(event) => {
        /* The shell's global arrow-key browser already ignores form controls,
           so Escape is the only key this surface has to claim: it drops the
           selection without leaving the field. */
        if (event.key === 'Escape' && selected !== null) {
          event.preventDefault()
          setSelected(null)
          setAnnouncement('Selection cleared.')
        }
      }}
    >
      <h2 id={titleId} className="board-console-title">
        Board
      </h2>
      <p className="board-console-note" data-board-alt="instructions">
        {INSTRUCTIONS}
      </p>
      <p data-board-alt="summary">{summary}</p>
      <p data-board-alt="selection">{selectionText}</p>
      {board.blockedBecause !== null && <p data-board-alt="blocked">{board.blockedBecause}</p>}
      <h3 className="board-console-title">Position</h3>
      <ul data-board-alt="placement" className="board-console-list">
        {board.ranks.map((rank) => (
          <li key={rank.slice(0, 7)} data-board-alt-rank={rank.slice(5, 6)}>
            {rank}
          </li>
        ))}
      </ul>
      <form
        className="board-console-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Field label="Square or move" description="For example e2, then e4.">
          {(control) => (
            <input
              {...control}
              className="ui-control"
              type="text"
              autoComplete="off"
              spellCheck={false}
              data-board-alt="entry"
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
            />
          )}
        </Field>
        <Btn type="submit" icon="check" primary>
          Play or select
        </Btn>
      </form>
      <p aria-live="polite" data-board-alt="announce" className="board-console-note">
        {announcement}
      </p>
    </section>
  )
}
