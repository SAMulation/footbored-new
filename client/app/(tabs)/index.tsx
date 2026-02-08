import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { FieldView } from '@/components/game/FieldView';
import { GameHud } from '@/components/game/GameHud';
import { PlayerHand, SpecialActionItem } from '@/components/game/PlayerHand';
import { useGameSocket } from '../../hooks/use-game-socket';
import { ClientGameState, GamePhase, PlayType } from '../../../shared/types';

const SPECIAL_ACTION_LABELS: Record<PlayType, string> = {
  SR: 'Short Run',
  LR: 'Long Run',
  SP: 'Short Pass',
  LP: 'Long Pass',
  TP: 'Trick Play',
  HM: 'Hail Mary',
  FG: 'Field Goal',
  PT: 'Punt',
  TO: 'Timeout',
  XP: 'Extra Point',
  '2PT': 'Two-Point',
};

const SPECIAL_ACTION_PRIORITY: PlayType[] = ['XP', '2PT', 'TP', 'HM', 'FG', 'PT', 'TO'];

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function formatLastPlayMessage(gameState: ClientGameState): string | null {
  if (!gameState.lastPlay?.message) {
    return null;
  }

  const message = gameState.lastPlay.message;
  const flags = gameState.lastPlay.flags;
  const detailParts: string[] = [];

  if (flags?.kickType) {
    detailParts.push(flags.kickType.replace('_', ' '));
  }
  if (typeof flags?.kickDistance === 'number') {
    detailParts.push(`${flags.kickDistance}y`);
  }
  if (typeof flags?.returnYards === 'number' && flags.returnYards > 0) {
    detailParts.push(`Return ${flags.returnYards}y`);
  }
  if (flags?.kickoffTouchback) {
    detailParts.push('Touchback');
  }
  if (flags?.icedKicker) {
    detailParts.push('Iced');
  }
  if (flags?.conversionType) {
    detailParts.push(`Conversion ${flags.conversionType}`);
  }
  if (typeof flags?.conversionSuccess === 'boolean') {
    detailParts.push(flags.conversionSuccess ? 'Good' : 'Failed');
  }
  if (flags?.mandatoryTwoPoint) {
    detailParts.push('Mandatory 2PT');
  }
  if (flags?.otBucketReset) {
    detailParts.push('OT Bucket Reset');
  }

  return detailParts.length > 0
    ? `${message}\n${detailParts.join(' | ')}`
    : message;
}

function resolvePlayContext(gameState: ClientGameState, isMyTurn: boolean): { title: string; message: string } {
  if (gameState.phase === GamePhase.CONVERSION_OFFENSE_SELECT && !isMyTurn) {
    return {
      title: 'CONVERSION',
      message: 'Opponent is choosing XP or 2PT.',
    };
  }
  if (gameState.phase === GamePhase.CONVERSION_DEFENSE_SELECT && !isMyTurn) {
    return {
      title: 'CONVERSION',
      message: 'Opponent is selecting defense for the 2PT attempt.',
    };
  }

  if (gameState.waitingForOpponent) {
    return {
      title: 'STATUS',
      message: 'Waiting for opponent to lock in a card...',
    };
  }
  const lastPlayMessage = formatLastPlayMessage(gameState);
  if (lastPlayMessage) {
    return {
      title: 'PREVIOUS PLAY',
      message: lastPlayMessage,
    };
  }
  if (isMyTurn) {
    if (gameState.phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
      const forced = gameState.conversion?.mandatoryTwoPoint;
      return {
        title: 'CONVERSION',
        message: forced
          ? 'Two-point conversion required in this overtime period.'
          : 'Choose Extra Point or Two-Point conversion.',
      };
    }
    if (gameState.phase === GamePhase.CONVERSION_DEFENSE_SELECT) {
      return {
        title: 'CONVERSION',
        message: 'Select a standard play for the two-point attempt.',
      };
    }
    return {
      title: 'PICK YOUR PLAY',
      message: 'Select one card from your rail to resolve this down.',
    };
  }
  return {
    title: 'STATUS',
    message: 'Opponent is choosing their card.',
  };
}

interface LobbyShellProps {
  roomInput: string;
  onRoomInputChange: (value: string) => void;
  onQuickPlay: () => void;
  onJoinRoom: () => void;
  onCreateRoom: () => void;
  isConnected: boolean;
  isPhone: boolean;
}

