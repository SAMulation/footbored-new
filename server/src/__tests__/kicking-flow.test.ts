import assert from 'node:assert/strict';
import test from 'node:test';

import { GameEngine } from '../engine';

function playTurn(engine: GameEngine, offenseCardId: string, defenseCardId: string) {
  const first = engine.submitMove('home', offenseCardId);
  const second = engine.submitMove('away', defenseCardId);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(second.resolved, true);
  assert(engine.state.lastPlay);

  return engine.state.lastPlay;
}

test('legal 4th-down punt uses deterministic punt metadata and flips possession', () => {
  const engine = new GameEngine('PUNT-FLOW-1');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.down = 4;
  engine.state.field.toGo = 7;
  engine.state.field.ballOn = 40;
  (engine as any).syncState();

  const punt = engine.state.players.home.specialActions.find((action) => action.type === 'PT' && action.enabled);
  assert(punt);

  const defenseCardId = engine.state.players.away.hand[0]?.id;
  assert(defenseCardId);

  const lastPlay = playTurn(engine, punt.id, defenseCardId);
  assert.equal(lastPlay.playCalled.type, 'PT');
  assert.equal(lastPlay.isTurnover, true);
  assert.equal(lastPlay.flags?.kickType, 'PUNT');
  assert.equal(engine.state.field.possessionPlayerId, 'away');
  assert.equal(engine.state.field.ballOn >= 0 && engine.state.field.ballOn <= 100, true);
});

test('punt touchback places receiving offense at own 20', () => {
  const engine = new GameEngine('PUNT-TOUCHBACK');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.down = 4;
  engine.state.field.toGo = 10;
  engine.state.field.ballOn = 90;
  (engine as any).syncState();

  const punt = engine.state.players.home.specialActions.find((action) => action.type === 'PT' && action.enabled);
  assert(punt);

  const defenseCardId = engine.state.players.away.hand[0]?.id;
  assert(defenseCardId);

  const lastPlay = playTurn(engine, punt.id, defenseCardId);
  assert.equal(lastPlay.flags?.kickType, 'PUNT');
  assert.equal(lastPlay.flags?.kickoffTouchback, true);
  assert.equal(engine.state.field.ballOn, 80);
});

test('kickoff touchback path is deterministic and uses configured spot', () => {
  const engine = new GameEngine('KICKOFF-TB');
  engine.startGame();

  let found = false;
  for (let i = 0; i < 250; i += 1) {
    const flags = (engine as any).applyKickoff('away', 'touchdown', `seed-tb-${i}`);
    if (flags.kickoffTouchback) {
      found = true;
      assert.equal(flags.kickType, 'KICKOFF');
      assert.equal(engine.state.field.ballOn, 75);
      break;
    }
  }

  assert.equal(found, true, 'expected deterministic touchback seed to exist');
});

test('kickoff return path is deterministic and places ball in legal range', () => {
  const engine = new GameEngine('KICKOFF-RET');
  engine.startGame();

  let found = false;
  for (let i = 0; i < 250; i += 1) {
    const flags = (engine as any).applyKickoff('away', 'touchdown', `seed-ret-${i}`);
    if (!flags.kickoffTouchback) {
      found = true;
      assert.equal(flags.kickType, 'KICKOFF');
      assert.equal(engine.state.field.ballOn >= 66 && engine.state.field.ballOn <= 82, true);
      break;
    }
  }

  assert.equal(found, true, 'expected deterministic non-touchback seed to exist');
});
