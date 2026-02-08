import { Card, GamePhase, PlayType, PlayerState, ServerGameState } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import { Deck } from './models/Deck';
import { Hand } from './models/Hand';
import {
  HAIL_MARY_OUTCOME_TABLE,
  HailMaryOutcomeCode,
  MULTIPLIER_SEQUENCE,
  MULTIPLIER_TABLE,
  OPEN_RULE_IDS,
  PlayQuality,
  QUALITY_DELTA,
  STANDARD_QUALITY_MATRIX,
  StandardPlayType,
  TRICK_PLAY_OUTCOME_TABLE,
  TrickPlayOutcomeCode,
  YARD_CARD_SEQUENCE,
} from './rules/canonical';

export type TeamSide = 'home' | 'away';

export interface SubmitMoveResult {
  accepted: boolean;
  resolved: boolean;
  reason?: string;
}

interface MatchupResult {
  delta: number;
  yards: number;
  message: string;
  keepOffenseCard?: boolean;
  keepDefenseCard?: boolean;
  forceTurnover?: boolean;
  noDownProgress?: boolean;
  noClockTick?: boolean;
  fieldGoalAttempt?: boolean;
  multiplierCard?: string;
  yardCard?: number;
}

const FIELD_GOAL_POINTS = 3;
const PLAY_CLOCK_TICK_SECONDS = 30;
const QUARTER_SECONDS = 900;
const MIDFIELD_SPOT = 50;
const STANDARD_PLAYS: StandardPlayType[] = ['SR', 'LR', 'SP', 'LP'];

export class RuleNotImplementedError extends Error {
  constructor(public readonly ruleId: string, message: string) {
    super(message);
    this.name = 'RuleNotImplementedError';
  }
}

export function assertRuleImplemented(ruleId: string) {
  if (OPEN_RULE_IDS.includes(ruleId as (typeof OPEN_RULE_IDS)[number])) {
    throw new RuleNotImplementedError(ruleId, `Rule ${ruleId} is marked OPEN in FOOTBORED_RULES.md`);
  }
}

function isStandardPlay(type: PlayType): type is StandardPlayType {
  return STANDARD_PLAYS.includes(type as StandardPlayType);
}

function hashToIndex(seed: string, max: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % max;
}

export class GameEngine {
  state: ServerGameState;

  private deckHome = new Deck();
  private deckAway = new Deck();
  private handHome = new Hand();
  private handAway = new Hand();

  constructor(roomId: string) {
    this.state = {
      roomId,
      phase: GamePhase.LOBBY,
      players: {
        home: this.createPlayer('Home Team'),
        away: this.createPlayer('Away Team'),
      },
      field: {
        possessionPlayerId: 'home',
        ballOn: 20,
        down: 1,
        toGo: 10,
        quarter: 1,
        clockSeconds: QUARTER_SECONDS,
      },
      pendingMove: {},
    };

    this.dealInitialHands();
    this.syncState();
  }

  public startGame() {
    this.state.phase = this.getSelectionPhase();
    this.syncState();
  }

  public submitMove(side: TeamSide, cardId: string): SubmitMoveResult {
    if (this.state.phase !== GamePhase.OFFENSE_SELECT && this.state.phase !== GamePhase.DEFENSE_SELECT) {
      return { accepted: false, resolved: false, reason: 'not_select_phase' };
    }

    const offenseSide = this.getOffenseSide();
    const isOffense = side === offenseSide;
    const slot = isOffense ? 'offenseCardId' : 'defenseCardId';
    const hand = this.getHandForSide(side);

    if (!hand.hasCard(cardId)) {
      return { accepted: false, resolved: false, reason: 'card_not_in_hand' };
    }

    if (this.state.pendingMove[slot]) {
      return { accepted: false, resolved: false, reason: 'already_submitted' };
    }

    this.state.pendingMove[slot] = cardId;

    if (this.state.pendingMove.offenseCardId && this.state.pendingMove.defenseCardId) {
      this.resolveTurn();
      return { accepted: true, resolved: true };
    }

    return { accepted: true, resolved: false };
  }

  public advanceAfterResolution(): void {
    if (this.state.phase !== GamePhase.RESOLUTION) {
      return;
    }

    if (this.state.field.quarter >= 4 && this.state.field.clockSeconds <= 0) {
      this.state.phase = GamePhase.GAME_OVER;
      return;
    }

    this.state.phase = this.getSelectionPhase();
  }

