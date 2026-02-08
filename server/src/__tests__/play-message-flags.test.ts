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

test('standard-play recap includes quality, multiplier, and yard-card basis', () => {
  const engine = new GameEngine('MSG-STANDARD-BASIS');
  engine.startGame();

  const offenseCard = engine.state.players.home.hand.find((card) => card.type === 'SR' || card.type === 'LR' || card.type === 'SP' || card.type === 'LP');
  const defenseCard = engine.state.players.away.hand.find((card) => card.type === 'SR' || card.type === 'LR' || card.type === 'SP' || card.type === 'LP');
  assert(offenseCard && defenseCard);

  const lastPlay = playTurn(engine, offenseCard.id, defenseCard.id);
  assert.match(lastPlay.message, /quality\s[BGDOW]/);
  assert.match(lastPlay.message, /multiplier\s(K|Q|J|10)/);
  assert.match(lastPlay.message, /yard card\s\d+/);
});

test('icing recap includes explicit iced-kicker reason tag', () => {
  const engine = new GameEngine('MSG-ICED-FG');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.down = 4;
  engine.state.field.toGo = 6;
  engine.state.field.ballOn = 70;
  (engine as any).syncState();

  const fg = engine.state.players.home.specialActions.find((action) => action.type === 'FG' && action.enabled);
  const to = engine.state.players.away.specialActions.find((action) => action.type === 'TO' && action.enabled);
  assert(fg && to);

  const lastPlay = playTurn(engine, fg.id, to.id);
  assert.equal(lastPlay.flags?.icedKicker, true);
  assert.match(lastPlay.message, /iced kicker/i);
});

test('OT bucket reset appears in recap message and flags on first OT bucket play', () => {
  const engine = new GameEngine('MSG-OT-BUCKET');
  engine.startGame();

  (engine as any).enterOvertimePeriod(1);

  const offenseCard = engine.state.players.home.hand[0]?.id;
  const defenseCard = engine.state.players.away.hand[0]?.id;
  assert(offenseCard && defenseCard);

  const lastPlay = playTurn(engine, offenseCard, defenseCard);
  assert.equal(lastPlay.flags?.otBucketReset, true);
  assert.match(lastPlay.message, /ot bucket reset/i);
});
