import { randomUUID } from 'node:crypto';
import { Card } from '../../../shared/types';
import { STANDARD_DECK_BLUEPRINTS } from '../../../shared/constants';

export class Deck {
  private cards: Card[] = [];
  private discardPile: Card[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.cards = STANDARD_DECK_BLUEPRINTS.map(blueprint => ({
      ...blueprint,
      id: randomUUID()
    }));
    this.shuffle();
    this.discardPile = [];
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(amount: number): Card[] {
    const drawn: Card[] = [];
    
    for (let i = 0; i < amount; i++) {
      if (this.cards.length === 0) {
        this.reset();
      }
      drawn.push(this.cards.pop()!);
    }
    
    return drawn;
  }

  count(): number {
    return this.cards.length;
  }
}
