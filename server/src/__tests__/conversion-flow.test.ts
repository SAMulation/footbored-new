import assert from 'node:assert/strict';
import test from 'node:test';

import { GamePhase } from '../../../shared/types';
import { GameEngine } from '../engine';

function forceTouchdownResolution(engine: GameEngine) {
  (engine as any).evaluateMatchup = () => ({
    delta: 3,
    yards: 90,
    message: 'Forced touchdown',
    multiplierCard: 'K',
    yardCard: 10,
  });
}

function playForcedTouchdown(engine: GameEngine, offense: 'home' | 'away' = 'home') {
  const defense = offense === 'home' ? 'away' : 'home';
  const offCard = engine.state.players[offense].hand[0]?.id;
  const defCard = engine.state.players[defense].hand[0]?.id;
  assert(offCard && defCard);

  const first = engine.submitMove(offense, offCard);
  const second = engine.submitMove(defense, defCard);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(second.resolved, true);
}

function setupConversionState(seed: string) {
  const engine = new GameEngine(seed);
  engine.startGame();
  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.ballOn = 20;
  engine.state.field.down = 1;
  engine.state.field.toGo = 10;
  (engine as any).syncState();

  forceTouchdownResolution(engine);
  playForcedTouchdown(engine, 'home');
  return engine;
}

test('touchdown enters conversion offense select before kickoff', () => {
  const engine = setupConversionState('CONV-TD-ENTRY');

  assert.equal(engine.state.lastPlay?.isTouchdown, true);
  assert.equal(engine.state.phase, GamePhase.CONVERSION_OFFENSE_SELECT);
  assert.equal(engine.state.conversion?.offenseSide, 'home');
  assert.equal(engine.state.conversion?.attemptType, null);

  const xp = engine.state.players.home.specialActions.find((action) => action.type === 'XP');
  const twoPoint = engine.state.players.home.specialActions.find((action) => action.type === '2PT');
  assert(xp && twoPoint);
  assert.equal(xp.enabled, true);
  assert.equal(twoPoint.enabled, true);
});

test('XP conversion resolves immediately and transitions to kickoff after conversion resolution', () => {
  const engine = setupConversionState('CONV-XP-PATH');

  const xp = engine.state.players.home.specialActions.find((action) => action.type === 'XP' && action.enabled);
  assert(xp);

  const submit = engine.submitMove('home', xp.id);
  assert.equal(submit.accepted, true);
  assert.equal(submit.resolved, true);
  assert.equal(engine.state.phase, GamePhase.CONVERSION_RESOLUTION);
  assert.equal(engine.state.lastPlay?.flags?.conversionType, 'XP');
  assert.equal(typeof engine.state.lastPlay?.flags?.conversionSuccess, 'boolean');

  engine.advanceAfterResolution();
  assert.equal(engine.state.phase, GamePhase.OFFENSE_SELECT);
  assert.equal(engine.state.conversion, null);
  assert.equal(engine.state.field.possessionPlayerId, 'away');
  assert.equal(engine.state.lastPlay?.flags?.kickType, 'KICKOFF');
  assert.match(engine.state.lastPlay?.message ?? '', /kickoff/i);
});

test('2PT conversion requires offense/defense play submission and resolves deterministically', () => {
  const engine = setupConversionState('CONV-2PT-PATH');

  const twoPoint = engine.state.players.home.specialActions.find((action) => action.type === '2PT' && action.enabled);
  assert(twoPoint);

  const choose = engine.submitMove('home', twoPoint.id);
  assert.equal(choose.accepted, true);
  assert.equal(choose.resolved, false);
  assert.equal(engine.state.phase, GamePhase.CONVERSION_DEFENSE_SELECT);

  const offCard = engine.state.players.home.hand.find((card) => card.type === 'SR' || card.type === 'SP' || card.type === 'LR' || card.type === 'LP')?.id;
  const defCard = engine.state.players.away.hand.find((card) => card.type === 'SR' || card.type === 'SP' || card.type === 'LR' || card.type === 'LP')?.id;
  assert(offCard && defCard);

  const offSubmit = engine.submitMove('home', offCard);
  const defSubmit = engine.submitMove('away', defCard);
  assert.equal(offSubmit.accepted, true);
  assert.equal(defSubmit.accepted, true);
  assert.equal(defSubmit.resolved, true);
  assert.equal(engine.state.phase, GamePhase.CONVERSION_RESOLUTION);
  assert.equal(engine.state.lastPlay?.flags?.conversionType, '2PT');
  assert.equal(typeof engine.state.lastPlay?.flags?.conversionSuccess, 'boolean');

  engine.advanceAfterResolution();
  assert.equal(engine.state.phase, GamePhase.OFFENSE_SELECT);
  assert.equal(engine.state.field.possessionPlayerId, 'away');
  assert.equal(engine.state.players.home.score >= 6 && engine.state.players.home.score <= 8, true);
  assert.equal(engine.state.lastPlay?.flags?.kickType, 'KICKOFF');
  assert.match(engine.state.lastPlay?.message ?? '', /kickoff/i);
});

test('OT3 enforces mandatory two-point conversions', () => {
  const engine = new GameEngine('CONV-OT3-MANDATORY');
  engine.startGame();

  (engine as any).enterOvertimePeriod(3);
  engine.state.field.possessionPlayerId = 'home';
  engine.state.field.ballOn = 20;
  (engine as any).syncState();

  forceTouchdownResolution(engine);
  playForcedTouchdown(engine, 'home');

  assert.equal(engine.state.phase, GamePhase.CONVERSION_OFFENSE_SELECT);
  assert.equal(engine.state.conversion?.mandatoryTwoPoint, true);

  const xp = engine.state.players.home.specialActions.find((action) => action.type === 'XP');
  const twoPoint = engine.state.players.home.specialActions.find((action) => action.type === '2PT');
  assert(xp && twoPoint);
  assert.equal(xp.enabled, false);
  assert.equal(xp.reason, 'mandatory_two_point');
  assert.equal(twoPoint.enabled, true);

  const xpAttempt = engine.submitMove('home', xp.id);
  assert.equal(xpAttempt.accepted, false);
  assert.equal(xpAttempt.reason, 'special_not_available');
});

test('OT5 shootout keeps existing no-conversion flow', () => {
  const engine = new GameEngine('CONV-OT5-SHOOTOUT');
  engine.startGame();

  (engine as any).enterOvertimePeriod(5);
  engine.state.field.possessionPlayerId = 'home';
  (engine as any).syncState();

  (engine as any).evaluateMatchup = () => ({
    delta: 1,
    yards: 4,
    message: 'Shootout gain',
    multiplierCard: 'K',
    yardCard: 4,
  });

  const offCard = engine.state.players.home.hand[0]?.id;
  const defCard = engine.state.players.away.hand[0]?.id;
  assert(offCard && defCard);

  engine.submitMove('home', offCard);
  const resolved = engine.submitMove('away', defCard);
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.resolved, true);

  assert.equal(engine.state.phase, GamePhase.RESOLUTION);
  assert.equal(engine.state.conversion, null);
  assert.equal(engine.state.lastPlay?.message.includes('Two-point conversion good.'), true);
});
