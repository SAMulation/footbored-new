import assert from 'node:assert/strict';
import test from 'node:test';

import { GameEngine } from '../engine';
import { RULE_ASSUMPTIONS } from '../rules/assumptions';

function playTurn(engine: GameEngine, offenseCardId: string, defenseCardId: string) {
  const first = engine.submitMove('home', offenseCardId);
  const second = engine.submitMove('away', defenseCardId);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(second.resolved, true);
  assert(engine.state.lastPlay);

  return engine.state.lastPlay!;
}

function getSpecialActionId(engine: GameEngine, side: 'home' | 'away', type: 'FG' | 'TO'): string {
  const action = engine.state.players[side].specialActions.find((candidate) => candidate.type === type);
  assert(action, `missing ${type} action for ${side}`);
  return action.id;
}

test('field-goal distance bands use configured edge rates and long-shot fallback', () => {
  const engine = new GameEngine('FG-BANDS');
  const getRate = (distance: number) => (engine as any).getFieldGoalSuccessRate(distance);

  assert.equal(getRate(34), RULE_ASSUMPTIONS.fieldGoal.distanceBands[0]?.successRate);
  assert.equal(getRate(44), RULE_ASSUMPTIONS.fieldGoal.distanceBands[1]?.successRate);
  assert.equal(getRate(54), RULE_ASSUMPTIONS.fieldGoal.distanceBands[2]?.successRate);
  assert.equal(getRate(65), RULE_ASSUMPTIONS.fieldGoal.distanceBands[3]?.successRate);
  assert.equal(getRate(66), RULE_ASSUMPTIONS.fieldGoal.longShotSuccessRate);
});

test('defense timeout ices field-goal attempt and consumes one timeout', () => {
  const engine = new GameEngine('FG-ICE-BASIC');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.down = 4;
  engine.state.field.toGo = 7;
  engine.state.field.ballOn = 70;
  (engine as any).syncState();

  const fgId = getSpecialActionId(engine, 'home', 'FG');
  const toId = getSpecialActionId(engine, 'away', 'TO');
  const lastPlay = playTurn(engine, fgId, toId);

  assert.equal(lastPlay.playCalled.type, 'FG');
  assert.equal(lastPlay.defenseCalled.type, 'TO');
  assert.equal(lastPlay.flags?.kickType, 'FIELD_GOAL');
  assert.equal(lastPlay.flags?.kickDistance, 30);
  assert.equal(lastPlay.flags?.icedKicker, true);
  assert.equal(engine.state.players.away.timeouts, 2);
});

test('no-timeout defense cannot ice field-goal attempt', () => {
  const engine = new GameEngine('FG-NO-ICE');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.down = 4;
  engine.state.field.toGo = 5;
  engine.state.field.ballOn = 68;
  engine.state.players.away.timeouts = 0;
  (engine as any).syncState();

  const toAction = engine.state.players.away.specialActions.find((candidate) => candidate.type === 'TO');
  assert(toAction);
  assert.equal(toAction.enabled, false);
  assert.equal(toAction.reason, 'timeouts_exhausted');

  const fgId = getSpecialActionId(engine, 'home', 'FG');
  const defenseCardId = engine.state.players.away.hand[0]?.id;
  assert(defenseCardId);

  const lastPlay = playTurn(engine, fgId, defenseCardId);
  assert.equal(lastPlay.playCalled.type, 'FG');
  assert.equal(lastPlay.flags?.icedKicker, false);
  assert.equal(engine.state.players.away.timeouts, 0);
});

test('missed field goal turns over at line of scrimmage assumption', () => {
  let observedMiss = false;

  for (let i = 0; i < 64; i += 1) {
    const engine = new GameEngine(`FG-MISS-${i}`);
    engine.startGame();

    engine.state.field.possessionPlayerId = 'home';
    engine.state.field.down = 4;
    engine.state.field.toGo = 9;
    engine.state.field.ballOn = 30;
    (engine as any).syncState();

    const fgId = getSpecialActionId(engine, 'home', 'FG');
    const defenseCardId = engine.state.players.away.hand[0]?.id;
    assert(defenseCardId);

    const lastPlay = playTurn(engine, fgId, defenseCardId);
    if (!lastPlay.message.includes('missed')) {
      continue;
    }

    observedMiss = true;
    assert.equal(lastPlay.isTurnover, true);
    assert.equal(lastPlay.flags?.kickType, 'FIELD_GOAL');
    assert.equal(lastPlay.flags?.kickResultSpot, 30);
    assert.equal(engine.state.field.possessionPlayerId, 'away');
    assert.equal(engine.state.field.ballOn, 30);
    break;
  }

  assert.equal(observedMiss, true, 'expected at least one deterministic long-shot miss');
});

test('overtime field-goal icing applies without kickoff-transition flags', () => {
  const engine = new GameEngine('FG-ICE-OT');
  engine.startGame();

  engine.state.field.isOvertime = true;
  engine.state.field.overtimePeriod = 1;
  engine.state.field.quarter = 5;
  engine.state.field.clockSeconds = 0;
  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.down = 4;
  engine.state.field.toGo = 4;
  engine.state.field.ballOn = 72;
  (engine as any).syncState();

  const fgId = getSpecialActionId(engine, 'home', 'FG');
  const toId = getSpecialActionId(engine, 'away', 'TO');
  const lastPlay = playTurn(engine, fgId, toId);

  assert.equal(lastPlay.flags?.kickType, 'FIELD_GOAL');
  assert.equal(lastPlay.flags?.icedKicker, true);
  assert.equal(lastPlay.flags?.kickoffTouchback, undefined);
  assert.equal(engine.state.players.away.timeouts, 2);
});
