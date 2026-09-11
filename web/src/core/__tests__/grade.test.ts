import { describe, expect, it } from 'vitest'
import { classify } from '../grade'

describe('classify', () => {
  it('returns Best for zero delta', () => {
    // Given: no centipawn loss
    const cpDelta = 0

    // When: the move is classified
    const label = classify(cpDelta)

    // Then: it is the best grade
    expect(label).toBe('Best')
  })

  it('returns Good for a small delta', () => {
    // Given: a small non-best centipawn loss
    const cpDelta = 16

    // When: the move is classified
    const label = classify(cpDelta)

    // Then: it is a good move
    expect(label).toBe('Good')
  })

  it.each([
    ['Best', 15],
    ['Good', 16],
    ['Good', 90],
    ['Inaccuracy', 91],
    ['Inaccuracy', 175],
    ['Mistake', 176],
    ['Mistake', 330],
    ['Blunder', 331],
  ] as const)('returns %s for delta %i at a threshold boundary', (expected, cpDelta) => {
    // Given: a centipawn delta at or immediately beyond a threshold

    // When: the move is classified
    const label = classify(cpDelta)

    // Then: the threshold's intended grade is returned
    expect(label).toBe(expected)
  })

  it('returns Blunder for a very large delta', () => {
    // Given: a very large centipawn loss
    const cpDelta = 10_000

    // When: the move is classified
    const label = classify(cpDelta)

    // Then: it is a blunder
    expect(label).toBe('Blunder')
  })

  it('returns Best for negative deltas from the opponent perspective', () => {
    // Given: an opponent-perspective improvement
    const cpDelta = -100

    // When: the move is classified
    const label = classify(cpDelta)

    // Then: it is a best move
    expect(label).toBe('Best')
  })
})
