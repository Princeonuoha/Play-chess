import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { BOOK, GAME_IDX } from '../book'

describe('master game scores', () => {
  it('plays every score end-to-end', () => {
    const terminalFens = GAME_IDX.map((i) => {
      const line = BOOK[i]
      const game = new Chess()

      for (const [ply, san] of line.moves.entries()) {
        expect(
          game.move(san, { strict: true }),
          `${line.variation} rejected ply ${ply + 1}: ${san}`,
        ).not.toBeNull()
      }

      return game.fen()
    })

    expect(terminalFens).toMatchInlineSnapshot(`
      [
        "1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17",
        "r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 1 23",
        "1r3kr1/pbpBBp1p/1b3P2/8/8/2P2q2/P4PPP/3R2K1 b - - 0 24",
        "6k1/5ppp/pb2p3/1p2P3/1P2bPnP/P6r/1B4QP/R4R1K w - - 2 26",
        "r3qrk1/pp3pb1/2pn1R1p/4P2Q/3p4/3B3P/PPP1N1P1/R5K1 b - - 1 21",
        "1Q6/5pk1/2p3p1/1p2N2p/1b5P/1bn5/2r3P1/2K5 w - - 16 42",
        "4q2k/2r1r3/4PR1p/p1p5/P1Bp1Q1P/1P6/6P1/6K1 b - - 4 41",
        "8/Q6p/6p1/5p2/5P2/2p3P1/3r3P/2K1k3 b - - 3 44",
        "r1r4k/pp1q3R/5pp1/3p2N1/6Q1/8/PP3PPP/2R3K1 b - - 0 25",
        "3rBb1k/ppq3pp/2p5/2P2Q2/8/1P4P1/P6P/5RK1 b - - 5 25",
      ]
    `)
  })
})
