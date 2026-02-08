import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { Card, GamePhase } from '../../../shared/types';
import { GameEngine, TeamSide } from '../engine';

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function chooseByPriority(hand: Card[], priorities: string[]): Card | undefined {
  for (const type of priorities) {
    const found = hand.find((card) => card.type === type);
    if (found) return found;
  }
  return hand[0];
}

function chooseBotCard(engine: GameEngine, side: TeamSide): Card | undefined {
  const hand = engine.state.players[side].hand;
  const offenseSide = engine.state.field.possessionPlayerId === 'away' ? 'away' : 'home';
  const isOffense = side === offenseSide;
  const { down, toGo } = engine.state.field;

  if (isOffense) {
    if (down === 4) {
      const punt = hand.find((card) => card.type === 'PT');
      if (punt) return punt;
    }
    if (toGo <= 3) {
      return chooseByPriority(hand, ['SR', 'SP', 'LR', 'LP', 'TP', 'HM', 'FG', 'PT', 'TO']);
    }
    return chooseByPriority(hand, ['LR', 'LP', 'TP', 'SP', 'SR', 'HM', 'FG', 'PT', 'TO']);
  }

  if (toGo <= 3) {
    return chooseByPriority(hand, ['SR', 'LR', 'SP', 'LP', 'TP', 'HM', 'TO', 'PT', 'FG']);
  }

  return chooseByPriority(hand, ['SP', 'LP', 'SR', 'LR', 'TP', 'HM', 'TO', 'PT', 'FG']);
}

function renderState(engine: GameEngine, humanSide: TeamSide) {
  const offenseSide = engine.state.field.possessionPlayerId === 'away' ? 'away' : 'home';
  const defenseSide = offenseSide === 'home' ? 'away' : 'home';
  const home = engine.state.players.home;
  const away = engine.state.players.away;

  console.log('\n=== FootBored Terminal ===');
  console.log(`Quarter ${engine.state.field.quarter} | Clock ${formatClock(engine.state.field.clockSeconds)}`);
  console.log(`Score: HOME ${home.score} - AWAY ${away.score}`);
  console.log(`Ball: ${engine.state.field.ballOn} | Down: ${engine.state.field.down} | To Go: ${engine.state.field.toGo}`);
  console.log(`Possession: ${offenseSide.toUpperCase()} | Defense: ${defenseSide.toUpperCase()}`);
  console.log(`You are: ${humanSide.toUpperCase()} (${humanSide === offenseSide ? 'OFFENSE' : 'DEFENSE'})`);

  const lastPlay = engine.state.lastPlay;
  if (lastPlay) {
    console.log(`Last Play: ${lastPlay.message}`);
    console.log(`Result: ${lastPlay.yardsGained >= 0 ? '+' : ''}${lastPlay.yardsGained} yards | TD=${lastPlay.isTouchdown} | TO=${lastPlay.isTurnover}`);
  }

  const hand = engine.state.players[humanSide].hand;
  console.log('\nYour Hand:');
  hand.forEach((card, index) => {
    console.log(`${index + 1}. ${card.name} (${card.type})`);
  });
  console.log('q. Quit');
}

async function main() {
  const rl = createInterface({ input, output });
  const engine = new GameEngine('TERMINAL');
  const humanSide: TeamSide = 'home';
  const botSide: TeamSide = 'away';

  engine.startGame();

  try {
    while (engine.state.phase !== GamePhase.GAME_OVER) {
      if (engine.state.phase === GamePhase.RESOLUTION) {
        engine.advanceAfterResolution();
        continue;
      }

      renderState(engine, humanSide);

      const hand = engine.state.players[humanSide].hand;
      if (hand.length === 0) {
        console.log('No playable cards in hand. Exiting.');
        break;
      }

      const answer = (await rl.question('\nChoose a card number: ')).trim();
      if (answer.toLowerCase() === 'q') {
        console.log('Exiting terminal game.');
        break;
      }

      const selectedIndex = Number(answer) - 1;
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= hand.length) {
        console.log('Invalid selection. Try again.');
        continue;
      }

      const humanCard = hand[selectedIndex];
      const botCard = chooseBotCard(engine, botSide);
      if (!botCard) {
        console.log('Bot has no playable cards. Exiting.');
        break;
      }

      const homeMove = humanSide === 'home' ? humanCard : botCard;
      const awayMove = humanSide === 'home' ? botCard : humanCard;

      const offenseSide = engine.state.field.possessionPlayerId === 'away' ? 'away' : 'home';
      const defenseSide: TeamSide = offenseSide === 'home' ? 'away' : 'home';

      const offenseCardId = offenseSide === 'home' ? homeMove.id : awayMove.id;
      const defenseCardId = defenseSide === 'home' ? homeMove.id : awayMove.id;

      const offenseResult = engine.submitMove(offenseSide, offenseCardId);
      if (!offenseResult.accepted) {
        console.log(`Offense move rejected: ${offenseResult.reason}`);
        continue;
      }

      const defenseResult = engine.submitMove(defenseSide, defenseCardId);
      if (!defenseResult.accepted) {
        console.log(`Defense move rejected: ${defenseResult.reason}`);
        continue;
      }

      if (!defenseResult.resolved) {
        console.log('Turn did not resolve.');
      }

      if (engine.state.lastPlay) {
        console.log(`\nPlay resolved: ${engine.state.lastPlay.message}`);
      }
    }

    if (engine.state.phase === GamePhase.GAME_OVER) {
      const homeScore = engine.state.players.home.score;
      const awayScore = engine.state.players.away.score;
      const winner = homeScore === awayScore ? 'DRAW' : homeScore > awayScore ? 'HOME' : 'AWAY';

      console.log('\n=== GAME OVER ===');
      console.log(`Final Score: HOME ${homeScore} - AWAY ${awayScore}`);
      console.log(`Winner: ${winner}`);
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Terminal game failed:', error);
  process.exitCode = 1;
});
