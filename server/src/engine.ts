import { ServerGameState, GamePhase, PlayerState, PlayType } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import { Deck } from './models/Deck';
import { Hand } from './models/Hand';

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
        away: this.createPlayer('Away Team')
      },
      field: {
        possessionPlayerId: 'home',
        ballOn: 20,
        down: 1,
        toGo: 10,
        quarter: 1,
        clockSeconds: 900
      },
      pendingMove: {}
    };
    
    // Deal initial hands
    this.handHome.refill(this.deckHome);
    this.handAway.refill(this.deckAway);
    this.syncState();
  }

  private syncState() {
    this.state.players.home.hand = this.handHome.toState().cards;
    this.state.players.away.hand = this.handAway.toState().cards;
  }

  private createPlayer(name: string): PlayerState {
    return {
      id: name.toLowerCase(),
      username: name,
      teamName: name,
      score: 0,
      timeouts: 3,
      hailMaryCount: 3,
      canFieldGoal: false,
      canPunt: true,
      hand: [],
      deckCount: GAME_CONFIG.DECK_SIZE,
      isHost: false
    };
  }

  public resolveTurn() {
    const { offenseCardId, defenseCardId } = this.state.pendingMove;
    
    const isHomeOffense = this.state.field.possessionPlayerId === 'home';
    const offHand = isHomeOffense ? this.handHome : this.handAway;
    const defHand = isHomeOffense ? this.handAway : this.handHome;

    const offCard = offHand.playCard(offenseCardId!);
    const defCard = defHand.playCard(defenseCardId!);

    if (!offCard || !defCard) {
      console.error("Critical Error: Card not found in hand during resolution.");
      return;
    }

    let resultMessage = "";
    let yardsGained = 0;

    // CASE A: PUNT
    if (offCard.type === 'PT') {
      if (this.state.field.down !== 4) {
        console.warn("Illegal Punt on non-4th down! Treating as 0 gain.");
        yardsGained = 0;
        resultMessage = "Illegal Punt! Turnover.";
      } else {
        yardsGained = 40; 
        resultMessage = "Punt! 40 Yards.";
        defHand.returnCardToHand(defCard); 
      }
    } 
    
    // CASE B: STANDARD PLAY
    else {
      const quality = this.calculateDelta(offCard.type, defCard.type);
      const multiplier = 2; // Mock: drawMultiplier(quality)
      const baseYards = 3;  // Mock: drawYardCard()
      
      yardsGained = baseYards * multiplier;
      resultMessage = `Gain of ${yardsGained} yards! (${offCard.name} vs ${defCard.name})`;
    }

    this.updateField(yardsGained, isHomeOffense);

    offHand.refill(isHomeOffense ? this.deckHome : this.deckAway);
    defHand.refill(isHomeOffense ? this.deckAway : this.deckHome);

    this.syncState();
    
    this.state.pendingMove = {};
    this.state.phase = GamePhase.RESOLUTION; 
  }

  private calculateDelta(offType: string, defType: string): number {
    if (offType === defType) return 0;
    
    const isOffRun = offType.includes('R');
    const isDefRun = defType.includes('R');
    
    if (isOffRun === isDefRun) return 1;
    return 2;
  }

  private updateField(yards: number, isHomeOffense: boolean) {
    this.state.field.ballOn += yards;
    this.state.field.down++;
    this.state.field.toGo -= yards;

    if (this.state.field.toGo <= 0) {
      this.state.field.down = 1;
      this.state.field.toGo = 10;
      console.log("FIRST DOWN!");
    }
    
    if (this.state.field.ballOn >= 100) {
        console.log("TOUCHDOWN!");
    }
  }
}