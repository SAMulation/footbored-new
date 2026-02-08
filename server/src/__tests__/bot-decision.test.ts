import assert from 'node:assert/strict';
import test from 'node:test';

import { GamePhase, PlayType } from '../../../shared/types';
import { chooseBotSpecialType } from '../index';

function hasSpecial(types: PlayType[]) {
  const set = new Set(types);
  return (type: PlayType) => set.has(type);
}

test('bot prefers field goal on 4th down in scoring range and manageable distance', () => {
  const choice = chooseBotSpecialType({
    difficulty: 'normal',
    phase: GamePhase.OFFENSE_SELECT,
    isOffense: true,
    field: { down: 4, toGo: 5, ballOn: 65, quarter: 2, isOvertime: false },
    conversionMandatoryTwoPoint: false,
    scoreDeficit: 0,
    hasSpecial: hasSpecial(['FG', 'PT', 'TP']),
  });

  assert.equal(choice, 'FG');
});

test('bot punts on 4th down when FG is not preferred and punt is available', () => {
  const choice = chooseBotSpecialType({
    difficulty: 'normal',
    phase: GamePhase.OFFENSE_SELECT,
    isOffense: true,
    field: { down: 4, toGo: 12, ballOn: 45, quarter: 2, isOvertime: false },
    conversionMandatoryTwoPoint: false,
    scoreDeficit: 0,
    hasSpecial: hasSpecial(['PT', 'TP']),
  });

  assert.equal(choice, 'PT');
});

test('bot uses hail mary on long-distance downs when available', () => {
  const choice = chooseBotSpecialType({
    difficulty: 'normal',
    phase: GamePhase.OFFENSE_SELECT,
    isOffense: true,
    field: { down: 2, toGo: 16, ballOn: 40, quarter: 3, isOvertime: false },
    conversionMandatoryTwoPoint: false,
    scoreDeficit: 0,
    hasSpecial: hasSpecial(['HM', 'TP']),
  });

  assert.equal(choice, 'HM');
});

test('defense bot tries icing timeout on long 4th down in kicking range', () => {
  const choice = chooseBotSpecialType({
    difficulty: 'normal',
    phase: GamePhase.DEFENSE_SELECT,
    isOffense: false,
    field: { down: 4, toGo: 6, ballOn: 60, quarter: 4, isOvertime: false },
    conversionMandatoryTwoPoint: false,
    scoreDeficit: 0,
    hasSpecial: hasSpecial(['TO', 'TP']),
  });

  assert.equal(choice, 'TO');
});

test('late-game conversion choice prefers 2PT when trailing by configured deficit', () => {
  const choice = chooseBotSpecialType({
    difficulty: 'normal',
    phase: GamePhase.CONVERSION_OFFENSE_SELECT,
    isOffense: true,
    field: { down: 1, toGo: 2, ballOn: 98, quarter: 4, isOvertime: false },
    conversionMandatoryTwoPoint: false,
    scoreDeficit: 2,
    hasSpecial: hasSpecial(['XP', '2PT']),
  });

  assert.equal(choice, '2PT');
});

test('mandatory conversion forces 2PT selection', () => {
  const choice = chooseBotSpecialType({
    difficulty: 'normal',
    phase: GamePhase.CONVERSION_OFFENSE_SELECT,
    isOffense: true,
    field: { down: 1, toGo: 2, ballOn: 98, quarter: 6, isOvertime: true },
    conversionMandatoryTwoPoint: true,
    scoreDeficit: 0,
    hasSpecial: hasSpecial(['XP', '2PT']),
  });

  assert.equal(choice, '2PT');
});
