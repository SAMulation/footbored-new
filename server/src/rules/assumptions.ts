export interface DistanceBand {
  maxDistance: number;
  successRate: number;
}

type PlayQuality = 'B' | 'G' | 'D' | 'O' | 'W';
type TrickPlayOutcomeCode =
  | 'LR_PLUS_5'
  | 'LP_PLUS_5'
  | 'X4_GAIN'
  | 'NEG_X3'
  | 'OWN_PENALTY_15'
  | 'OFFENSE_BIG_PLAY';
type HailMaryOutcomeCode =
  | 'ZERO_GAIN'
  | 'GAIN_20'
  | 'GAIN_40'
  | 'TOUCHDOWN'
  | 'SACK_MINUS_10'
  | 'INTERCEPTION_AT_SPOT';

export interface RuleAssumptions {
  readonly version: string;
  readonly kickoff: {
    readonly touchbackRate: number;
    readonly touchbackSpot: number;
    readonly returnSpotMin: number;
    readonly returnSpotMax: number;
    readonly safetyKickSpot: number;
  };
  readonly punt: {
    readonly grossYardsMin: number;
    readonly grossYardsMax: number;
    readonly returnYardsMin: number;
    readonly returnYardsMax: number;
    readonly touchbackSpot: number;
  };
  readonly fieldGoal: {
    readonly distanceBands: readonly DistanceBand[];
    readonly longShotSuccessRate: number;
    readonly icingPenalty: number;
    readonly missSpotRule: 'line_of_scrimmage' | 'spot_of_kick';
  };
  readonly conversion: {
    readonly xpSuccessRate: number;
    readonly twoPointMode: 'INTERACTIVE_PLAY_CALL';
    readonly twoPointRequiredYards: number;
  };
  readonly overtime: {
    readonly refreshPolicy: 'TWO_PERIOD_BUCKET';
    readonly bucketPeriodSize: number;
    readonly hailMaryPerBucket: number;
    readonly timeoutsPerBucket: number;
    readonly mandatoryTwoPointStartPeriod: number;
    readonly shootoutStartPeriod: number;
  };
  readonly balance: {
    readonly standardPlay: {
      readonly qualityYardOffsets: Readonly<Record<PlayQuality, number>>;
    };
    readonly trickPlay: {
      readonly outcomeWeights: Readonly<Record<TrickPlayOutcomeCode, number>>;
    };
    readonly hailMary: {
      readonly outcomeWeights: Readonly<Record<HailMaryOutcomeCode, number>>;
    };
    readonly botDecision: {
      readonly fourthDownFieldGoalMinBallOn: number;
      readonly fourthDownFieldGoalMaxToGo: number;
      readonly fourthDownPuntMinBallOn: number;
      readonly hailMaryToGoThreshold: number;
      readonly trickPlayToGoThreshold: number;
      readonly defenseIcingMinBallOn: number;
      readonly lateGameTwoPointDeficit: number;
      readonly lateGameQuarterThreshold: number;
    };
  };
}

const FIELD_GOAL_DISTANCE_BANDS: readonly DistanceBand[] = Object.freeze([
  Object.freeze({ maxDistance: 34, successRate: 0.95 }),
  Object.freeze({ maxDistance: 44, successRate: 0.83 }),
  Object.freeze({ maxDistance: 54, successRate: 0.67 }),
  Object.freeze({ maxDistance: 65, successRate: 0.42 }),
]);

export const RULE_ASSUMPTIONS: RuleAssumptions = Object.freeze({
  version: '2026-02-08-balance-ux-polish-v1',
  kickoff: Object.freeze({
    touchbackRate: 0.34,
    touchbackSpot: 25,
    returnSpotMin: 18,
    returnSpotMax: 34,
    safetyKickSpot: 50,
  }),
  punt: Object.freeze({
    grossYardsMin: 36,
    grossYardsMax: 52,
    returnYardsMin: 0,
    returnYardsMax: 18,
    touchbackSpot: 20,
  }),
  fieldGoal: Object.freeze({
    distanceBands: FIELD_GOAL_DISTANCE_BANDS,
    longShotSuccessRate: 0.08,
    icingPenalty: 0.12,
    missSpotRule: 'line_of_scrimmage',
  }),
  conversion: Object.freeze({
    xpSuccessRate: 0.93,
    twoPointMode: 'INTERACTIVE_PLAY_CALL',
    twoPointRequiredYards: 2,
  }),
  overtime: Object.freeze({
    refreshPolicy: 'TWO_PERIOD_BUCKET',
    bucketPeriodSize: 2,
    hailMaryPerBucket: 2,
    timeoutsPerBucket: 1,
    mandatoryTwoPointStartPeriod: 3,
    shootoutStartPeriod: 5,
  }),
  balance: Object.freeze({
    standardPlay: Object.freeze({
      // Neutral by default: no quality-based yard offset unless explicitly tuned.
      qualityYardOffsets: Object.freeze({ B: 0, G: 0, D: 0, O: 0, W: 0 }),
    }),
    trickPlay: Object.freeze({
      // Neutral by default: all outcomes remain uniformly weighted.
      outcomeWeights: Object.freeze({
        LR_PLUS_5: 1,
        LP_PLUS_5: 1,
        X4_GAIN: 1,
        NEG_X3: 1,
        OWN_PENALTY_15: 1,
        OFFENSE_BIG_PLAY: 1,
      }),
    }),
    hailMary: Object.freeze({
      // Neutral by default: all outcomes remain uniformly weighted.
      outcomeWeights: Object.freeze({
        ZERO_GAIN: 1,
        GAIN_20: 1,
        GAIN_40: 1,
        TOUCHDOWN: 1,
        SACK_MINUS_10: 1,
        INTERCEPTION_AT_SPOT: 1,
      }),
    }),
    botDecision: Object.freeze({
      fourthDownFieldGoalMinBallOn: 60,
      fourthDownFieldGoalMaxToGo: 8,
      fourthDownPuntMinBallOn: 25,
      hailMaryToGoThreshold: 14,
      trickPlayToGoThreshold: 8,
      defenseIcingMinBallOn: 55,
      lateGameTwoPointDeficit: 2,
      lateGameQuarterThreshold: 4,
    }),
  }),
});
