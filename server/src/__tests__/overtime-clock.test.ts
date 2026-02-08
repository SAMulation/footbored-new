import assert from 'node:assert/strict';
import test from 'node:test';

import { GameEngine } from '../engine';

test('OT coin toss first side alternates by overtime period', () => {
  const engine = new GameEngine('OT-ALT');
  engine.startGame();

  engine.state.players.home.score = 10;
  engine.state.players.away.score = 10;
  engine.state.field.quarter = 4;

  (engine as any).handleEndOfPeriod();

  assert.equal(engine.state.field.isOvertime, true);
  assert.equal(engine.state.field.overtimePeriod, 1);

  const firstPeriodStarter = engine.state.field.possessionPlayerId;
  (engine as any).finishOvertimePossession(firstPeriodStarter);
  assert.notEqual(engine.state.field.possessionPlayerId, firstPeriodStarter);

  (engine as any).finishOvertimePossession(engine.state.field.possessionPlayerId);
  assert.equal(engine.state.field.overtimePeriod, 2);
  assert.equal(engine.state.field.possessionPlayerId, firstPeriodStarter === 'home' ? 'away' : 'home');
});

test('OT stage rules enforce shootout restrictions from period 5', () => {
  const engine = new GameEngine('OT-STAGES');
  engine.startGame();

  (engine as any).enterOvertimePeriod(3);
  assert.equal(engine.state.field.overtimePeriod, 3);
  assert.equal(engine.state.field.toGo, 10);

  (engine as any).enterOvertimePeriod(5);
  assert.equal(engine.state.field.overtimePeriod, 5);
  assert.equal(engine.state.field.toGo, 3);

  const offense = engine.state.field.possessionPlayerId === 'away' ? 'away' : 'home';
  const blockedCard = engine.state.players[offense].hand.find((card) => card.type === 'HM' || card.type === 'TP');
  if (blockedCard) {
    const result = engine.submitMove(offense, blockedCard.id);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'shootout_restriction');
  }
});

test('OT resource buckets refresh HM and timeouts at OT1/OT3 only', () => {
  const engine = new GameEngine('OT-HM-REFRESH');
  engine.startGame();

  engine.state.players.home.hailMaryCount = 0;
  engine.state.players.away.hailMaryCount = 0;
  engine.state.players.home.timeouts = 0;
  engine.state.players.away.timeouts = 0;

  (engine as any).enterOvertimePeriod(1);

  assert.equal(engine.state.players.home.hailMaryCount, 2);
  assert.equal(engine.state.players.away.hailMaryCount, 2);
  assert.equal(engine.state.players.home.timeouts, 1);
  assert.equal(engine.state.players.away.timeouts, 1);

  engine.state.players.home.hailMaryCount = 0;
  engine.state.players.away.hailMaryCount = 0;
  engine.state.players.home.timeouts = 0;
  engine.state.players.away.timeouts = 0;

  (engine as any).enterOvertimePeriod(2);
  assert.equal(engine.state.players.home.hailMaryCount, 0);
  assert.equal(engine.state.players.away.hailMaryCount, 0);
  assert.equal(engine.state.players.home.timeouts, 0);
  assert.equal(engine.state.players.away.timeouts, 0);

  (engine as any).enterOvertimePeriod(3);
  assert.equal(engine.state.players.home.hailMaryCount, 2);
  assert.equal(engine.state.players.away.hailMaryCount, 2);
  assert.equal(engine.state.players.home.timeouts, 1);
  assert.equal(engine.state.players.away.timeouts, 1);
});

test('OT bucket reset flag is surfaced on first play after reset', () => {
  const engine = new GameEngine('OT-BUCKET-FLAG');
  engine.startGame();

  (engine as any).enterOvertimePeriod(1);
  (engine as any).evaluateMatchup = () => ({
    delta: 0,
    yards: 0,
    message: 'Bucket check play',
    multiplierCard: 'K',
    yardCard: 0,
  });

  const offCard = engine.state.players.home.hand[0]?.id;
  const defCard = engine.state.players.away.hand[0]?.id;
  assert(offCard && defCard);

  engine.submitMove('home', offCard);
  const firstResolved = engine.submitMove('away', defCard);
  assert.equal(firstResolved.accepted, true);
  assert.equal(firstResolved.resolved, true);
  assert.equal(engine.state.lastPlay?.flags?.otBucketReset, true);

  engine.advanceAfterResolution();
  const offCard2 = engine.state.players.home.hand[0]?.id;
  const defCard2 = engine.state.players.away.hand[0]?.id;
  assert(offCard2 && defCard2);

  engine.submitMove('home', offCard2);
  const secondResolved = engine.submitMove('away', defCard2);
  assert.equal(secondResolved.accepted, true);
  assert.equal(secondResolved.resolved, true);
  assert.equal(engine.state.lastPlay?.flags?.otBucketReset, false);
});

test('zero-second play end/extend logic supports def penalty and touchback flags', () => {
  const engine = new GameEngine('ZERO-SECOND');
  engine.startGame();

  engine.state.field.quarter = 1;
  engine.state.field.clockSeconds = 0;
  engine.state.field.awaitingZeroSecondPlay = true;

  const defPenaltyPlay = (engine as any).tickGameClock({ defPenalty: true });
  assert.equal(defPenaltyPlay, true);
  assert.equal(engine.state.field.quarter, 1);
  assert.equal(engine.state.field.awaitingZeroSecondPlay, true);

  const endedOnFollowup = (engine as any).tickGameClock();
  assert.equal(endedOnFollowup, true);
  assert.equal(engine.state.field.quarter, 2);
  assert.equal(engine.state.field.clockSeconds, 900);

  engine.state.field.quarter = 2;
  engine.state.field.clockSeconds = 0;
  engine.state.field.awaitingZeroSecondPlay = true;

  (engine as any).tickGameClock({ kickoffTouchback: true });
  assert.equal(engine.state.field.quarter, 2);
  assert.equal(engine.state.field.awaitingZeroSecondPlay, true);
});
