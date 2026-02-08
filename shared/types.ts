export type PlayType = 
  | 'SR' // Short Run
  | 'LR' // Long Run
  | 'SP' // Short Pass
  | 'LP' // Long Pass
  | 'TP' // Trick Play
  | 'HM' // Hail Mary
  | 'FG' // Field Goal
  | 'PT' // Punt
  | 'TO' // Timeout
  | 'XP' // Extra Point
  | '2PT'; // Two-Point Attempt

export type ConversionType = 'XP' | '2PT';

export interface Card {
  id: string;
  type: PlayType;
  name: string;
  description?: string;
  isSpecial?: boolean;
}

export interface PlayerHand {
  cards: Card[];
  maxSize: number;
}

export interface SpecialActionState {
  id: string;
  type: PlayType;
  enabled: boolean;
  remaining: number | null;
  reason?: string;
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  COIN_TOSS = 'COIN_TOSS',
  OFFENSE_SELECT = 'OFFENSE_SELECT',
  DEFENSE_SELECT = 'DEFENSE_SELECT',
  CONVERSION_OFFENSE_SELECT = 'CONVERSION_OFFENSE_SELECT',
  CONVERSION_DEFENSE_SELECT = 'CONVERSION_DEFENSE_SELECT',
  CONVERSION_RESOLUTION = 'CONVERSION_RESOLUTION',
  RESOLUTION = 'RESOLUTION',
  GAME_OVER = 'GAME_OVER'
}

export interface PlayResult {
  playCalled: Card;
  defenseCalled: Card;
  delta: number;
  yardsGained: number;
  isTouchdown: boolean;
  isTurnover: boolean;
  isSafety: boolean;
  multiplierCard: string;
  yardCard: number;
  message: string;
  flags?: {
    defPenalty?: boolean;
    zeroSecondPlay?: boolean;
    kickoffTouchback?: boolean;
    kickType?: 'KICKOFF' | 'PUNT' | 'FIELD_GOAL';
    kickDistance?: number;
    returnYards?: number;
    kickResultSpot?: number;
    icedKicker?: boolean;
    conversionType?: ConversionType;
    conversionSuccess?: boolean;
    mandatoryTwoPoint?: boolean;
    otBucketReset?: boolean;
  };
}

export interface ConversionState {
  offenseSide: 'home' | 'away';
  attemptType: ConversionType | null;
  mandatoryTwoPoint: boolean;
}

export interface PlayerState {
  id: string;
  username: string;
  teamName: string;
  score: number;
  timeouts: number;
  hailMaryCount: number;
  canFieldGoal: boolean;
  canPunt: boolean;
  specialActions: SpecialActionState[];
  hand: Card[];
  deckCount: number;
  isHost: boolean;
}

export interface FieldState {
  possessionPlayerId: string;
  ballOn: number;
  down: number;
  toGo: number;
  quarter: number;
  clockSeconds: number;
  isOvertime: boolean;
  overtimePeriod: number | null;
  awaitingZeroSecondPlay: boolean;
}

export interface ServerGameState {
  roomId: string;
  phase: GamePhase;
  players: {
    home: PlayerState;
    away: PlayerState;
  };
  field: FieldState;
  pendingMove: {
    offenseCardId?: string;
    defenseCardId?: string;
  };
  conversion: ConversionState | null;
  lastPlay?: PlayResult;
}

export interface ClientGameState {
  phase: GamePhase;
  myState: PlayerState;
  opponentState: {
    username: string;
    score: number;
    timeouts: number;
    deckCount: number;
    handCount: number;
  };
  field: FieldState;
  conversion: ConversionState | null;
  lastPlay?: PlayResult;
  waitingForOpponent: boolean;
}

export interface JoinGamePayload {
  roomId: string;
  playerToken?: string;
  requestedSeat?: 'home' | 'away';
  quickPlayBot?: boolean;
  botDifficulty?: 'easy' | 'normal';
}

export interface JoinGameAck {
  roomId: string;
  playerToken: string;
  seat: 'home' | 'away';
  rejoined: boolean;
  mode?: 'MULTIPLAYER' | 'BOT';
}
