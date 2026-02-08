import { Card, GamePhase, PlayType, PlayerState, ServerGameState, SpecialActionState } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import { Deck } from './models/Deck';
import { Hand } from './models/Hand';
import {
  COLLEGE_OVERTIME_CONFIG,
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
import { RULE_ASSUMPTIONS } from './rules/assumptions';

export type TeamSide = 'home' | 'away';

export interface SubmitMoveResult {
  accepted: boolean;
  resolved: boolean;
  reason?: string;
}

interface MatchupFlags {
  defPenalty?: boolean;
  kickoffTouchback?: boolean;
  kickType?: 'KICKOFF' | 'PUNT' | 'FIELD_GOAL';
  kickDistance?: number;
  returnYards?: number;
  kickResultSpot?: number;
  icedKicker?: boolean;
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
  flags?: MatchupFlags;
  autoFirstDown?: boolean;
}

interface BallResolution {
  touchdown: boolean;
  safety: boolean;
  flags?: MatchupFlags;
}

interface SamePlayOverrides {
  yards?: number;
  forceTurnover?: boolean;
  noDownProgress?: boolean;
  autoFirstDown?: boolean;
  message?: string;
}

interface CardSelection {
  card: Card;
  fromHand: boolean;
  specialType: PlayType | null;
}

const FIELD_GOAL_POINTS = 3;
const SAFETY_POINTS = 2;
const PLAY_CLOCK_TICK_SECONDS = 30;
const QUARTER_SECONDS = 900;
const STANDARD_PLAYS: StandardPlayType[] = ['SR', 'LR', 'SP', 'LP'];
const SPECIAL_PLAYS: PlayType[] = ['TP', 'HM', 'FG', 'PT', 'TO'];
const SPECIAL_CARD_PREFIX = 'SPECIAL';

export class RuleNotImplementedError extends Error {
  constructor(public readonly ruleId: string, message: string) {
    super(message);
    this.name = 'RuleNotImplementedError';
  }
}

export function assertRuleImplemented(ruleId: string) {
  if (OPEN_RULE_IDS.includes(ruleId as (typeof OPEN_RULE_IDS)[number])) {
    throw new RuleNotImplementedError(ruleId, `Rule ${ruleId} is still OPEN in FOOTBORED_RULES.md`);
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

function roundAwayFromZero(value: number): number {
  return value >= 0 ? Math.ceil(value) : Math.floor(value);
}

export function roundYardsForPlay(value: number): number {
  return roundAwayFromZero(value);
}

export class GameEngine {
  state: ServerGameState;

  private deckHome = new Deck();
  private deckAway = new Deck();
  private handHome = new Hand();
  private handAway = new Hand();

  private overtimeCoinWinner: TeamSide;
  private overtimePossessionsCompleted = 0;
  private standardPlaysUsedBySide: Record<TeamSide, number> = {
    home: 0,
    away: 0,
  };
  private trickPlayChargesBySide: Record<TeamSide, number> = {
    home: 1,
    away: 1,
  };

  constructor(roomId: string) {
    this.overtimeCoinWinner = hashToIndex(`${roomId}|ot-coin`, 2) === 0 ? 'home' : 'away';

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
        isOvertime: false,
        overtimePeriod: null,
        awaitingZeroSecondPlay: false,
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
    const handCard = this.state.players[side].hand.find((card) => card.id === cardId);
    const specialType = this.parseSpecialTypeFromCardId(side, cardId);

    if (!handCard && !specialType) {
      return { accepted: false, resolved: false, reason: 'card_not_in_hand' };
    }

    const submittedType = handCard?.type ?? specialType!;

    if (specialType && !this.canUseSpecial(side, submittedType, isOffense)) {
      return { accepted: false, resolved: false, reason: 'special_not_available' };
    }

    if (this.state.pendingMove[slot]) {
      return { accepted: false, resolved: false, reason: 'already_submitted' };
    }

    if (isOffense) {
      if (submittedType === 'HM' && this.state.players[side].hailMaryCount <= 0) {
        return { accepted: false, resolved: false, reason: 'hail_mary_exhausted' };
      }

      if (this.isShootoutOvertime() && ['HM', 'TP', 'PT', 'FG'].includes(submittedType)) {
        return { accepted: false, resolved: false, reason: 'shootout_restriction' };
      }
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

    if (!this.state.field.isOvertime && this.state.field.quarter >= 4 && this.state.field.clockSeconds <= 0 && !this.state.field.awaitingZeroSecondPlay) {
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
      isOvertime: false,
      overtimePeriod: null,
      awaitingZeroSecondPlay: false,
    };

    this.state.pendingMove = {};
    this.state.lastPlay = undefined;
    this.state.phase = GamePhase.LOBBY;
    this.overtimePossessionsCompleted = 0;
    this.standardPlaysUsedBySide = { home: 0, away: 0 };
    this.trickPlayChargesBySide = { home: 1, away: 1 };

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

    const offenseSelection = this.takeSubmittedCard(offenseSide, offenseCardId!, offenseHand, true);
    const defenseSelection = this.takeSubmittedCard(defenseSide, defenseCardId!, defenseHand, false);

    if (!offenseSelection || !defenseSelection) {
      this.state.pendingMove = {};
      this.state.lastPlay = undefined;
      return;
    }

    const offenseCard = offenseSelection.card;
    const defenseCard = defenseSelection.card;

    if (offenseSelection.specialType === 'TP') {
      this.trickPlayChargesBySide[offenseSide] = Math.max(0, this.trickPlayChargesBySide[offenseSide] - 1);
    }
    if (defenseSelection.specialType === 'TP') {
      this.trickPlayChargesBySide[defenseSide] = Math.max(0, this.trickPlayChargesBySide[defenseSide] - 1);
    }

    if (offenseSelection.fromHand && isStandardPlay(offenseCard.type)) {
      this.trackStandardCycleUsage(offenseSide);
    }
    if (defenseSelection.fromHand && isStandardPlay(defenseCard.type)) {
      this.trackStandardCycleUsage(defenseSide);
    }

    if (offenseCard.type === 'HM') {
      this.state.players[offenseSide].hailMaryCount = Math.max(0, this.state.players[offenseSide].hailMaryCount - 1);
    }

    const outcome = this.evaluateMatchup(offenseCard, defenseCard, offenseSide, defenseSide);

    if (outcome.keepOffenseCard && offenseSelection.fromHand) {
      offenseHand.returnCardToHand(offenseCard);
    }
    if (outcome.keepDefenseCard && defenseSelection.fromHand) {
      defenseHand.returnCardToHand(defenseCard);
    }

    let ballResolution: BallResolution = { touchdown: false, safety: false };
    let isTurnover = false;
    let shootoutConverted = false;

    if (this.isShootoutOvertime()) {
      if (outcome.yards > 0) {
        this.state.players[offenseSide].score += 2;
        shootoutConverted = true;
      }
    } else {
      ballResolution = this.applyBallAndPossession(outcome.yards, offenseSide, outcome);
      isTurnover = this.applyDownAndDistance(offenseSide, outcome, ballResolution.touchdown, ballResolution.safety);
    }

    const combinedFlags: MatchupFlags = {
      ...(outcome.flags ?? {}),
      ...(ballResolution.flags ?? {}),
    };

    const zeroSecondPlay = !outcome.noClockTick && !this.state.field.isOvertime
      ? this.tickGameClock(combinedFlags)
      : false;

    this.state.lastPlay = {
      playCalled: offenseCard,
      defenseCalled: defenseCard,
      delta: outcome.delta,
      yardsGained: outcome.yards,
      isTouchdown: ballResolution.touchdown,
      isTurnover,
      isSafety: ballResolution.safety,
      multiplierCard: outcome.multiplierCard ?? 'N/A',
      yardCard: outcome.yardCard ?? Math.abs(outcome.yards),
      message: shootoutConverted
        ? `${outcome.message} Two-point conversion good.`
        : outcome.message,
      flags: {
        defPenalty: combinedFlags.defPenalty,
        zeroSecondPlay,
        kickoffTouchback: combinedFlags.kickoffTouchback,
        kickType: combinedFlags.kickType,
        kickDistance: combinedFlags.kickDistance,
        returnYards: combinedFlags.returnYards,
        kickResultSpot: combinedFlags.kickResultSpot,
        icedKicker: combinedFlags.icedKicker,
      },
    };

    const possessionEnded = this.isShootoutOvertime()
      || ballResolution.touchdown
      || ballResolution.safety
      || isTurnover
      || !!outcome.fieldGoalAttempt;

    if (this.state.field.isOvertime && possessionEnded) {
      this.finishOvertimePossession(offenseSide);
    }

    offenseHand.refill(this.getDeckForSide(offenseSide));
    defenseHand.refill(this.getDeckForSide(defenseSide));
    this.syncState();

    this.state.pendingMove = {};
    if (this.state.phase !== GamePhase.GAME_OVER) {
      this.state.phase = GamePhase.RESOLUTION;
    }
  }

  private buildSpecialCardId(side: TeamSide, type: PlayType): string {
    return `${SPECIAL_CARD_PREFIX}:${side}:${type}`;
  }

  private parseSpecialTypeFromCardId(side: TeamSide, cardId: string): PlayType | null {
    const [prefix, idSide, type] = cardId.split(':');
    if (prefix !== SPECIAL_CARD_PREFIX || idSide !== side) {
      return null;
    }

    if (!SPECIAL_PLAYS.includes(type as PlayType)) {
      return null;
    }

    return type as PlayType;
  }

  private canUseSpecial(side: TeamSide, type: PlayType, isOffense: boolean): boolean {
    if (!SPECIAL_PLAYS.includes(type)) {
      return false;
    }

    if (type === 'TP') {
      return this.trickPlayChargesBySide[side] > 0;
    }

    if (type === 'HM') {
      return isOffense && this.state.players[side].hailMaryCount > 0;
    }

    if (type === 'FG') {
      return isOffense && this.state.players[side].canFieldGoal;
    }

    if (type === 'PT') {
      return isOffense && this.state.players[side].canPunt;
    }

    if (type === 'TO') {
      return this.state.players[side].timeouts > 0;
    }

    return false;
  }

  private takeSubmittedCard(side: TeamSide, cardId: string, hand: Hand, isOffense: boolean): CardSelection | null {
    const fromHand = hand.playCard(cardId);
    if (fromHand) {
      return {
        card: fromHand,
        fromHand: true,
        specialType: null,
      };
    }

    const specialType = this.parseSpecialTypeFromCardId(side, cardId);
    if (!specialType || !this.canUseSpecial(side, specialType, isOffense)) {
      return null;
    }

    return {
      card: {
        id: cardId,
        type: specialType,
        name: specialType,
        isSpecial: true,
      },
      fromHand: false,
      specialType,
    };
  }

  private trackStandardCycleUsage(side: TeamSide) {
    this.standardPlaysUsedBySide[side] += 1;
    if (this.standardPlaysUsedBySide[side] < GAME_CONFIG.DECK_SIZE) {
      return;
    }

    this.standardPlaysUsedBySide[side] = 0;
    this.trickPlayChargesBySide[side] = 1;
  }

  private getSpecialActionsForSide(side: TeamSide): SpecialActionState[] {
    const isOffense = side === this.getOffenseSide();
    const down = this.state.field.down;
    const timeouts = this.state.players[side].timeouts;
    const hailMaryCount = this.state.players[side].hailMaryCount;
    const trickRemaining = this.trickPlayChargesBySide[side];

    const actions: SpecialActionState[] = [];

    for (const type of SPECIAL_PLAYS) {
      const remaining = type === 'TP'
        ? trickRemaining
        : type === 'HM'
          ? hailMaryCount
          : type === 'TO'
            ? timeouts
            : null;

      const enabled = this.canUseSpecial(side, type, isOffense)
        && (type !== 'PT' || this.state.field.isOvertime || down === 4);

      let reason: string | undefined;
      if (!enabled) {
        if (!isOffense && type !== 'TP' && type !== 'TO') {
          reason = 'offense_only';
        } else if (type === 'TP' && trickRemaining <= 0) {
          reason = 'tp_exhausted';
        } else if (type === 'HM' && hailMaryCount <= 0) {
          reason = 'hm_exhausted';
        } else if (type === 'TO' && timeouts <= 0) {
          reason = 'timeouts_exhausted';
        } else if (type === 'PT' && !this.state.field.isOvertime && down !== 4) {
          reason = 'fourth_down_only';
        } else {
          reason = 'unavailable';
        }
      }

      actions.push({
        id: this.buildSpecialCardId(side, type),
        type,
        enabled,
        remaining,
        reason,
      });
    }

    return actions;
  }

  private evaluateMatchup(offenseCard: Card, defenseCard: Card, offenseSide: TeamSide, defenseSide: TeamSide): MatchupResult {
    const turnSeed = this.createTurnSeed(offenseCard.type, defenseCard.type);

    if (offenseCard.type === 'TO') {
      this.state.players[offenseSide].timeouts = Math.max(0, this.state.players[offenseSide].timeouts - 1);
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

    if (defenseCard.type === 'TO' && offenseCard.type !== 'FG') {
      this.state.players[defenseSide].timeouts = Math.max(0, this.state.players[defenseSide].timeouts - 1);
      return {
        delta: 0,
        yards: 0,
        message: 'Defense timeout called. No play run.',
        keepOffenseCard: true,
        keepDefenseCard: true,
        noDownProgress: true,
        noClockTick: true,
        multiplierCard: 'TO',
        yardCard: 0,
      };
    }

    if (offenseCard.type === 'PT') {
      if (this.state.field.down !== 4 && !this.state.field.isOvertime) {
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

      const punt = this.resolvePuntOutcome(offenseSide, `${turnSeed}|punt`);

      return {
        delta: punt.yards >= 0 ? 0 : -1,
        yards: punt.yards,
        message: punt.message,
        forceTurnover: true,
        keepDefenseCard: true,
        noDownProgress: true,
        multiplierCard: 'PT',
        yardCard: Math.abs(punt.yards),
        flags: punt.flags,
      };
    }

    if (offenseCard.type === 'FG') {
      const forwardBall = this.toForwardBall(this.state.field.ballOn, offenseSide);
      const distance = Math.max(0, 100 - forwardBall);
      const baseSuccessRate = this.getFieldGoalSuccessRate(distance);
      const icedKicker = defenseCard.type === 'TO' && this.state.players[defenseSide].timeouts > 0;

      if (icedKicker) {
        this.state.players[defenseSide].timeouts = Math.max(0, this.state.players[defenseSide].timeouts - 1);
      }

      const adjustedSuccessRate = Math.max(
        0,
        baseSuccessRate - (icedKicker ? RULE_ASSUMPTIONS.fieldGoal.icingPenalty : 0)
      );
      const fgRoll = hashToIndex(`${turnSeed}|fg-roll`, 1000) / 1000;
      const made = fgRoll < adjustedSuccessRate;

      const fgFlags: MatchupFlags = {
        kickType: 'FIELD_GOAL',
        kickDistance: distance,
        kickResultSpot: this.state.field.ballOn,
        icedKicker,
      };

      if (made) {
        this.state.players[offenseSide].score += FIELD_GOAL_POINTS;
        const kickoffFlags = !this.state.field.isOvertime
          ? this.applyKickoff(this.getOpponentSide(offenseSide), 'field_goal', this.createKickSeed('field_goal'))
          : undefined;
        if (!this.state.field.isOvertime) {
          // kickoff placement handled by applyKickoff in regulation.
        }
        return {
          delta: 1,
          yards: 0,
          message: `Field goal good from ${distance} yards${icedKicker ? ' (iced)' : ''}.`,
          fieldGoalAttempt: true,
          noDownProgress: true,
          multiplierCard: 'FG',
          yardCard: 0,
          flags: {
            ...fgFlags,
            ...(kickoffFlags ?? {}),
          },
        };
      }

      const missYards = RULE_ASSUMPTIONS.fieldGoal.missSpotRule === 'spot_of_kick' ? -7 : 0;

      return {
        delta: -1,
        yards: missYards,
        message: `Field goal missed from ${distance} yards${icedKicker ? ' (iced)' : ''}.`,
        forceTurnover: true,
        noDownProgress: true,
        fieldGoalAttempt: true,
        multiplierCard: 'FG',
        yardCard: 0,
        flags: fgFlags,
      };
    }

    if (offenseCard.type === 'TP' && defenseCard.type === 'TP') {
      return this.resolveTpSamePlay(turnSeed);
    }

    if (offenseCard.type === 'TP') {
      const trick = this.resolveTrickPlay(turnSeed);
      trick.keepDefenseCard = true;
      return trick;
    }

    if (defenseCard.type === 'TP') {
      const defPenalty = hashToIndex(`${turnSeed}|def-tp-pen`, 6) === 0;
      if (defPenalty) {
        return {
          delta: 2,
          yards: 15,
          message: 'Defense trick penalty: auto first down for offense.',
          keepDefenseCard: true,
          noDownProgress: true,
          autoFirstDown: true,
          multiplierCard: 'TP',
          yardCard: 15,
          flags: { defPenalty: true },
        };
      }
    }

    if (offenseCard.type === 'HM') {
      const hm = this.resolveHailMary(turnSeed);
      if (defenseCard.type === 'TP') {
        hm.keepDefenseCard = true;
      }
      return hm;
    }

    if (isStandardPlay(offenseCard.type) && isStandardPlay(defenseCard.type)) {
      return this.resolveStandardPlay(offenseCard.type, defenseCard.type, turnSeed, offenseSide, defenseSide);
    }

    if (isStandardPlay(offenseCard.type)) {
      const defenseForResolution: StandardPlayType = defenseCard.type === 'TP' ? offenseCard.type : offenseCard.type;
      const result = this.resolveStandardPlay(offenseCard.type, defenseForResolution, `${turnSeed}|fallback`, offenseSide, defenseSide);
      if (defenseCard.type === 'TP') {
        result.keepDefenseCard = true;
      }
      return result;
    }

    return {
      delta: 0,
      yards: 0,
      message: `${offenseCard.name} vs ${defenseCard.name}: no gain.`,
      multiplierCard: 'N/A',
      yardCard: 0,
    };
  }

  private resolveStandardPlay(
    offense: StandardPlayType,
    defense: StandardPlayType,
    seed: string,
    offenseSide: TeamSide,
    defenseSide: TeamSide
  ): MatchupResult {
    const quality = STANDARD_QUALITY_MATRIX[offense][defense];
    const multiplierCard = MULTIPLIER_SEQUENCE[hashToIndex(`${seed}|mult`, MULTIPLIER_SEQUENCE.length)];
    const multiplier = MULTIPLIER_TABLE[multiplierCard][quality];
    const yardCard = YARD_CARD_SEQUENCE[hashToIndex(`${seed}|yard`, YARD_CARD_SEQUENCE.length)];
    const baseYards = roundAwayFromZero(yardCard * multiplier);

    const result: MatchupResult = {
      delta: QUALITY_DELTA[quality],
      yards: baseYards,
      message: `${offense} vs ${defense} -> ${quality} (${multiplierCard}) for ${baseYards >= 0 ? '+' : ''}${baseYards} yards.`,
      multiplierCard,
      yardCard,
    };

    if (offense === defense) {
      const triggered = hashToIndex(`${seed}|same-trigger`, 2) === 1;
      if (!triggered) {
        result.message = `${result.message} Same-play branch did not trigger; fallback to normal matrix.`;
        return result;
      }

      const favorOffense = hashToIndex(`${seed}|same-favor`, 2) === 1;
      const sameOverrides = this.resolveSamePlayBranch(multiplierCard, baseYards, seed, favorOffense, offenseSide, defenseSide);
      result.yards = sameOverrides.yards ?? result.yards;
      result.forceTurnover = sameOverrides.forceTurnover;
      result.noDownProgress = sameOverrides.noDownProgress;
      result.autoFirstDown = sameOverrides.autoFirstDown;
      result.message = sameOverrides.message ?? result.message;
    }

    return result;
  }

  private resolveSamePlayBranch(
    multiplierCard: typeof MULTIPLIER_SEQUENCE[number],
    baseYards: number,
    seed: string,
    favorOffense: boolean,
    offenseSide: TeamSide,
    defenseSide: TeamSide
  ): SamePlayOverrides {
    const branchCoin = hashToIndex(`${seed}|same-branch`, 2) === 1;

    if (favorOffense) {
      if (multiplierCard === 'K') {
        return {
          yards: this.getOffenseBigPlayYards(offenseSide),
          message: 'Same-play offense-favorable K: offense big play.',
        };
      }
      if (multiplierCard === 'Q') {
        return {
          yards: baseYards * 3,
          message: 'Same-play offense-favorable Q: x3.',
        };
      }
      if (multiplierCard === 'J') {
        return {
          yards: 0,
          message: 'Same-play offense-favorable J: x0.',
        };
      }

      if (branchCoin) {
        return {
          yards: 0,
          forceTurnover: true,
          noDownProgress: true,
          message: 'Same-play offense-favorable 10: turnover at line of scrimmage.',
        };
      }

      return {
        yards: 0,
        message: 'Same-play offense-favorable 10: x0.',
      };
    }

    if (multiplierCard === 'K') {
      if (branchCoin) {
        return {
          yards: this.getOffenseBigPlayYards(offenseSide),
          message: 'Same-play defense-favorable K coin: offense big play.',
        };
      }
      return {
        yards: this.getDefenseBigPlayYards(defenseSide),
        noDownProgress: true,
        message: 'Same-play defense-favorable K coin: defense big play.',
      };
    }

    if (multiplierCard === 'Q') {
      return {
        yards: 0,
        message: 'Same-play defense-favorable Q: x0.',
      };
    }

    if (multiplierCard === 'J') {
      return {
        yards: baseYards * -3,
        message: 'Same-play defense-favorable J: x-3.',
      };
    }

    return {
      yards: this.getDefenseBigPlayYards(defenseSide),
      noDownProgress: true,
      message: 'Same-play defense-favorable 10: defense big play.',
    };
  }

  private getOffenseBigPlayYards(offenseSide: TeamSide): number {
    const forwardBall = this.toForwardBall(this.state.field.ballOn, offenseSide);
    const distanceToEndZone = Math.max(0, 100 - forwardBall);
    return Math.max(25, Math.max(40, Math.ceil(distanceToEndZone / 2)));
  }

  private getDefenseBigPlayYards(_defenseSide: TeamSide): number {
    return -10;
  }

  private resolveTpSamePlay(seed: string): MatchupResult {
    const base = this.resolveStandardPlay('SP', 'SP', `${seed}|tp-profile`, 'home', 'away');
    const overrides = this.resolveSamePlayBranch(
      MULTIPLIER_SEQUENCE[hashToIndex(`${seed}|tp-mult`, MULTIPLIER_SEQUENCE.length)],
      base.yards,
      `${seed}|tp-same`,
      hashToIndex(`${seed}|tp-favor`, 2) === 1,
      this.getOffenseSide(),
      this.getDefenseSide()
    );

    return {
      delta: base.delta,
      yards: overrides.yards ?? base.yards,
      forceTurnover: overrides.forceTurnover,
      noDownProgress: overrides.noDownProgress,
      autoFirstDown: overrides.autoFirstDown,
      message: overrides.message ?? 'TP vs TP resolved via same-play TP profile.',
      multiplierCard: 'TP',
      yardCard: Math.abs(overrides.yards ?? base.yards),
    };
  }

  private resolveTrickPlay(seed: string): MatchupResult {
    const outcome = TRICK_PLAY_OUTCOME_TABLE[hashToIndex(`${seed}|tp`, TRICK_PLAY_OUTCOME_TABLE.length)];
    return this.resolveTrickOutcome(outcome);
  }

  private resolveTrickOutcome(outcome: TrickPlayOutcomeCode): MatchupResult {
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

    if (outcome === 'OWN_PENALTY_15') {
      return {
        delta: -2,
        yards: -15,
        message: 'Trick play own-penalty: -15 and loss of down.',
        multiplierCard: 'TP',
        yardCard: 15,
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

  private deterministicInt(seed: string, min: number, max: number): number {
    const boundedMin = Math.min(min, max);
    const boundedMax = Math.max(min, max);
    const span = boundedMax - boundedMin + 1;
    return boundedMin + hashToIndex(seed, span);
  }

  private getFieldGoalSuccessRate(distance: number): number {
    for (const band of RULE_ASSUMPTIONS.fieldGoal.distanceBands) {
      if (distance <= band.maxDistance) {
        return band.successRate;
      }
    }

    return RULE_ASSUMPTIONS.fieldGoal.longShotSuccessRate;
  }

  private resolvePuntOutcome(offenseSide: TeamSide, seed: string): { yards: number; message: string; flags: MatchupFlags } {
    const startBall = this.state.field.ballOn;
    const direction = offenseSide === 'home' ? 1 : -1;
    const grossYards = this.deterministicInt(seed + '|gross', RULE_ASSUMPTIONS.punt.grossYardsMin, RULE_ASSUMPTIONS.punt.grossYardsMax);
    const landingSpot = startBall + direction * grossYards;

    const overEndLine = (offenseSide === 'home' && landingSpot >= 100)
      || (offenseSide === 'away' && landingSpot <= 0);

    if (overEndLine) {
      const receivingSide = this.getOpponentSide(offenseSide);
      const touchbackSpot = RULE_ASSUMPTIONS.punt.touchbackSpot;
      const touchbackAbsolute = receivingSide === 'home' ? touchbackSpot : 100 - touchbackSpot;
      const netYards = (touchbackAbsolute - startBall) / direction;

      return {
        yards: netYards,
        message: `Punt ${grossYards} yards, touchback to ${touchbackSpot}.`,
        flags: {
          kickType: 'PUNT',
          kickDistance: grossYards,
          returnYards: 0,
          kickoffTouchback: true,
          kickResultSpot: touchbackAbsolute,
        },
      };
    }

    const returnYards = this.deterministicInt(seed + '|return', RULE_ASSUMPTIONS.punt.returnYardsMin, RULE_ASSUMPTIONS.punt.returnYardsMax);
    const finalSpot = Math.max(1, Math.min(99, landingSpot - direction * returnYards));
    const netYards = (finalSpot - startBall) / direction;

    return {
      yards: netYards,
      message: `Punt ${grossYards} yards, return ${returnYards}.`,
      flags: {
        kickType: 'PUNT',
        kickDistance: grossYards,
        returnYards,
        kickoffTouchback: false,
        kickResultSpot: finalSpot,
      },
    };
  }

  private createKickSeed(reason: 'touchdown' | 'field_goal' | 'safety'): string {
    const { quarter, clockSeconds, down, toGo, ballOn, overtimePeriod } = this.state.field;
    return [
      this.state.roomId,
      'KICK',
      reason,
      quarter,
      clockSeconds,
      down,
      toGo,
      ballOn,
      overtimePeriod ?? 0,
      this.state.players.home.score,
      this.state.players.away.score,
    ].join('|');
  }

  private applyKickoff(
    receivingSide: TeamSide,
    reason: 'touchdown' | 'field_goal' | 'safety',
    seed: string
  ): MatchupFlags {
    let kickoffTouchback = false;
    let returnYards = 0;
    let receivingForwardSpot: number;

    if (reason === 'safety') {
      receivingForwardSpot = RULE_ASSUMPTIONS.kickoff.safetyKickSpot;
    } else {
      const touchbackThreshold = Math.floor(RULE_ASSUMPTIONS.kickoff.touchbackRate * 1000);
      kickoffTouchback = hashToIndex(seed + '|kickoff-touchback', 1000) < touchbackThreshold;

      if (kickoffTouchback) {
        receivingForwardSpot = RULE_ASSUMPTIONS.kickoff.touchbackSpot;
      } else {
        receivingForwardSpot = this.deterministicInt(
          seed + '|kickoff-return-spot',
          RULE_ASSUMPTIONS.kickoff.returnSpotMin,
          RULE_ASSUMPTIONS.kickoff.returnSpotMax
        );
        returnYards = Math.max(0, RULE_ASSUMPTIONS.kickoff.returnSpotMax - receivingForwardSpot);
      }
    }

    const absoluteSpot = receivingSide === 'home'
      ? receivingForwardSpot
      : 100 - receivingForwardSpot;

    this.state.field.ballOn = absoluteSpot;
    this.state.field.possessionPlayerId = receivingSide;
    this.state.field.down = 1;
    this.state.field.toGo = 10;

    return {
      kickType: 'KICKOFF',
      kickDistance: reason === 'safety' ? RULE_ASSUMPTIONS.kickoff.safetyKickSpot : 65,
      returnYards,
      kickoffTouchback,
      kickResultSpot: absoluteSpot,
    };
  }

  private createTurnSeed(offenseType: PlayType, defenseType: PlayType): string {
    const { quarter, clockSeconds, down, toGo, ballOn, overtimePeriod } = this.state.field;
    return [
      this.state.roomId,
      quarter,
      clockSeconds,
      down,
      toGo,
      ballOn,
      overtimePeriod ?? 0,
      offenseType,
      defenseType,
    ].join('|');
  }

  private toForwardBall(ballOn: number, offenseSide: TeamSide): number {
    return offenseSide === 'home' ? ballOn : 100 - ballOn;
  }

  private fromForwardBall(forwardBall: number, offenseSide: TeamSide): number {
    return offenseSide === 'home' ? forwardBall : 100 - forwardBall;
  }

  private applyBallAndPossession(yards: number, offenseSide: TeamSide, outcome: MatchupResult): BallResolution {
    if (outcome.fieldGoalAttempt || offenseSide !== this.getOffenseSide()) {
      return { touchdown: false, safety: false };
    }

    const currentForwardBall = this.toForwardBall(this.state.field.ballOn, offenseSide);
    const nextForwardBall = currentForwardBall + yards;

    if (nextForwardBall >= 100) {
      this.state.players[offenseSide].score += GAME_CONFIG.TOUCHDOWN_POINTS;
      const kickoffFlags = !this.state.field.isOvertime
        ? this.applyKickoff(this.getOpponentSide(offenseSide), 'touchdown', this.createKickSeed('touchdown'))
        : undefined;
      if (!this.state.field.isOvertime) {
        // kickoff placement handled by applyKickoff in regulation.
      }
      return { touchdown: true, safety: false, flags: kickoffFlags };
    }

    if (nextForwardBall < 0) {
      const defenseSide = this.getOpponentSide(offenseSide);
      this.state.players[defenseSide].score += SAFETY_POINTS;
      const kickoffFlags = !this.state.field.isOvertime
        ? this.applyKickoff(defenseSide, 'safety', this.createKickSeed('safety'))
        : undefined;
      if (!this.state.field.isOvertime) {
        // kickoff placement handled by applyKickoff in regulation.
      }
      return { touchdown: false, safety: true, flags: kickoffFlags };
    }

    const boundedForward = Math.max(0, Math.min(100, nextForwardBall));
    this.state.field.ballOn = this.fromForwardBall(boundedForward, offenseSide);
    return { touchdown: false, safety: false };
  }

  private applyDownAndDistance(offenseSide: TeamSide, outcome: MatchupResult, isTouchdown: boolean, isSafety: boolean): boolean {
    if (isTouchdown || isSafety || outcome.noDownProgress) {
      if (outcome.autoFirstDown) {
        this.state.field.down = 1;
        this.state.field.toGo = 10;
      }

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

  private tickGameClock(flags?: MatchupFlags): boolean {
    if (this.state.field.isOvertime) {
      return false;
    }

    if (this.state.field.awaitingZeroSecondPlay) {
      const extended = !!flags?.defPenalty || !!flags?.kickoffTouchback;
      if (!extended) {
        this.state.field.awaitingZeroSecondPlay = false;
        this.handleEndOfPeriod();
      }
      return true;
    }

    if (flags?.defPenalty || flags?.kickoffTouchback) {
      return false;
    }

    this.state.field.clockSeconds -= PLAY_CLOCK_TICK_SECONDS;

    if (this.state.field.clockSeconds > 0) {
      return false;
    }

    this.state.field.clockSeconds = 0;
    this.state.field.awaitingZeroSecondPlay = true;
    return false;
  }

  private handleEndOfPeriod() {
    if (this.state.field.quarter < 4) {
      this.state.field.quarter += 1;
      this.state.field.clockSeconds = QUARTER_SECONDS;
      return;
    }

    if (this.state.players.home.score !== this.state.players.away.score) {
      this.state.phase = GamePhase.GAME_OVER;
      return;
    }

    this.enterOvertimePeriod(1);
  }

  private enterOvertimePeriod(period: number) {
    this.state.field.isOvertime = true;
    this.state.field.overtimePeriod = period;
    this.state.field.quarter = 4 + period;
    this.state.field.clockSeconds = 0;
    this.state.field.awaitingZeroSecondPlay = false;

    this.state.players.home.hailMaryCount += 1;
    this.state.players.away.hailMaryCount += 1;

    this.overtimePossessionsCompleted = 0;
    const firstOffense = period % 2 === 1 ? this.overtimeCoinWinner : this.getOpponentSide(this.overtimeCoinWinner);
    this.prepareOvertimePossession(firstOffense);
  }

  private prepareOvertimePossession(offenseSide: TeamSide) {
    const period = this.state.field.overtimePeriod ?? 1;
    const isShootout = period >= 5;
    const startSpot = isShootout ? COLLEGE_OVERTIME_CONFIG.shootoutSpot : COLLEGE_OVERTIME_CONFIG.startSpot;

    this.state.field.possessionPlayerId = offenseSide;
    this.state.field.ballOn = offenseSide === 'home' ? 100 - startSpot : startSpot;
    this.state.field.down = 1;
    this.state.field.toGo = isShootout ? COLLEGE_OVERTIME_CONFIG.shootoutSpot : 10;
  }

  private finishOvertimePossession(offenseSide: TeamSide) {
    this.overtimePossessionsCompleted += 1;

    if (this.overtimePossessionsCompleted === 1) {
      this.prepareOvertimePossession(this.getOpponentSide(offenseSide));
      return;
    }

    if (this.state.players.home.score !== this.state.players.away.score) {
      this.state.phase = GamePhase.GAME_OVER;
      return;
    }

    this.enterOvertimePeriod((this.state.field.overtimePeriod ?? 1) + 1);
  }

  private isShootoutOvertime() {
    return this.state.field.isOvertime && (this.state.field.overtimePeriod ?? 0) >= 5;
  }

  private flipPossession() {
    this.state.field.possessionPlayerId = this.getOpponentSide(this.getOffenseSide());
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
    this.state.players.home.specialActions = this.getSpecialActionsForSide('home');
    this.state.players.away.specialActions = this.getSpecialActionsForSide('away');
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
      specialActions: [],
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
      yards: roundAwayFromZero(yardCard * multiplier),
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
