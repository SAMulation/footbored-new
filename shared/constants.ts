import { Card, PlayType } from './types';

const createCard = (type: PlayType, name: string, description?: string): Omit<Card, 'id'> => ({
  type,
  name,
  description,
});

export const STANDARD_DECK_BLUEPRINTS = [
  createCard('SR', 'Short Run', 'Reliable yardage.'),
  createCard('SR', 'Short Run', 'Reliable yardage.'),
  createCard('SR', 'Short Run', 'Reliable yardage.'),
  
  createCard('LR', 'Long Run', 'High risk, high reward run.'),
  createCard('LR', 'Long Run', 'High risk, high reward run.'),
  createCard('LR', 'Long Run', 'High risk, high reward run.'),

  createCard('SP', 'Short Pass', 'Quick efficient passing.'),
  createCard('SP', 'Short Pass', 'Quick efficient passing.'),
  createCard('SP', 'Short Pass', 'Quick efficient passing.'),

  createCard('LP', 'Long Pass', 'Stretch the field.'),
  createCard('LP', 'Long Pass', 'Stretch the field.'),
  createCard('LP', 'Long Pass', 'Stretch the field.'),
];

export const SPECIAL_CARDS = {
  TRICK_PLAY: createCard('TP', 'Trick Play', 'High variance chaos.'),
  HAIL_MARY: createCard('HM', 'Hail Mary', 'Desperation throw.'),
};

export const GAME_CONFIG = {
  HAND_SIZE: 3,
  DECK_SIZE: 12,
  TOUCHDOWN_POINTS: 6,
};