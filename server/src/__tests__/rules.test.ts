import assert from 'node:assert/strict';
import test from 'node:test';

import { PlayType } from '../../../shared/types';
import { resolvePlayMatchup } from '../engine';

const PLAY_TYPES: PlayType[] = ['SR', 'LR', 'SP', 'LP', 'TP', 'HM', 'FG', 'PT', 'TO'];

test('matchup matrix is deterministic for every play pair', () => {
  for (const off of PLAY_TYPES) {
    for (const def of PLAY_TYPES) {
      const first = resolvePlayMatchup(off, def);
      const second = resolvePlayMatchup(off, def);

      assert.deepEqual(first, second);
      assert.equal(Number.isFinite(first.delta), true);
      assert.equal(Number.isFinite(first.yards), true);
    }
  }
});

test('punt and field goal matrix rows are non-negative baseline', () => {
  for (const def of PLAY_TYPES) {
    const punt = resolvePlayMatchup('PT', def);
    const fg = resolvePlayMatchup('FG', def);

    assert(punt.yards >= 0);
    assert(fg.yards >= 0);
  }
});
