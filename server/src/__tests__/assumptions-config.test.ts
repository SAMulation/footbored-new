import assert from 'node:assert/strict';
import test from 'node:test';

import { RULE_ASSUMPTIONS } from '../rules/assumptions';

test('rule assumptions config is loaded and frozen', () => {
  assert.equal(typeof RULE_ASSUMPTIONS.version, 'string');
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.kickoff), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.punt), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.fieldGoal), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.fieldGoal.distanceBands), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.conversion), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.overtime), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.balance), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.balance.standardPlay), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.balance.trickPlay), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.balance.hailMary), true);
  assert.equal(Object.isFrozen(RULE_ASSUMPTIONS.balance.botDecision), true);
});

test('field-goal distance bands are monotonic and bounded', () => {
  const bands = RULE_ASSUMPTIONS.fieldGoal.distanceBands;
  assert(bands.length >= 3);

  let lastMax = 0;
  for (const band of bands) {
    assert(band.maxDistance > lastMax);
    assert(band.successRate >= 0 && band.successRate <= 1);
    lastMax = band.maxDistance;
  }
});

test('kick assumptions stay in legal football ranges', () => {
  assert(RULE_ASSUMPTIONS.kickoff.touchbackSpot >= 20 && RULE_ASSUMPTIONS.kickoff.touchbackSpot <= 30);
  assert(RULE_ASSUMPTIONS.kickoff.touchbackRate > 0 && RULE_ASSUMPTIONS.kickoff.touchbackRate < 1);
  assert(RULE_ASSUMPTIONS.kickoff.returnSpotMin < RULE_ASSUMPTIONS.kickoff.returnSpotMax);

  assert(RULE_ASSUMPTIONS.punt.grossYardsMin > 0);
  assert(RULE_ASSUMPTIONS.punt.grossYardsMax > RULE_ASSUMPTIONS.punt.grossYardsMin);
  assert(RULE_ASSUMPTIONS.punt.returnYardsMin >= 0);
  assert(RULE_ASSUMPTIONS.punt.returnYardsMax >= RULE_ASSUMPTIONS.punt.returnYardsMin);

  assert(RULE_ASSUMPTIONS.fieldGoal.icingPenalty > 0);
  assert(RULE_ASSUMPTIONS.fieldGoal.icingPenalty < 1);
  assert(RULE_ASSUMPTIONS.fieldGoal.longShotSuccessRate >= 0);
  assert(RULE_ASSUMPTIONS.fieldGoal.longShotSuccessRate <= 1);

  assert(RULE_ASSUMPTIONS.conversion.xpSuccessRate > 0);
  assert(RULE_ASSUMPTIONS.conversion.xpSuccessRate < 1);
  assert(RULE_ASSUMPTIONS.conversion.twoPointRequiredYards >= 1);
  assert(RULE_ASSUMPTIONS.conversion.twoPointRequiredYards <= 5);

  assert.equal(RULE_ASSUMPTIONS.overtime.refreshPolicy, 'TWO_PERIOD_BUCKET');
  assert(RULE_ASSUMPTIONS.overtime.bucketPeriodSize >= 2);
  assert(RULE_ASSUMPTIONS.overtime.hailMaryPerBucket >= 1);
  assert(RULE_ASSUMPTIONS.overtime.timeoutsPerBucket >= 0);
  assert(RULE_ASSUMPTIONS.overtime.mandatoryTwoPointStartPeriod < RULE_ASSUMPTIONS.overtime.shootoutStartPeriod);

  for (const offset of Object.values(RULE_ASSUMPTIONS.balance.standardPlay.qualityYardOffsets)) {
    assert(Number.isInteger(offset));
    assert(offset >= -5 && offset <= 5);
  }

  for (const weight of Object.values(RULE_ASSUMPTIONS.balance.trickPlay.outcomeWeights)) {
    assert(weight >= 0);
    assert(Number.isFinite(weight));
  }
  for (const weight of Object.values(RULE_ASSUMPTIONS.balance.hailMary.outcomeWeights)) {
    assert(weight >= 0);
    assert(Number.isFinite(weight));
  }

  assert(RULE_ASSUMPTIONS.balance.botDecision.fourthDownFieldGoalMinBallOn >= 40);
  assert(RULE_ASSUMPTIONS.balance.botDecision.fourthDownFieldGoalMinBallOn <= 85);
  assert(RULE_ASSUMPTIONS.balance.botDecision.fourthDownFieldGoalMaxToGo >= 1);
  assert(RULE_ASSUMPTIONS.balance.botDecision.fourthDownFieldGoalMaxToGo <= 15);
  assert(RULE_ASSUMPTIONS.balance.botDecision.fourthDownPuntMinBallOn >= 1);
  assert(RULE_ASSUMPTIONS.balance.botDecision.fourthDownPuntMinBallOn <= 60);
  assert(RULE_ASSUMPTIONS.balance.botDecision.hailMaryToGoThreshold >= 8);
  assert(RULE_ASSUMPTIONS.balance.botDecision.trickPlayToGoThreshold >= 4);
  assert(RULE_ASSUMPTIONS.balance.botDecision.defenseIcingMinBallOn >= 35);
  assert(RULE_ASSUMPTIONS.balance.botDecision.lateGameQuarterThreshold >= 2);
  assert(RULE_ASSUMPTIONS.balance.botDecision.lateGameTwoPointDeficit >= 1);
});
