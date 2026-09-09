import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'

describe('vitest bootstrap', () => {
  it('imports chess.js and starts a fresh game', () => {
    const g = new Chess()
    expect(g.turn()).toBe('w')
    expect(g.history()).toEqual([])
  })
})
