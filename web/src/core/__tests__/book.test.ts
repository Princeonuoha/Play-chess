import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { BOOK, OPENING_IDX } from '../book';

describe('BOOK', () => {
  it('Given every opening line, when replayed with strict SAN parsing, then every move is legal', () => {
    for (const index of OPENING_IDX) {
      const game = new Chess();

      for (const san of BOOK[index].moves) {
        expect(game.move(san, { strict: true })).not.toBeNull();
      }

      expect(game.fen()).toMatchSnapshot();
    }
  });
});
