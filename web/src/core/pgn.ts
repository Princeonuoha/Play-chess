import { Chess } from 'chess.js'
import type { Move } from 'chess.js'

export interface PGNMeta {
  readonly date: string
  readonly white: string
  readonly black: string
}

export function buildPGN(history: Move[], meta: PGNMeta): string {
  const game = new Chess()
  for (const move of history) game.move(move.san)
  game.header(
    'Event',
    'chesswithprince.com',
    'Site',
    'play.chesswithprince.com',
    'Date',
    meta.date,
    'White',
    meta.white,
    'Black',
    meta.black,
  )
  return game.pgn()
}
