import fs from 'node:fs';
import path from 'node:path';

import { GamePhase, PlayType, ServerGameState } from '../../../shared/types';
import { GameEngine, TeamSide } from '../engine';

interface TraceOptions {
  seed: string;
  maxSteps: number;
  stallThreshold: number;
  outPath?: string;
  quiet: boolean;
}

interface PlannedAction {
  side: TeamSide;
  cardId: string;
  cardType: PlayType;
  source: 'hand' | 'special';
}

interface InvariantResult {
  ok: boolean;
  errors: string[];
}

const DEFAULT_MAX_STEPS = 450;
const DEFAULT_STALL_THRESHOLD = 8;

function parseArgs(argv: string[]): TraceOptions {
  const options: TraceOptions = {
    seed: `TRACE-${Date.now()}`,
    maxSteps: DEFAULT_MAX_STEPS,
    stallThreshold: DEFAULT_STALL_THRESHOLD,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--seed' && argv[i + 1]) {
      options.seed = argv[i + 1]!;
      i += 1;
      continue;
    }
    if (arg === '--max-steps' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1]!, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxSteps = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === '--stall-threshold' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1]!, 10);
      if (Number.isFinite(parsed) && parsed > 1) {
        options.stallThreshold = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === '--out' && argv[i + 1]) {
      options.outPath = argv[i + 1]!;
      i += 1;
      continue;
    }
    if (arg === '--quiet') {
      options.quiet = true;
      continue;
    }
  }

  return options;
}

