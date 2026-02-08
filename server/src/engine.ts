import { Card, GamePhase, PlayType, PlayerState, ServerGameState } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import { Deck } from './models/Deck';
import { Hand } from './models/Hand';

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
}

const FIELD_GOAL_POINTS = 3;
const PLAY_CLOCK_TICK_SECONDS = 30;
const QUARTER_SECONDS = 900;
const MIDFIELD_SPOT = 50;

const MATCHUP_MATRIX: Record<PlayType, Record<PlayType, { delta: number; yards: number }>> = {
  SR: {
    SR: { delta: 0, yards: 3 },
    LR: { delta: 1, yards: 4 },
    SP: { delta: 2, yards: 6 },
    LP: { delta: 2, yards: 6 },
    TP: { delta: 1, yards: 4 },
    HM: { delta: 1, yards: 5 },
    FG: { delta: 2, yards: 7 },
    PT: { delta: 2, yards: 7 },
    TO: { delta: 1, yards: 4 },
  },
  LR: {
    SR: { delta: 0, yards: 2 },
    LR: { delta: 0, yards: 3 },
    SP: { delta: 1, yards: 5 },
    LP: { delta: 2, yards: 8 },
    TP: { delta: 0, yards: 2 },
    HM: { delta: 1, yards: 6 },
    FG: { delta: 2, yards: 8 },
    PT: { delta: 2, yards: 8 },
    TO: { delta: 0, yards: 2 },
  },
  SP: {
    SR: { delta: 1, yards: 4 },
    LR: { delta: 1, yards: 4 },
    SP: { delta: 0, yards: 3 },
    LP: { delta: 1, yards: 5 },
    TP: { delta: 0, yards: 2 },
    HM: { delta: 1, yards: 6 },
    FG: { delta: 1, yards: 5 },
    PT: { delta: 1, yards: 5 },
    TO: { delta: 0, yards: 2 },
  },
  LP: {
    SR: { delta: 0, yards: 1 },
    LR: { delta: 0, yards: 2 },
    SP: { delta: 0, yards: 2 },
    LP: { delta: 0, yards: 3 },
    TP: { delta: -1, yards: -1 },
    HM: { delta: 1, yards: 7 },
    FG: { delta: 0, yards: 3 },
    PT: { delta: 0, yards: 3 },
    TO: { delta: -1, yards: -1 },
  },
  TP: {
    SR: { delta: 2, yards: 9 },
    LR: { delta: 1, yards: 5 },
    SP: { delta: -1, yards: -2 },
    LP: { delta: 0, yards: 3 },
    TP: { delta: 0, yards: 1 },
    HM: { delta: -1, yards: -2 },
    FG: { delta: 1, yards: 5 },
    PT: { delta: 1, yards: 5 },
    TO: { delta: 2, yards: 9 },
  },
  HM: {
    SR: { delta: 1, yards: 6 },
    LR: { delta: 0, yards: 3 },
    SP: { delta: -1, yards: -3 },
    LP: { delta: 0, yards: 2 },
    TP: { delta: -1, yards: -3 },
    HM: { delta: 0, yards: 0 },
    FG: { delta: 0, yards: 3 },
    PT: { delta: 0, yards: 3 },
    TO: { delta: 1, yards: 6 },
  },
  FG: {
    SR: { delta: 0, yards: 0 },
    LR: { delta: 0, yards: 0 },
    SP: { delta: 0, yards: 0 },
    LP: { delta: 0, yards: 0 },
    TP: { delta: 0, yards: 0 },
    HM: { delta: 0, yards: 0 },
    FG: { delta: 0, yards: 0 },
    PT: { delta: 0, yards: 0 },
    TO: { delta: 0, yards: 0 },
  },
  PT: {
    SR: { delta: 0, yards: 35 },
    LR: { delta: 0, yards: 35 },
    SP: { delta: 0, yards: 35 },
    LP: { delta: 0, yards: 35 },
    TP: { delta: 0, yards: 35 },
    HM: { delta: 0, yards: 35 },
    FG: { delta: 0, yards: 35 },
    PT: { delta: 0, yards: 35 },
    TO: { delta: 0, yards: 35 },
  },
  TO: {
    SR: { delta: 0, yards: 0 },
    LR: { delta: 0, yards: 0 },
    SP: { delta: 0, yards: 0 },
    LP: { delta: 0, yards: 0 },
    TP: { delta: 0, yards: 0 },
    HM: { delta: 0, yards: 0 },
    FG: { delta: 0, yards: 0 },
    PT: { delta: 0, yards: 0 },
    TO: { delta: 0, yards: 0 },
  },
};

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

    const outcome = this.evaluateMatchup(offenseCard, defenseCard, offenseSide);

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
      multiplierCard: 'N/A',
      yardCard: Math.abs(outcome.yards),
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
        };
      }
      const matrix = MATCHUP_MATRIX.PT[defenseCard.type];
      return {
        delta: matrix.delta,
        yards: matrix.yards,
        message: `Punt for ${matrix.yards} yards.`,
        forceTurnover: true,
        keepDefenseCard: true,
        noDownProgress: true,
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
        };
      }

      return {
        delta: -1,
        yards: 0,
        message: `Field goal missed from ${distance} yards.`,
        forceTurnover: true,
        noDownProgress: true,
      };
    }

    const matrixResult = MATCHUP_MATRIX[offenseCard.type][defenseCard.type];
    return {
      delta: matrixResult.delta,
      yards: matrixResult.yards,
      message: `${offenseCard.name} vs ${defenseCard.name}: ${matrixResult.yards >= 0 ? '+' : ''}${matrixResult.yards} yards.`,
    };
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
  return MATCHUP_MATRIX[offType][defType];
}
