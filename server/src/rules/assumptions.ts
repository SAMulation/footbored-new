export interface DistanceBand {
  maxDistance: number;
  successRate: number;
}

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
}

const FIELD_GOAL_DISTANCE_BANDS: readonly DistanceBand[] = Object.freeze([
  Object.freeze({ maxDistance: 34, successRate: 0.95 }),
  Object.freeze({ maxDistance: 44, successRate: 0.83 }),
  Object.freeze({ maxDistance: 54, successRate: 0.67 }),
  Object.freeze({ maxDistance: 65, successRate: 0.42 }),
]);

export const RULE_ASSUMPTIONS: RuleAssumptions = Object.freeze({
  version: '2026-02-08-conversion-ot-bucket-v1',
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
});
