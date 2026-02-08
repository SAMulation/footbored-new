import assert from 'node:assert/strict';
import test from 'node:test';

import { GamePhase } from '../../../shared/types';
import { GameEngine, TeamSide } from '../engine';

function getOffenseSide(engine: GameEngine): TeamSide {
  return engine.state.field.possessionPlayerId === 'away' ? 'away' : 'home';
}

function getDefenseSide(engine: GameEngine): TeamSide {
  return getOffenseSide(engine) === 'home' ? 'away' : 'home';
}

function playOneResolvedTurn(engine: GameEngine) {
  const offenseSide = getOffenseSide(engine);
  const defenseSide = getDefenseSide(engine);

  const offenseCard = engine.state.players[offenseSide].hand[0];
  const defenseCard = engine.state.players[defenseSide].hand[0];

  assert(offenseCard, 'offense hand missing card');
  assert(defenseCard, 'defense hand missing card');

  const first = engine.submitMove(offenseSide, offenseCard.id);
  assert.equal(first.accepted, true);

  const second = engine.submitMove(defenseSide, defenseCard.id);
  assert.equal(second.accepted, true);
  assert.equal(second.resolved, true);
}

test('submitMove rejects duplicate submission in same turn', () => {
  const engine = new GameEngine('T1');
  engine.startGame();

  const offenseSide = getOffenseSide(engine);
  const offenseCard = engine.state.players[offenseSide].hand[0];
  assert(offenseCard);

  const first = engine.submitMove(offenseSide, offenseCard.id);
  const second = engine.submitMove(offenseSide, offenseCard.id);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.reason, 'already_submitted');
});

test('away offense moves ball toward 0 (bidirectional field model)', () => {
  const engine = new GameEngine('T2');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'away';
  engine.state.field.ballOn = 50;
  engine.state.field.down = 1;
  engine.state.field.toGo = 10;

  playOneResolvedTurn(engine);

  assert(engine.state.lastPlay);
  const expected = Math.max(0, Math.min(100, 50 - engine.state.lastPlay!.yardsGained));
  assert.equal(engine.state.field.ballOn, expected);
});

test('turnover on downs flips possession', () => {
  const engine = new GameEngine('T3');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.down = 4;
  engine.state.field.toGo = 99;
  engine.state.field.ballOn = 40;

  playOneResolvedTurn(engine);

  assert.equal(engine.state.lastPlay?.isTurnover, true);
  assert.equal(engine.state.field.possessionPlayerId, 'away');
  assert.equal(engine.state.field.down, 1);
  assert.equal(engine.state.field.toGo, 10);
});

test('quarter and game over progression after final tick', () => {
  const engine = new GameEngine('T4');
  engine.startGame();

  engine.state.field.quarter = 4;
  engine.state.field.clockSeconds = 30;
  engine.state.field.ballOn = 50;
  engine.state.field.toGo = 10;

  playOneResolvedTurn(engine);

  assert.equal(engine.state.phase, GamePhase.GAME_OVER);
  assert.equal(engine.state.field.clockSeconds, 0);
});

test('advanceAfterResolution returns to selectable phase before game over', () => {
  const engine = new GameEngine('T5');
  engine.startGame();

  playOneResolvedTurn(engine);
  assert.equal(engine.state.phase, GamePhase.RESOLUTION);

  engine.advanceAfterResolution();
  assert.equal(engine.state.phase, GamePhase.OFFENSE_SELECT);
});
