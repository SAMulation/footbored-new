import assert from 'node:assert/strict';
import test from 'node:test';

import { Card } from '../../../shared/types';
import { assertRuleImplemented, GameEngine, RuleNotImplementedError } from '../engine';
import {
  HAIL_MARY_OUTCOME_TABLE,
  MULTIPLIER_TABLE,
  STANDARD_QUALITY_MATRIX,
  TRICK_PLAY_OUTCOME_TABLE,
} from '../rules/canonical';

test('standard quality matrix exposes all 16 canonical matchups', () => {
  const expected = {
    SR: { SR: 'W', LR: 'D', SP: 'D', LP: 'G' },
    LR: { SR: 'G', LR: 'O', SP: 'B', LP: 'G' },
    SP: { SR: 'D', LR: 'G', SP: 'W', LP: 'D' },
    LP: { SR: 'B', LR: 'G', SP: 'G', LP: 'O' },
  };

  assert.deepEqual(STANDARD_QUALITY_MATRIX, expected);
});

test('multiplier table values match canonical mapping', () => {
  assert.equal(MULTIPLIER_TABLE.K.B, 4.0);
  assert.equal(MULTIPLIER_TABLE.K.O, 1.5);
  assert.equal(MULTIPLIER_TABLE.Q.W, 0.5);
  assert.equal(MULTIPLIER_TABLE.J.D, 0.5);
  assert.equal(MULTIPLIER_TABLE['10'].O, -1.0);
  assert.equal(MULTIPLIER_TABLE['10'].W, -1.0);
});

function stageTurn(engine: GameEngine, offense: Card, defense: Card) {
  (engine as any).handHome.returnCardToHand(offense);
  (engine as any).handAway.returnCardToHand(defense);
  (engine as any).syncState();

  const first = engine.submitMove('home', offense.id);
  const second = engine.submitMove('away', defense.id);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(second.resolved, true);
  assert(engine.state.lastPlay);

  return engine.state.lastPlay!;
}

test('trick play and hail mary outcomes are deterministic from same seed state', () => {
  const tp1 = new GameEngine('CANONICAL-SEED');
  tp1.startGame();
  const tpLast1 = stageTurn(
    tp1,
    { id: 'tp-off-1', type: 'TP', name: 'Trick Play' },
    { id: 'sr-def-1', type: 'SR', name: 'Short Run' }
  );

  const tp2 = new GameEngine('CANONICAL-SEED');
  tp2.startGame();
  const tpLast2 = stageTurn(
    tp2,
    { id: 'tp-off-1', type: 'TP', name: 'Trick Play' },
    { id: 'sr-def-1', type: 'SR', name: 'Short Run' }
  );

  assert.equal(tpLast1.yardsGained, tpLast2.yardsGained);
  assert.equal(tpLast1.message, tpLast2.message);

  const hm1 = new GameEngine('CANONICAL-HM');
  hm1.startGame();
  const hmLast1 = stageTurn(
    hm1,
    { id: 'hm-off-1', type: 'HM', name: 'Hail Mary' },
    { id: 'sp-def-1', type: 'SP', name: 'Short Pass' }
  );

  const hm2 = new GameEngine('CANONICAL-HM');
  hm2.startGame();
  const hmLast2 = stageTurn(
    hm2,
    { id: 'hm-off-1', type: 'HM', name: 'Hail Mary' },
    { id: 'sp-def-1', type: 'SP', name: 'Short Pass' }
  );

  assert.equal(hmLast1.yardsGained, hmLast2.yardsGained);
  assert.equal(hmLast1.message, hmLast2.message);
  assert.equal(TRICK_PLAY_OUTCOME_TABLE.length, 6);
  assert.equal(HAIL_MARY_OUTCOME_TABLE.length, 6);
});

test('open rules throw explicit guardrail errors', () => {
  assert.throws(
    () => assertRuleImplemented('R-SAME-003'),
    (error: unknown) => {
      assert(error instanceof RuleNotImplementedError);
      assert.equal((error as RuleNotImplementedError).ruleId, 'R-SAME-003');
      return true;
    }
  );
});
