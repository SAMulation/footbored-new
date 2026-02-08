import { PlayType } from '../../../shared/types';

export type StandardPlayType = Extract<PlayType, 'SR' | 'LR' | 'SP' | 'LP'>;
export type PlayQuality = 'B' | 'G' | 'D' | 'O' | 'W';
export type MultiplierRank = 'K' | 'Q' | 'J' | '10';

export const OPEN_RULE_IDS = [
  'R-DECK-005',
  'R-MULT-002',
  'R-SAME-003',
  'R-TP-002',
  'R-TP-003',
  'R-FLD-003',
  'R-FLD-004',
] as const;

export const STANDARD_QUALITY_MATRIX: Record<StandardPlayType, Record<StandardPlayType, PlayQuality>> = {
  SR: { SR: 'W', LR: 'D', SP: 'D', LP: 'G' },
  LR: { SR: 'G', LR: 'O', SP: 'B', LP: 'G' },
  SP: { SR: 'D', LR: 'G', SP: 'W', LP: 'D' },
  LP: { SR: 'B', LR: 'G', SP: 'G', LP: 'O' },
};

export const MULTIPLIER_TABLE: Record<MultiplierRank, Record<PlayQuality, number>> = {
  K: { B: 4.0, G: 3.0, D: 2.0, O: 1.5, W: 1.0 },
  Q: { B: 3.0, G: 2.0, D: 1.0, O: 1.0, W: 0.5 },
  J: { B: 2.0, G: 1.0, D: 0.5, O: 0.0, W: 0.0 },
  '10': { B: 0.0, G: 0.0, D: 0.0, O: -1.0, W: -1.0 },
};

export const MULTIPLIER_SEQUENCE: MultiplierRank[] = ['K', 'Q', 'J', '10'];
export const YARD_CARD_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type TrickPlayOutcomeCode =
  | 'LR_PLUS_5'
  | 'LP_PLUS_5'
  | 'X4_GAIN'
  | 'NEG_X3'
  | 'OWN_PENALTY_15'
  | 'OFFENSE_BIG_PLAY';

export const TRICK_PLAY_OUTCOME_TABLE: TrickPlayOutcomeCode[] = [
  'LR_PLUS_5',
  'LP_PLUS_5',
  'X4_GAIN',
  'NEG_X3',
  'OWN_PENALTY_15',
  'OFFENSE_BIG_PLAY',
];

export type HailMaryOutcomeCode =
  | 'ZERO_GAIN'
  | 'GAIN_20'
  | 'GAIN_40'
  | 'TOUCHDOWN'
  | 'SACK_MINUS_10'
  | 'INTERCEPTION_AT_SPOT';

export const HAIL_MARY_OUTCOME_TABLE: HailMaryOutcomeCode[] = [
  'ZERO_GAIN',
  'GAIN_20',
  'GAIN_40',
  'TOUCHDOWN',
  'SACK_MINUS_10',
  'INTERCEPTION_AT_SPOT',
];

export const QUALITY_DELTA: Record<PlayQuality, number> = {
  B: 2,
  G: 1,
  D: 0,
  O: -1,
  W: -2,
};