  public resetForRematch(): void {
    const homeId = this.state.players.home.id;
    const awayId = this.state.players.away.id;

    this.deckHome = new Deck();
    this.deckAway = new Deck();
    this.handHome = new Hand();
    this.handAway = new Hand();

    this.state.field = {
      possessionPlayerId: 'home',
      ballOn: 20,
      down: 1,
      toGo: 10,
      quarter: 1,
      clockSeconds: QUARTER_SECONDS,
    };
    this.state.pendingMove = {};
    this.state.lastPlay = undefined;
    this.state.phase = GamePhase.LOBBY;

    this.state.players.home = {
      ...this.createPlayer('Home Team'),
      id: homeId,
    };
    this.state.players.away = {
      ...this.createPlayer('Away Team'),
      id: awayId,
    };

    this.dealInitialHands();
    this.startGame();
  }

  private resolveTurn(): void {
    const { offenseCardId, defenseCardId } = this.state.pendingMove;
    const offenseSide = this.getOffenseSide();
    const defenseSide = this.getDefenseSide();
    const offenseHand = this.getHandForSide(offenseSide);
    const defenseHand = this.getHandForSide(defenseSide);

    const offenseCard = offenseHand.playCard(offenseCardId!);
    const defenseCard = defenseHand.playCard(defenseCardId!);

    if (!offenseCard || !defenseCard) {
      this.state.pendingMove = {};
      this.state.lastPlay = undefined;
      return;
    }

    let outcome: MatchupResult;
    try {
      outcome = this.evaluateMatchup(offenseCard, defenseCard, offenseSide);
    } catch (error) {
      if (error instanceof RuleNotImplementedError) {
        outcome = {
          delta: 0,
          yards: 0,
          message: `OPEN RULE BLOCKED (${error.ruleId}): ${error.message}`,
          keepOffenseCard: true,
          keepDefenseCard: true,
          noDownProgress: true,
          multiplierCard: 'OPEN',
          yardCard: 0,
        };
      } else {
        throw error;
      }
    }

    if (outcome.keepOffenseCard) {
      offenseHand.returnCardToHand(offenseCard);
    }
    if (outcome.keepDefenseCard) {
      defenseHand.returnCardToHand(defenseCard);
    }

    const isTouchdown = this.applyBallAndPossession(outcome.yards, offenseSide, outcome);
    const isTurnover = outcome.forceTurnover || this.applyDownAndDistance(offenseSide, outcome, isTouchdown);

    if (!outcome.noClockTick) {
      this.tickGameClock();
    }

    this.state.lastPlay = {
      playCalled: offenseCard,
      defenseCalled: defenseCard,
      delta: outcome.delta,
      yardsGained: outcome.yards,
      isTouchdown,
      isTurnover,
      isSafety: false,
      multiplierCard: outcome.multiplierCard ?? 'N/A',
      yardCard: outcome.yardCard ?? Math.abs(outcome.yards),
      message: outcome.message,
    };

    offenseHand.refill(this.getDeckForSide(offenseSide));
    defenseHand.refill(this.getDeckForSide(defenseSide));
    this.syncState();

    this.state.pendingMove = {};
    if (this.state.phase !== GamePhase.GAME_OVER) {
      this.state.phase = GamePhase.RESOLUTION;
    }
  }

