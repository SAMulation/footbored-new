import { Card, PlayerHand } from '../../../shared/types';
import { GAME_CONFIG } from '../../../shared/constants';
import { Deck } from './Deck';

export class Hand {
  private cards: Card[] = [];
  private maxSize: number = GAME_CONFIG.HAND_SIZE;

  constructor() {
  }

  refill(deck: Deck) {
    const needed = this.maxSize - this.cards.length;
    if (needed > 0) {
      const newCards = deck.draw(needed);
      this.cards = [...this.cards, ...newCards];
    }
  }

  playCard(cardId: string): Card | undefined {
    const index = this.cards.findIndex(c => c.id === cardId);
    
    if (index === -1) {
      return undefined;
    }

    const [playedCard] = this.cards.splice(index, 1);
    return playedCard;
  }

  // Used for Punts/FGs where the opponent doesn't lose a card
  returnCardToHand(card: Card) {
    this.cards.push(card);
  }

  toState(): PlayerHand {
    return {
      cards: this.cards,
      maxSize: this.maxSize
    };
  }
  
  get count() {
    return this.cards.length;
  }
}