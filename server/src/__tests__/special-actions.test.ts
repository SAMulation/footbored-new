import assert from 'node:assert/strict';
import test from 'node:test';

import { GameEngine, TeamSide } from '../engine';
import { PlayType } from '../../../shared/types';

function getAction(engine: GameEngine, side: TeamSide, type: PlayType) {
  return engine.state.players[side].specialActions.find((action) => action.type === type);
}

test('virtual special actions are exposed with stable ids', () => {
  const engine = new GameEngine('SPECIAL-IDS');
  engine.startGame();

  for (const side of ['home', 'away'] as TeamSide[]) {
    for (const type of ['TP', 'HM', 'FG', 'PT', 'TO'] as PlayType[]) {
      const action = getAction(engine, side, type);
      assert(action, `missing ${type} for ${side}`);
      assert.equal(action.id, `SPECIAL:${side}:${type}`);
    }
  }
});

test('offense can play virtual TP and consume charge', () => {
  const engine = new GameEngine('SPECIAL-TP-USE');
  engine.startGame();

  const tp = getAction(engine, 'home', 'TP');
  assert(tp && tp.enabled);

  const defenseCardId = engine.state.players.away.hand[0]?.id;
  assert(defenseCardId);

  const first = engine.submitMove('home', tp.id);
  const second = engine.submitMove('away', defenseCardId);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(second.resolved, true);
  assert.equal(engine.state.lastPlay?.playCalled.type, 'TP');

  const after = getAction(engine, 'home', 'TP');
  assert(after);
  assert.equal(after.remaining, 0);
  assert.equal(after.enabled, false);
});

test('offense cannot play virtual HM when exhausted', () => {
  const engine = new GameEngine('SPECIAL-HM-EXHAUSTED');
  engine.startGame();

  engine.state.players.home.hailMaryCount = 0;
  (engine as any).syncState();

  const hm = getAction(engine, 'home', 'HM');
  assert(hm);
  assert.equal(hm.enabled, false);

  const result = engine.submitMove('home', hm.id);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'special_not_available');
});

test('TP charge resets after one standard cycle usage count', () => {
  const engine = new GameEngine('SPECIAL-TP-RESET');
  engine.startGame();

  (engine as any).trickPlayChargesBySide.home = 0;
  for (let i = 0; i < 12; i += 1) {
    (engine as any).trackStandardCycleUsage('home');
  }
  (engine as any).syncState();

  const tp = getAction(engine, 'home', 'TP');
  assert(tp);
  assert.equal(tp.remaining, 1);
  assert.equal(tp.enabled, true);
});