  private evaluateMatchup(offenseCard: Card, defenseCard: Card, offenseSide: TeamSide): MatchupResult {
    const { ballOn, down } = this.state.field;

    if (offenseCard.type === 'TO') {
      return {
        delta: 0,
        yards: 0,
        message: 'Timeout called. No play run.',
        keepOffenseCard: true,
        keepDefenseCard: true,
        noDownProgress: true,
        noClockTick: true,
        multiplierCard: 'TO',
        yardCard: 0,
      };
    }

    if (offenseCard.type === 'PT') {
      if (down !== 4) {
        return {
          delta: -2,
          yards: 0,
          message: 'Illegal punt on non-4th down. Turnover on downs.',
          forceTurnover: true,
          noDownProgress: true,
          multiplierCard: 'PT',
          yardCard: 0,
        };
      }

      return {
        delta: 0,
        yards: 35,
        message: 'Punt for 35 yards.',
        forceTurnover: true,
        keepDefenseCard: true,
        noDownProgress: true,
        multiplierCard: 'PT',
        yardCard: 35,
      };
    }

    if (offenseCard.type === 'FG') {
      const distance = offenseSide === 'home' ? 100 - ballOn : ballOn;
      const defensePenalty = ['TP', 'HM'].includes(defenseCard.type) ? 5 : 0;
      const kickDifficulty = Math.max(0, distance - 35);
      const kickScore = 70 - kickDifficulty - defensePenalty;
      const made = kickScore >= 45;

      if (made) {
        this.state.players[offenseSide].score += FIELD_GOAL_POINTS;
        this.resetForKickoff(this.getOpponentSide(offenseSide));
        return {
          delta: 1,
          yards: 0,
          message: `Field goal good from ${distance} yards.`,
          fieldGoalAttempt: true,
          noDownProgress: true,
          multiplierCard: 'FG',
          yardCard: 0,
        };
      }

      return {
        delta: -1,
        yards: 0,
        message: `Field goal missed from ${distance} yards.`,
        forceTurnover: true,
        noDownProgress: true,
        multiplierCard: 'FG',
        yardCard: 0,
      };
    }

    const turnSeed = this.createTurnSeed(offenseCard.type, defenseCard.type);

    if (offenseCard.type === 'TP') {
      return this.resolveTrickPlay(turnSeed);
    }

    if (offenseCard.type === 'HM') {
      return this.resolveHailMary(turnSeed);
    }

    if (isStandardPlay(offenseCard.type) && isStandardPlay(defenseCard.type)) {
      return this.resolveStandardPlay(offenseCard.type, defenseCard.type, turnSeed);
    }

    // Standard offense against non-standard defense defaults to neutral quality.
    if (isStandardPlay(offenseCard.type)) {
      return this.resolveStandardPlay(offenseCard.type, offenseCard.type, `${turnSeed}|fallback`);
    }

    return {
      delta: 0,
      yards: 0,
      message: `${offenseCard.name} vs ${defenseCard.name}: no gain.`,
      multiplierCard: 'N/A',
      yardCard: 0,
    };
  }

  private resolveStandardPlay(offense: StandardPlayType, defense: StandardPlayType, seed: string): MatchupResult {
    const quality = STANDARD_QUALITY_MATRIX[offense][defense];
    const multiplierCard = MULTIPLIER_SEQUENCE[hashToIndex(`${seed}|mult`, MULTIPLIER_SEQUENCE.length)];
    const multiplier = MULTIPLIER_TABLE[multiplierCard][quality];

    let yardCard = YARD_CARD_SEQUENCE[hashToIndex(`${seed}|yard`, YARD_CARD_SEQUENCE.length)];
    if (!Number.isInteger(yardCard * multiplier) && yardCard % 2 !== 0) {
      yardCard = (yardCard + 1) % YARD_CARD_SEQUENCE.length;
    }

    if (!Number.isInteger(yardCard * multiplier)) {
      assertRuleImplemented('R-MULT-002');
    }

    let yards = yardCard * multiplier;
    let forceTurnover = false;

    if (offense === defense) {
      const branchFlip = hashToIndex(`${seed}|same-branch`, 2) === 1;
      if (multiplierCard === 'K') {
        if (branchFlip) {
          yards = 25;
        } else {
          yards = -10;
          forceTurnover = true;
        }
      } else if (multiplierCard === 'Q') {
        yards = branchFlip ? yards * 3 : 0;
      } else if (multiplierCard === 'J') {
        yards = branchFlip ? 0 : yards * -3;
      } else {
        if (branchFlip) {
          forceTurnover = true;
        }
        yards = 0;
      }
    }

    return {
      delta: QUALITY_DELTA[quality],
      yards,
      forceTurnover,
      message: `${offense} vs ${defense} -> ${quality} (${multiplierCard}) for ${yards >= 0 ? '+' : ''}${yards} yards.`,
      multiplierCard,
      yardCard,
    };
  }

  private resolveTrickPlay(seed: string): MatchupResult {
    const outcome = TRICK_PLAY_OUTCOME_TABLE[hashToIndex(`${seed}|tp`, TRICK_PLAY_OUTCOME_TABLE.length)];
    return this.resolveTrickOutcome(outcome);
  }

