import assert from 'node:assert/strict';
import test from 'node:test';

import { Card } from '../../../shared/types';
import { GameEngine, roundYardsForPlay } from '../engine';

function stageTurn(engine: GameEngine, offense: Card, defense: Card) {
  engine.state.field.possessionPlayerId = 'home';
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

test('R-MULT-002 rounding uses away-from-zero policy', () => {
  assert.equal(roundYardsForPlay(1.5), 2);
  assert.equal(roundYardsForPlay(0.5), 1);
  assert.equal(roundYardsForPlay(-1.5), -2);
  assert.equal(roundYardsForPlay(-0.5), -1);
});

test('R-SAME-003 non-trigger fallback resolves to normal matrix flow', () => {
  let foundFallback = false;

  for (let i = 0; i < 250 && !foundFallback; i += 1) {
    const engine = new GameEngine(`SAME-FALLBACK-${i}`);
    engine.startGame();

    const lastPlay = stageTurn(
      engine,
      { id: `off-sr-${i}`, type: 'SR', name: 'Short Run' },
      { id: `def-sr-${i}`, type: 'SR', name: 'Short Run' }
    );

    if (lastPlay.message.includes('fallback to normal matrix')) {
      foundFallback = true;
    }
  }

  assert.equal(foundFallback, true, 'expected at least one deterministic same-play fallback case');
});

test('R-TP-002 own penalty applies -15 and consumes down', () => {
  let foundPenalty = false;

  for (let i = 0; i < 400 && !foundPenalty; i += 1) {
    const engine = new GameEngine(`TP-PEN-${i}`);
    engine.startGame();

    const lastPlay = stageTurn(
      engine,
      { id: `off-tp-${i}`, type: 'TP', name: 'Trick Play' },
      { id: `def-sr-${i}`, type: 'SR', name: 'Short Run' }
    );

    if (lastPlay.yardsGained === -15) {
      foundPenalty = true;
      assert.equal(lastPlay.message.includes('loss of down'), true);
      assert.equal(engine.state.field.down > 1 || lastPlay.isTurnover, true);
    }
  }

  assert.equal(foundPenalty, true, 'expected deterministic TP own-penalty outcome');
});

test('R-TP-003 defense card is returned when offense plays TP', () => {
  const engine = new GameEngine('TP-KEEP-DEF');
  engine.startGame();

  const defenseCard = { id: 'def-keep-card', type: 'SP', name: 'Short Pass' } as Card;

  stageTurn(
    engine,
    { id: 'off-tp', type: 'TP', name: 'Trick Play' },
    defenseCard
  );

  const defenseHand = engine.state.players.away.hand;
  assert.equal(defenseHand.some((card) => card.id === defenseCard.id), true);
});

test('TP vs TP uses same-play TP profile', () => {
  const engine = new GameEngine('TP-VS-TP');
  engine.startGame();

  const lastPlay = stageTurn(
    engine,
    { id: 'off-tp-1', type: 'TP', name: 'Trick Play' },
    { id: 'def-tp-1', type: 'TP', name: 'Trick Play' }
  );

  assert.equal(lastPlay.playCalled.type, 'TP');
  assert.equal(lastPlay.defenseCalled.type, 'TP');
  assert.equal(lastPlay.message.toLowerCase().includes('same-play'), true);
});

test('R-FLD-003 safety awards defense and resets regular-time field', () => {
  const engine = new GameEngine('SAFETY-CASE');
  engine.startGame();

  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.ballOn = 5;

  const result = (engine as any).applyBallAndPossession(-10, 'home', { fieldGoalAttempt: false });

  assert.equal(result.safety, true);
  assert.equal(engine.state.players.away.score, 2);
  assert.equal(engine.state.field.ballOn, 50);
  assert.equal(engine.state.field.possessionPlayerId, 'away');
});