function hashToIndex(seed: string, max: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % max;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getOffenseSide(state: ServerGameState): TeamSide {
  return state.field.possessionPlayerId === 'away' ? 'away' : 'home';
}

function getDefenseSide(state: ServerGameState): TeamSide {
  return getOffenseSide(state) === 'home' ? 'away' : 'home';
}

function getEnabledSpecial(state: ServerGameState, side: TeamSide, type: PlayType) {
  return state.players[side].specialActions.find((action) => action.type === type && action.enabled);
}

function getStandardHandCards(state: ServerGameState, side: TeamSide) {
  return state.players[side].hand.filter((card) => card.type === 'SR' || card.type === 'LR' || card.type === 'SP' || card.type === 'LP');
}

function pickDeterministic<T>(items: T[], seed: string): T {
  return items[hashToIndex(seed, items.length)]!;
}

function chooseStandardCard(state: ServerGameState, side: TeamSide, seed: string): PlannedAction {
  const standard = getStandardHandCards(state, side);
  const hand = state.players[side].hand;
  const candidates = standard.length > 0 ? standard : hand;
  const toGo = state.field.toGo;

  let preferred = candidates;
  if (toGo <= 3) {
    const short = candidates.filter((card) => card.type === 'SR' || card.type === 'SP');
    preferred = short.length > 0 ? short : candidates;
  } else if (toGo >= 8) {
    const deep = candidates.filter((card) => card.type === 'LR' || card.type === 'LP');
    preferred = deep.length > 0 ? deep : candidates;
  }

  const card = pickDeterministic(preferred, seed);
  return {
    side,
    cardId: card.id,
    cardType: card.type,
    source: 'hand',
  };
}

function chooseRegularAction(engine: GameEngine, side: TeamSide, seedBase: string): PlannedAction {
  const state = engine.state;
  const offense = getOffenseSide(state);
  const isOffense = side === offense;
  const toGo = state.field.toGo;
  const down = state.field.down;
  const ballOn = state.field.ballOn;

  if (isOffense) {
    if (down === 4) {
      const fg = getEnabledSpecial(state, side, 'FG');
      if (fg && ballOn >= 58) {
        return { side, cardId: fg.id, cardType: 'FG', source: 'special' };
      }
      const punt = getEnabledSpecial(state, side, 'PT');
      if (punt) {
        return { side, cardId: punt.id, cardType: 'PT', source: 'special' };
      }
    }

    if (toGo >= 14) {
      const hm = getEnabledSpecial(state, side, 'HM');
      if (hm) {
        return { side, cardId: hm.id, cardType: 'HM', source: 'special' };
      }
    }

    if (toGo >= 8) {
      const tp = getEnabledSpecial(state, side, 'TP');
      if (tp) {
        return { side, cardId: tp.id, cardType: 'TP', source: 'special' };
      }
    }
  } else {
    if (down === 4 && ballOn >= 58) {
      const to = getEnabledSpecial(state, side, 'TO');
      if (to) {
        return { side, cardId: to.id, cardType: 'TO', source: 'special' };
      }
    }
  }

  return chooseStandardCard(state, side, `${seedBase}|std`);
}

function chooseConversionOffenseAction(engine: GameEngine, side: TeamSide): PlannedAction {
  const conversion = engine.state.conversion;
  const mustTwoPoint = !!conversion?.mandatoryTwoPoint;
  const preferredType: PlayType = mustTwoPoint ? '2PT' : 'XP';
  const fallbackType: PlayType = mustTwoPoint ? 'XP' : '2PT';

  const preferred = getEnabledSpecial(engine.state, side, preferredType);
  if (preferred) {
    return {
      side,
      cardId: preferred.id,
      cardType: preferredType,
      source: 'special',
    };
  }

  const fallback = getEnabledSpecial(engine.state, side, fallbackType);
  if (!fallback) {
    throw new Error(`No conversion special action available for ${side}`);
  }

  return {
    side,
    cardId: fallback.id,
    cardType: fallbackType,
    source: 'special',
  };
}

function planActions(engine: GameEngine, step: number): PlannedAction[] {
  const state = engine.state;
  const phase = state.phase;
  const offense = getOffenseSide(state);
  const defense = getDefenseSide(state);
  const stepSeed = `${state.roomId}|${step}|${phase}|${state.field.quarter}|${state.field.clockSeconds}|${state.field.down}|${state.field.toGo}|${state.field.ballOn}`;

  if (phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
    const conversion = state.conversion;
    if (!conversion) {
      throw new Error('Conversion offense phase without conversion state');
    }
    return [chooseConversionOffenseAction(engine, conversion.offenseSide)];
  }

  if (phase === GamePhase.CONVERSION_DEFENSE_SELECT) {
    return [
      chooseStandardCard(state, offense, `${stepSeed}|off-conv`),
      chooseStandardCard(state, defense, `${stepSeed}|def-conv`),
    ];
  }

  if (phase === GamePhase.OFFENSE_SELECT || phase === GamePhase.DEFENSE_SELECT) {
    return [
      chooseRegularAction(engine, offense, `${stepSeed}|off`),
      chooseRegularAction(engine, defense, `${stepSeed}|def`),
    ];
  }

  return [];
}

function allowedTransition(prev: GamePhase | null, next: GamePhase): boolean {
  if (!prev || prev === next) {
    return true;
  }

  const allowed = new Set<string>([
    `${GamePhase.LOBBY}->${GamePhase.OFFENSE_SELECT}`,
    `${GamePhase.COIN_TOSS}->${GamePhase.OFFENSE_SELECT}`,
    `${GamePhase.OFFENSE_SELECT}->${GamePhase.RESOLUTION}`,
    `${GamePhase.DEFENSE_SELECT}->${GamePhase.RESOLUTION}`,
    `${GamePhase.OFFENSE_SELECT}->${GamePhase.CONVERSION_OFFENSE_SELECT}`,
    `${GamePhase.DEFENSE_SELECT}->${GamePhase.CONVERSION_OFFENSE_SELECT}`,
    `${GamePhase.RESOLUTION}->${GamePhase.OFFENSE_SELECT}`,
    `${GamePhase.RESOLUTION}->${GamePhase.DEFENSE_SELECT}`,
    `${GamePhase.RESOLUTION}->${GamePhase.CONVERSION_OFFENSE_SELECT}`,
    `${GamePhase.RESOLUTION}->${GamePhase.GAME_OVER}`,
    `${GamePhase.CONVERSION_OFFENSE_SELECT}->${GamePhase.CONVERSION_DEFENSE_SELECT}`,
    `${GamePhase.CONVERSION_OFFENSE_SELECT}->${GamePhase.CONVERSION_RESOLUTION}`,
    `${GamePhase.CONVERSION_DEFENSE_SELECT}->${GamePhase.CONVERSION_RESOLUTION}`,
    `${GamePhase.CONVERSION_RESOLUTION}->${GamePhase.OFFENSE_SELECT}`,
    `${GamePhase.CONVERSION_RESOLUTION}->${GamePhase.DEFENSE_SELECT}`,
    `${GamePhase.CONVERSION_RESOLUTION}->${GamePhase.GAME_OVER}`,
  ]);
  return allowed.has(`${prev}->${next}`);
}

function checkInvariants(state: ServerGameState, prevPhase: GamePhase | null): InvariantResult {
  const errors: string[] = [];

  if (state.field.ballOn < 0 || state.field.ballOn > 100) {
    errors.push(`ballOn out of bounds: ${state.field.ballOn}`);
  }
  if (state.field.down < 1 || state.field.down > 4) {
    errors.push(`down out of bounds: ${state.field.down}`);
  }
  if (state.field.toGo < 0) {
    errors.push(`toGo negative: ${state.field.toGo}`);
  }
  if (!state.field.isOvertime && state.field.clockSeconds < 0) {
    errors.push(`clockSeconds negative in regulation: ${state.field.clockSeconds}`);
  }
  if (state.players.home.score < 0 || state.players.away.score < 0) {
    errors.push(`score negative: home=${state.players.home.score}, away=${state.players.away.score}`);
  }
  if (!allowedTransition(prevPhase, state.phase)) {
    errors.push(`invalid phase transition: ${prevPhase} -> ${state.phase}`);
  }

  const conversionPhase =
    state.phase === GamePhase.CONVERSION_OFFENSE_SELECT
    || state.phase === GamePhase.CONVERSION_DEFENSE_SELECT
    || state.phase === GamePhase.CONVERSION_RESOLUTION;
  if (conversionPhase && !state.conversion) {
    errors.push(`phase ${state.phase} requires conversion state`);
  }
  if (!conversionPhase && state.conversion && state.phase !== GamePhase.GAME_OVER) {
    errors.push(`conversion state leaked outside conversion phases (phase=${state.phase})`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function makeStateFingerprint(state: ServerGameState): string {
  return [
    state.phase,
    state.field.quarter,
    state.field.clockSeconds,
    state.field.down,
    state.field.toGo,
    state.field.ballOn,
    state.field.possessionPlayerId,
    state.players.home.score,
    state.players.away.score,
    state.conversion?.offenseSide ?? '-',
    state.conversion?.attemptType ?? '-',
  ].join('|');
}

function summarizeState(state: ServerGameState): string {
  const offense = getOffenseSide(state).toUpperCase();
  return `Q${state.field.quarter} ${formatClock(state.field.clockSeconds)} | ${offense} ball ${state.field.ballOn} | ${state.field.down}&${state.field.toGo} | score H${state.players.home.score}-A${state.players.away.score} | phase ${state.phase}`;
}

function stringifyFlags(flags?: Record<string, unknown>): string {
  if (!flags) {
    return 'none';
  }

  const entries = Object.entries(flags).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return 'none';
  }
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(', ');
}

function buildOutputPath(options: TraceOptions): string {
  if (options.outPath) {
    return path.resolve(options.outPath);
  }

  const safeSeed = options.seed.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(`.artifacts/traces/state-trace-${safeSeed}-${timestamp}.md`);
}

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function runTrace(options: TraceOptions): { outputPath: string; summary: string } {
  const engine = new GameEngine(options.seed);
  engine.startGame();

  const outLines: string[] = [];
  outLines.push('# FootBored Deterministic State Trace');
  outLines.push('');
  outLines.push(`- Seed: \`${options.seed}\``);
  outLines.push(`- Max steps: \`${options.maxSteps}\``);
  outLines.push(`- Stall threshold: \`${options.stallThreshold}\``);
  outLines.push(`- Started at: \`${new Date().toISOString()}\``);
  outLines.push('');
  outLines.push(`Initial state: ${summarizeState(engine.state)}`);
  outLines.push('');

  const seenFingerprints = new Map<string, number>();
  let prevPhase: GamePhase | null = null;
  let terminalReason = 'MAX_STEPS_REACHED';
  let stepsRun = 0;

  for (let step = 1; step <= options.maxSteps; step += 1) {
    stepsRun = step;
    const stateBefore = engine.state;
    const beforeSummary = summarizeState(stateBefore);
    const fingerprint = makeStateFingerprint(stateBefore);
    const seenCount = (seenFingerprints.get(fingerprint) ?? 0) + 1;
    seenFingerprints.set(fingerprint, seenCount);

    if (seenCount > options.stallThreshold) {
      terminalReason = `STALL_DETECTED (state repeated ${seenCount}x)`;
      outLines.push(`## Step ${step}`);
      outLines.push(`- State before: ${beforeSummary}`);
      outLines.push(`- Terminated: ${terminalReason}`);
      outLines.push('');
      break;
    }

    const invariants = checkInvariants(stateBefore, prevPhase);
    if (!invariants.ok) {
      terminalReason = 'INVARIANT_FAILURE';
      outLines.push(`## Step ${step}`);
      outLines.push(`- State before: ${beforeSummary}`);
      outLines.push(`- Invariant errors: ${invariants.errors.join(' | ')}`);
      outLines.push('');
      break;
    }

    const actions = planActions(engine, step);
    const actionNotes: string[] = [];
    if (actions.length === 0 && stateBefore.phase !== GamePhase.GAME_OVER) {
      terminalReason = `NO_ACTIONS_FOR_PHASE_${stateBefore.phase}`;
      outLines.push(`## Step ${step}`);
      outLines.push(`- State before: ${beforeSummary}`);
      outLines.push(`- Terminated: ${terminalReason}`);
      outLines.push('');
      break;
    }

    let moveRejectedReason: string | null = null;
    for (const action of actions) {
      const result = engine.submitMove(action.side, action.cardId);
      actionNotes.push(`${action.side.toUpperCase()} ${action.source}:${action.cardType} (${action.cardId}) => accepted=${result.accepted}, resolved=${result.resolved}${result.reason ? `, reason=${result.reason}` : ''}`);
      if (!result.accepted) {
        moveRejectedReason = result.reason ?? 'unknown';
        break;
      }
    }

    if (moveRejectedReason) {
      terminalReason = `MOVE_REJECTED (${moveRejectedReason})`;
      outLines.push(`## Step ${step}`);
      outLines.push(`- State before: ${beforeSummary}`);
      outLines.push('- Actions:');
      for (const note of actionNotes) outLines.push(`  - ${note}`);
      outLines.push(`- Terminated: ${terminalReason}`);
      outLines.push('');
      break;
    }

    while (engine.state.phase === GamePhase.RESOLUTION || engine.state.phase === GamePhase.CONVERSION_RESOLUTION) {
      engine.advanceAfterResolution();
    }

    const stateAfter = engine.state;
    const afterSummary = summarizeState(stateAfter);
    const lastPlay = stateAfter.lastPlay;

    outLines.push(`## Step ${step}`);
    outLines.push(`- State before: ${beforeSummary}`);
    outLines.push('- Actions:');
    for (const note of actionNotes) outLines.push(`  - ${note}`);
    if (lastPlay) {
      outLines.push(`- Last play: ${lastPlay.message}`);
      outLines.push(`- Last play flags: ${stringifyFlags(lastPlay.flags)}`);
    } else {
      outLines.push('- Last play: none');
    }
    outLines.push(`- State after: ${afterSummary}`);
    outLines.push('');

    prevPhase = stateAfter.phase;
    if (stateAfter.phase === GamePhase.GAME_OVER) {
      terminalReason = 'GAME_OVER';
      break;
    }
  }

  outLines.push('## Summary');
  outLines.push(`- Terminal reason: \`${terminalReason}\``);
  outLines.push(`- Steps run: \`${stepsRun}\``);
  outLines.push(`- Final score: \`HOME ${engine.state.players.home.score} - ${engine.state.players.away.score} AWAY\``);
  outLines.push(`- Final state: ${summarizeState(engine.state)}`);
  outLines.push('');

  const outputPath = buildOutputPath(options);
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, `${outLines.join('\n')}\n`, 'utf8');

  return {
    outputPath,
    summary: `${terminalReason} in ${stepsRun} step(s); HOME ${engine.state.players.home.score} - ${engine.state.players.away.score} AWAY`,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runTrace(options);

  if (!options.quiet) {
    console.log('Trace complete.');
    console.log(`Summary: ${result.summary}`);
    console.log(`Output: ${result.outputPath}`);
  }
}

main();