  private resolveTrickOutcome(outcome: TrickPlayOutcomeCode): MatchupResult {
    if (outcome === 'OWN_PENALTY_15') {
      assertRuleImplemented('R-TP-002');
    }

    if (outcome === 'LR_PLUS_5') {
      return {
        delta: 2,
        yards: 11,
        message: 'Trick play hit: Long Run +5 equivalent.',
        multiplierCard: 'TP',
        yardCard: 11,
      };
    }

    if (outcome === 'LP_PLUS_5') {
      return {
        delta: 2,
        yards: 17,
        message: 'Trick play hit: Long Pass +5 equivalent.',
        multiplierCard: 'TP',
        yardCard: 17,
      };
    }

    if (outcome === 'X4_GAIN') {
      return {
        delta: 3,
        yards: 20,
        message: 'Trick play spike: x4 gain outcome.',
        multiplierCard: 'TP',
        yardCard: 20,
      };
    }

    if (outcome === 'NEG_X3') {
      return {
        delta: -3,
        yards: -12,
        message: 'Trick play blown up: -3x outcome.',
        multiplierCard: 'TP',
        yardCard: 12,
      };
    }

    return {
      delta: 3,
      yards: 25,
      message: 'Trick play jackpot: offense big play.',
      multiplierCard: 'TP',
      yardCard: 25,
    };
  }

  private resolveHailMary(seed: string): MatchupResult {
    const outcome = HAIL_MARY_OUTCOME_TABLE[hashToIndex(`${seed}|hm`, HAIL_MARY_OUTCOME_TABLE.length)];
    return this.resolveHailMaryOutcome(outcome);
  }

  private resolveHailMaryOutcome(outcome: HailMaryOutcomeCode): MatchupResult {
    if (outcome === 'ZERO_GAIN') {
      return {
        delta: -1,
        yards: 0,
        message: 'Hail Mary falls incomplete.',
        multiplierCard: 'HM',
        yardCard: 0,
      };
    }

    if (outcome === 'GAIN_20') {
      return {
        delta: 1,
        yards: 20,
        message: 'Hail Mary connects for +20.',
        multiplierCard: 'HM',
        yardCard: 20,
      };
    }

    if (outcome === 'GAIN_40') {
      return {
        delta: 2,
        yards: 40,
        message: 'Hail Mary bomb for +40.',
        multiplierCard: 'HM',
        yardCard: 40,
      };
    }

    if (outcome === 'TOUCHDOWN') {
      return {
        delta: 3,
        yards: 100,
        message: 'Hail Mary touchdown outcome.',
        multiplierCard: 'HM',
        yardCard: 100,
      };
    }

    if (outcome === 'SACK_MINUS_10') {
      return {
        delta: -2,
        yards: -10,
        message: 'Hail Mary sack for -10.',
        multiplierCard: 'HM',
        yardCard: 10,
      };
    }

    return {
      delta: -3,
      yards: 0,
      forceTurnover: true,
      message: 'Hail Mary intercepted at the spot.',
      multiplierCard: 'HM',
      yardCard: 0,
    };
  }

  private createTurnSeed(offenseType: PlayType, defenseType: PlayType): string {
    const { quarter, clockSeconds, down, toGo, ballOn } = this.state.field;
    return [
      this.state.roomId,
      quarter,
      clockSeconds,
      down,
      toGo,
      ballOn,
      offenseType,
      defenseType,
    ].join('|');
  }

  private applyBallAndPossession(yards: number, offenseSide: TeamSide, outcome: MatchupResult): boolean {
    if (outcome.fieldGoalAttempt || offenseSide !== this.getOffenseSide()) {
      return false;
    }

    const direction = offenseSide === 'home' ? 1 : -1;
    const signedYards = yards * direction;

    this.state.field.ballOn += signedYards;

    if (offenseSide === 'home' && this.state.field.ballOn >= 100) {
      this.state.players.home.score += GAME_CONFIG.TOUCHDOWN_POINTS;
      this.resetForKickoff('away');
      return true;
    }

    if (offenseSide === 'away' && this.state.field.ballOn <= 0) {
      this.state.players.away.score += GAME_CONFIG.TOUCHDOWN_POINTS;
      this.resetForKickoff('home');
      return true;
    }

    this.state.field.ballOn = Math.max(0, Math.min(100, this.state.field.ballOn));
    return false;
  }