function LobbyShell({
  roomInput,
  onRoomInputChange,
  onQuickPlay,
  onJoinRoom,
  onCreateRoom,
  isConnected,
  isPhone,
}: LobbyShellProps) {
  return (
    <View style={styles.lobbyShell}>
      <View style={[styles.lobbyPanel, isPhone && styles.lobbyPanelPhone]}>
        <View style={styles.lobbyHeader}>
          <Text style={[styles.title, isPhone && styles.titlePhone]}>FootBored 6.0</Text>
          <Text style={styles.lobbyConnection}>{isConnected ? 'Server Online' : 'Server Offline'}</Text>
        </View>

        <TouchableOpacity style={styles.quickPlayButton} onPress={onQuickPlay}>
          <Text style={styles.quickPlayButtonText}>Quick Play (vs Bot)</Text>
        </TouchableOpacity>

        <Text style={styles.advancedLabel}>Advanced Multiplayer</Text>
        <Text style={styles.roomLabel}>Room Code</Text>
        <TextInput
          value={roomInput}
          onChangeText={onRoomInputChange}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.roomInput}
          placeholder="ABCD"
          placeholderTextColor="#95a5a6"
          maxLength={8}
        />
        <View style={[styles.joinActions, isPhone && styles.joinActionsPhone]}>
          <TouchableOpacity style={styles.primaryButton} onPress={onJoinRoom}>
            <Text style={styles.primaryButtonText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onCreateRoom}>
            <Text style={styles.secondaryButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

interface InGameShellProps {
  gameState: ClientGameState;
  roomId: string | null;
  matchMode: 'MULTIPLAYER' | 'BOT' | null;
  isMyTurn: boolean;
  possession: 'home' | 'away';
  isPhone: boolean;
  isCompactDesktop: boolean;
}

function InGameShell({
  gameState,
  roomId,
  matchMode,
  isMyTurn,
  possession,
  isPhone,
  isCompactDesktop,
}: InGameShellProps) {
  const playContext = resolvePlayContext(gameState, isMyTurn);

  return (
    <View style={[styles.inGameShell, isCompactDesktop && styles.inGameShellCompact]}>
      <View style={styles.inGameTopRow}>
        {matchMode === 'BOT' ? <Text style={styles.modeBadge}>BOT MATCH</Text> : <View />}
        <Text style={styles.roomBadge}>ROOM: {roomId ?? 'N/A'}</Text>
      </View>

      <View style={[styles.fieldFrame, isCompactDesktop && styles.fieldFrameCompact]}>
        <FieldView
          ballOn={gameState.field.ballOn}
          toGo={gameState.field.toGo}
          offenseSide={possession}
        />
      </View>

      <View style={[styles.playContextPanel, isCompactDesktop && styles.playContextPanelCompact]}>
        <Text style={styles.playContextTitle}>{playContext.title}</Text>
        <Text style={[styles.playContextText, isPhone && styles.playContextTextPhone]}>{playContext.message}</Text>
      </View>
    </View>
  );
}

interface GameOverShellProps {
  homeScore: number;
  awayScore: number;
  winner: string;
  onPlayAgain: () => void;
  isPhone: boolean;
}

function GameOverShell({ homeScore, awayScore, winner, onPlayAgain, isPhone }: GameOverShellProps) {
  return (
    <View style={[styles.gameOverOverlay, isPhone && styles.gameOverOverlayPhone]}>
      <Text style={[styles.gameOverTitle, isPhone && styles.gameOverTitlePhone]}>GAME OVER</Text>
      <Text style={[styles.gameOverScore, isPhone && styles.gameOverScorePhone]}>HOME {homeScore} - {awayScore} AWAY</Text>
      <Text style={styles.gameOverWinner}>WINNER: {winner}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onPlayAgain}>
        <Text style={styles.primaryButtonText}>Play Again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GameScreen() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isPhone = viewportWidth < 620;
  const isCompactDesktop = viewportWidth < 1280;
  const isShortSurface = viewportHeight < 760;

  const {
    gameState,
    isConnected,
    roomId,
    seat,
    matchMode,
    isRejoining,
    joinError,
    lastJoinWasRejoin,
    joinGame,
    quickPlayBot,
    playCard,
    playAgain,
  } = useGameSocket();
  const [roomInput, setRoomInput] = useState('TEST_ROOM');

  const mySide = seat ?? (gameState?.myState.teamName === 'Away Team' ? 'away' : 'home');
  const possession = gameState?.field.possessionPlayerId === 'away' ? 'away' : 'home';

  const isMyTurn = !!gameState && (() => {
    if (gameState.waitingForOpponent) {
      return false;
    }
    if (gameState.phase === GamePhase.OFFENSE_SELECT || gameState.phase === GamePhase.DEFENSE_SELECT) {
      return true;
    }
    if (gameState.phase === GamePhase.CONVERSION_DEFENSE_SELECT) {
      return true;
    }
    if (gameState.phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
      return gameState.conversion?.offenseSide === mySide;
    }
    return false;
  })();

  const homeScore = gameState
    ? (mySide === 'home' ? gameState.myState.score : gameState.opponentState.score)
    : 0;
  const awayScore = gameState
    ? (mySide === 'away' ? gameState.myState.score : gameState.opponentState.score)
    : 0;
  const homeTimeouts = gameState
    ? (mySide === 'home' ? gameState.myState.timeouts : gameState.opponentState.timeouts)
    : 3;
  const awayTimeouts = gameState
    ? (mySide === 'away' ? gameState.myState.timeouts : gameState.opponentState.timeouts)
    : 3;
  const homeDeckCount = gameState
    ? (mySide === 'home' ? gameState.myState.deckCount : gameState.opponentState.deckCount)
    : 0;
  const awayDeckCount = gameState
    ? (mySide === 'away' ? gameState.myState.deckCount : gameState.opponentState.deckCount)
    : 0;

  const specialActionsByType = useMemo(() => {
    const byType = new Map<PlayType, { id: string; enabled: boolean; remaining: number | null; reason?: string }>();
    if (!gameState) return byType;

    for (const action of gameState.myState.specialActions) {
      if (!byType.has(action.type)) {
        byType.set(action.type, {
          id: action.id,
          enabled: action.enabled,
          remaining: action.remaining,
          reason: action.reason,
        });
      }
    }

    return byType;
  }, [gameState]);

  const specialActionItems = useMemo(() => {
    if (!gameState || !isMyTurn) {
      return [];
    }

    const toPriority = (type: PlayType) => {
      const index = SPECIAL_ACTION_PRIORITY.indexOf(type);
      return index === -1 ? 999 : index;
    };

    return gameState.myState.specialActions
      .slice()
      .sort((a, b) => toPriority(a.type) - toPriority(b.type))
      .map((action) => {
        const state = specialActionsByType.get(action.type);
        if (!state) return null;
        const label = SPECIAL_ACTION_LABELS[action.type] ?? action.type;
        const suffix = state.remaining === null ? '' : ` (${state.remaining})`;
        let reasonSuffix = '';
        if (!state.enabled) {
          if (state.reason === 'mandatory_two_point') {
            reasonSuffix = ' - locked (2PT required)';
          } else if (state.reason === 'offense_only') {
            reasonSuffix = ' - offense only';
          } else if (state.reason === 'fourth_down_only') {
            reasonSuffix = ' - 4th down only';
          } else if (state.reason === 'timeouts_exhausted') {
            reasonSuffix = ' - no timeouts';
          } else if (state.reason === 'hm_exhausted') {
            reasonSuffix = ' - HM exhausted';
          } else if (state.reason === 'tp_exhausted') {
            reasonSuffix = ' - TP exhausted';
          } else if (state.reason) {
            reasonSuffix = ` - ${state.reason.replace(/_/g, ' ')}`;
          }
        }
        return {
          cardId: state.id,
          label: `${label}${suffix}${reasonSuffix}`,
          enabled: state.enabled,
        };
      })
      .filter((item): item is SpecialActionItem => item !== null);
  }, [gameState, isMyTurn, specialActionsByType]);

  const joinSelectedRoom = () => {
    const normalized = roomInput.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    joinGame(normalized);
  };

  const createRoom = () => {
    const code = generateRoomCode();
    setRoomInput(code);
    joinGame(code);
  };

  const isGameOver = gameState?.phase === 'GAME_OVER';
  const winner = homeScore === awayScore ? 'DRAW' : homeScore > awayScore ? 'HOME' : 'AWAY';

  return (
    <SafeAreaView style={styles.container}>
      <GameHud
        homeScore={homeScore}
        awayScore={awayScore}
        quarter={gameState?.field.quarter ?? 1}
        clockSeconds={gameState?.field.clockSeconds ?? 900}
        down={gameState?.field.down ?? 1}
        toGo={gameState?.field.toGo ?? 10}
        possession={possession}
        isConnected={isConnected}
        isRejoining={isRejoining}
        phase={gameState?.phase ?? null}
        waitingForOpponent={gameState?.waitingForOpponent ?? false}
        isMyTurn={isMyTurn}
        homeTimeouts={homeTimeouts}
        awayTimeouts={awayTimeouts}
        homeDeckCount={homeDeckCount}
        awayDeckCount={awayDeckCount}
      />

      <View style={styles.playSurface}>
        <View style={[styles.surfaceContent, isShortSurface && styles.surfaceContentShort]}>
          {!gameState ? (
            <LobbyShell
              roomInput={roomInput}
              onRoomInputChange={setRoomInput}
              onQuickPlay={quickPlayBot}
              onJoinRoom={joinSelectedRoom}
              onCreateRoom={createRoom}
              isConnected={isConnected}
              isPhone={isPhone}
            />
          ) : (
            <InGameShell
              gameState={gameState}
              roomId={roomId}
              matchMode={matchMode}
              isMyTurn={isMyTurn}
              possession={possession}
              isPhone={isPhone}
              isCompactDesktop={isCompactDesktop}
            />
          )}
        </View>

        <View style={[styles.bannerStack, isPhone && styles.bannerStackPhone]}>
          {isRejoining && (
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerText}>Reconnecting...</Text>
            </View>
          )}
          {!isRejoining && lastJoinWasRejoin && seat && (
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerText}>Rejoined as {seat.toUpperCase()}</Text>
            </View>
          )}
          {joinError && (
            <View style={styles.bannerError}>
              <Text style={styles.bannerText}>{joinError}</Text>
            </View>
          )}
        </View>

        {isGameOver && (
          <GameOverShell
            homeScore={homeScore}
            awayScore={awayScore}
            winner={winner}
            onPlayAgain={playAgain}
            isPhone={isPhone}
          />
        )}
      </View>

      {gameState && (
        <PlayerHand
          hand={gameState.myState.hand}
          onPlayCard={playCard}
          specialActions={specialActionItems}
          disabled={!isMyTurn || isGameOver || isRejoining}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1215',
  },
  playSurface: {
    flex: 1,
    width: '100%',
    backgroundColor: '#245b29',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'relative',
  },
  surfaceContent: {
    width: '100%',
    maxWidth: 1200,
    flex: 1,
  },
  surfaceContentShort: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  lobbyShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lobbyPanel: {
    width: '100%',
    maxWidth: 950,
    backgroundColor: 'rgba(11, 46, 20, 0.84)',
    borderColor: 'rgba(94, 148, 96, 0.6)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  lobbyPanelPhone: {
    padding: 14,
    gap: 8,
  },
  lobbyHeader: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '900',
    textAlign: 'center',
  },
  titlePhone: {
    fontSize: 26,
  },
  lobbyConnection: {
    color: '#bde3c1',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  quickPlayButton: {
    width: '100%',
    backgroundColor: '#f1c40f',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  quickPlayButtonText: {
    color: '#1e1e1e',
    fontWeight: '900',
    fontSize: 15,
  },
  advancedLabel: {
    color: '#c0d8c2',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  roomLabel: {
    color: '#d9d9d9',
    fontWeight: '700',
    fontSize: 12,
  },
  roomInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#4c5b4d',
    backgroundColor: '#1f2820',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  joinActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  joinActionsPhone: {
    flexDirection: 'column',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#2d8a3e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: '#3b4d3e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#dfe7df',
    fontWeight: '700',
    fontSize: 13,
  },
  inGameShell: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: 12,
  },
  inGameShellCompact: {
    gap: 9,
  },
  inGameTopRow: {
    width: '100%',
    maxWidth: 1000,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeBadge: {
    color: '#1f1600',
    backgroundColor: '#f1c40f',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  roomBadge: {
    color: '#d3efd4',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  fieldFrame: {
    width: '100%',
    maxWidth: 1050,
    backgroundColor: 'rgba(12, 43, 18, 0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(106, 176, 118, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  fieldFrameCompact: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  playContextPanel: {
    width: '100%',
    maxWidth: 1050,
    backgroundColor: 'rgba(4, 34, 14, 0.86)',
    borderColor: 'rgba(84, 149, 97, 0.62)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
  },
  playContextPanelCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  playContextTitle: {
    color: '#f1c40f',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  playContextText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  playContextTextPhone: {
    fontSize: 15,
  },
  bannerStack: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    alignItems: 'center',
    gap: 6,
  },
  bannerStackPhone: {
    bottom: 6,
    left: 10,
    right: 10,
  },
  bannerInfo: {
    backgroundColor: 'rgba(41,128,185,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerError: {
    backgroundColor: 'rgba(192,57,43,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  gameOverOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 28,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderColor: '#f1c40f',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  gameOverOverlayPhone: {
    top: 18,
    left: 12,
    right: 12,
    padding: 12,
  },
  gameOverTitle: {
    color: '#f1c40f',
    fontWeight: '900',
    fontSize: 22,
  },
  gameOverTitlePhone: {
    fontSize: 18,
  },
  gameOverScore: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  gameOverScorePhone: {
    fontSize: 14,
  },
  gameOverWinner: {
    color: '#d7f7d8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
});
