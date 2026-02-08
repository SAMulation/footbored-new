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

function resolveHandSize(): number {
  const raw = (typeof process !== 'undefined' && process.env)
    ? process.env.FB_HAND_SIZE
    : undefined;
  const parsed = Number.parseInt(raw ?? '', 10);

  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 7) {
    return parsed;
  }

  return 3;
}

export const GAME_CONFIG = {
  HAND_SIZE: resolveHandSize(),
  DECK_SIZE: 12,
  TOUCHDOWN_POINTS: 6,
};