  private applyDownAndDistance(offenseSide: TeamSide, outcome: MatchupResult, isTouchdown: boolean): boolean {
    if (isTouchdown || outcome.noDownProgress) {
      if (outcome.forceTurnover) {
        this.flipPossession();
        return true;
      }
      return false;
    }

    this.state.field.down += 1;
    this.state.field.toGo -= outcome.yards;

    if (this.state.field.toGo <= 0) {
      this.state.field.down = 1;
      this.state.field.toGo = 10;
      return false;
    }

    if (this.state.field.down > 4 || outcome.forceTurnover) {
      this.flipPossession();
      return true;
    }

    const currentOffense = this.getOffenseSide();
    if (currentOffense !== offenseSide) {
      return true;
    }

    return false;
  }

  private tickGameClock() {
    this.state.field.clockSeconds -= PLAY_CLOCK_TICK_SECONDS;

    if (this.state.field.clockSeconds > 0) {
      return;
    }

    if (this.state.field.quarter < 4) {
      this.state.field.quarter += 1;
      this.state.field.clockSeconds = QUARTER_SECONDS;
      return;
    }

    this.state.field.clockSeconds = 0;
    this.state.phase = GamePhase.GAME_OVER;
  }

  private flipPossession() {
    this.state.field.possessionPlayerId = this.getOpponentSide(this.getOffenseSide());
    this.state.field.down = 1;
    this.state.field.toGo = 10;
  }

  private resetForKickoff(receivingSide: TeamSide) {
    this.state.field.ballOn = MIDFIELD_SPOT;
    this.state.field.possessionPlayerId = receivingSide;
    this.state.field.down = 1;
    this.state.field.toGo = 10;
  }

  private getSelectionPhase(): GamePhase {
    return GamePhase.OFFENSE_SELECT;
  }

  private getOffenseSide(): TeamSide {
    return this.state.field.possessionPlayerId === 'away' ? 'away' : 'home';
  }

  private getDefenseSide(): TeamSide {
    return this.getOpponentSide(this.getOffenseSide());
  }

  private getOpponentSide(side: TeamSide): TeamSide {
    return side === 'home' ? 'away' : 'home';
  }

  private getHandForSide(side: TeamSide): Hand {
    return side === 'home' ? this.handHome : this.handAway;
  }

  private getDeckForSide(side: TeamSide): Deck {
    return side === 'home' ? this.deckHome : this.deckAway;
  }

  private syncState() {
    this.state.players.home.hand = this.handHome.toState().cards;
    this.state.players.away.hand = this.handAway.toState().cards;
    this.state.players.home.deckCount = this.deckHome.count();
    this.state.players.away.deckCount = this.deckAway.count();
  }

  private dealInitialHands() {
    this.handHome.refill(this.deckHome);
    this.handAway.refill(this.deckAway);
  }

  private createPlayer(name: string): PlayerState {
    return {
      id: name.toLowerCase(),
      username: name,
      teamName: name,
      score: 0,
      timeouts: 3,
      hailMaryCount: 3,
      canFieldGoal: true,
      canPunt: true,
      hand: [],
      deckCount: GAME_CONFIG.DECK_SIZE,
      isHost: false,
    };
  }
}

export function resolvePlayMatchup(offType: PlayType, defType: PlayType): { delta: number; yards: number } {
  if (isStandardPlay(offType) && isStandardPlay(defType)) {
    const quality: PlayQuality = STANDARD_QUALITY_MATRIX[offType][defType];
    const multiplier = MULTIPLIER_TABLE.K[quality];
    const yardCard = 4;
    return {
      delta: QUALITY_DELTA[quality],
      yards: yardCard * multiplier,
    };
  }

  if (offType === 'PT') {
    return { delta: 0, yards: 35 };
  }

  if (offType === 'FG' || offType === 'TO') {
    return { delta: 0, yards: 0 };
  }

  if (offType === 'HM') {
    return { delta: 1, yards: 20 };
  }

  if (offType === 'TP') {
    return { delta: 2, yards: 11 };
  }

  return { delta: 0, yards: 0 };
}
