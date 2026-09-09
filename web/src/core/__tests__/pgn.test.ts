import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { buildPGN } from '../pgn'

describe('buildPGN', () => {
  it("round-trips Scholar's Mate through chess.js", () => {
    // Given
    const game = new Chess()
    for (const san of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']) {
      game.move(san, { strict: true })
    }
    const history = game.history({ verbose: true })

    // When
    const pgn = buildPGN(history, {
      date: '2026.09.09',
      white: 'Player',
      black: 'Stockfish 18',
    })
    const parsed = new Chess()
    parsed.loadPgn(pgn)

    // Then
    expect(parsed.history()).toEqual(game.history())
    expect(parsed.fen()).toBe(game.fen())
  })
})
