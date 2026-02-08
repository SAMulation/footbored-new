import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { FieldView } from '@/components/game/FieldView';
import { GameHud } from '@/components/game/GameHud';
import { PlayerHand, SpecialActionCategory, SpecialActionItem } from '@/components/game/PlayerHand';
import { useGameSocket } from '../../hooks/use-game-socket';
import { Card, ClientGameState, GamePhase, PlayType } from '../../../shared/types';

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
const HIGH_IMPACT_TYPES = new Set<PlayType>(['FG', 'PT', 'TO', '2PT']);

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function resolveActionCategory(type: PlayType): SpecialActionCategory {
  if (type === 'XP' || type === '2PT') return 'conversion';
  if (type === 'TO') return 'clock';
  return 'special';
}

function formatActionReason(reason?: string): string {
  if (!reason) return 'Not legal right now';

  if (reason === 'mandatory_two_point') return '2PT required';
  if (reason === 'offense_only') return 'Offense only';
  if (reason === 'fourth_down_only') return '4th down only';
  if (reason === 'timeouts_exhausted') return 'No timeouts left';
  if (reason === 'hm_exhausted') return 'Hail Mary exhausted';
  if (reason === 'tp_exhausted') return 'Trick Play exhausted';

  return reason.replace(/_/g, ' ');
}

function normalizeRecapMessage(message: string): string {
  const trimmed = message.trim();

  const standardMatch = trimmed.match(
    /^(.+?)\s*->\s*quality\s+([^;]+);\s*multiplier\s+([^;]+);\s*yard card\s+([^;]+);\s*result\s+(.+)\.?$/i,
  );
  if (standardMatch) {
    const [, cause, quality, multiplier, yardCard, result] = standardMatch;
    return `Cause: ${cause} | Calculation: quality ${quality}, multiplier ${multiplier}, yard card ${yardCard} | Result: ${result.replace(/\.$/, '')}`;
  }

  const causeResultMatch = trimmed.match(/^(.+?)\s*->\s*(.+)$/);
  if (causeResultMatch) {
    const [, cause, result] = causeResultMatch;
    return `Cause: ${cause} | Result: ${result.replace(/\.$/, '')}`;
  }

  return trimmed;
}

function formatLastPlayMessage(gameState: ClientGameState): string | null {
  if (!gameState.lastPlay?.message) {
    return null;
  }

  const baseMessage = normalizeRecapMessage(gameState.lastPlay.message);
  const flags = gameState.lastPlay.flags;
  const contextParts: string[] = [];

  if (flags?.kickType) {
    contextParts.push(`Kick ${flags.kickType.replace('_', ' ')}`);
  }
  if (typeof flags?.kickDistance === 'number') {
    contextParts.push(`${flags.kickDistance}y`);
  }
  if (typeof flags?.kickResultSpot === 'number') {
    contextParts.push(`Spot ${flags.kickResultSpot}`);
  }
  if (typeof flags?.returnYards === 'number' && flags.returnYards > 0) {
    contextParts.push(`Return ${flags.returnYards}y`);
  }
  if (flags?.kickoffTouchback) {
    contextParts.push('Touchback');
  }
  if (flags?.icedKicker) {
    contextParts.push('Iced kicker');
  }
  if (flags?.conversionType) {
    contextParts.push(`Conversion ${flags.conversionType}`);
  }
  if (typeof flags?.conversionSuccess === 'boolean') {
    contextParts.push(flags.conversionSuccess ? 'Conversion good' : 'Conversion failed');
  }
  if (flags?.mandatoryTwoPoint) {
    contextParts.push('Mandatory 2PT');
  }
  if (flags?.otBucketReset) {
    contextParts.push('OT resource reset');
  }

  return contextParts.length > 0 ? `${baseMessage}\nContext: ${contextParts.join(' • ')}` : baseMessage;
}

function buildToastMessage(gameState: ClientGameState): string | null {
  if (!gameState.lastPlay?.message) return null;
  const normalized = normalizeRecapMessage(gameState.lastPlay.message);
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function resolvePlayContext(gameState: ClientGameState, isMyTurn: boolean): { title: string; message: string } {
  if (gameState.phase === GamePhase.COIN_TOSS) {
    return {
      title: 'COIN TOSS',
      message: 'Opening toss and kickoff are resolving.',
    };
  }

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
  transientNotice: string | null;
  playToast: string | null;
  showDesktopRail: boolean;
  hand: Card[];
  specialActions: SpecialActionItem[];
  onPlayCard: (cardId: string) => void;
  railDisabled: boolean;
  railDisabledReason?: string;
  recommendedCardId: string | null;
  fieldFocusMode: boolean;
  onToggleFieldFocus: () => void;
  railMaxHeight: number;
}

function InGameShell({
  gameState,
  roomId,
  matchMode,
  isMyTurn,
  possession,
  isPhone,
  isCompactDesktop,
  transientNotice,
  playToast,
  showDesktopRail,
  hand,
  specialActions,
  onPlayCard,
  railDisabled,
  railDisabledReason,
  recommendedCardId,
  fieldFocusMode,
  onToggleFieldFocus,
  railMaxHeight,
}: InGameShellProps) {
  const playContext = resolvePlayContext(gameState, isMyTurn);
  const desktopGridStyle = showDesktopRail && Platform.OS === 'web'
    ? ({
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) clamp(300px, 25vw, 360px)',
      alignItems: 'start',
      columnGap: 12,
    } as const)
    : null;
  const desktopStickyRailStyle = showDesktopRail && Platform.OS === 'web'
    ? ({
      position: 'sticky',
      top: 8,
      alignSelf: 'start',
      maxHeight: railMaxHeight,
    } as const)
    : null;

  return (
    <View style={[styles.inGameShell, isCompactDesktop && styles.inGameShellCompact]}>
      <View style={[styles.inGameTopRow, isCompactDesktop && styles.inGameTopRowCompact]}>
        <View style={styles.topRowLeftCluster}>
          {matchMode === 'BOT' ? <Text style={styles.modeBadge}>BOT MATCH</Text> : <View />}
          <TouchableOpacity style={styles.focusToggle} onPress={onToggleFieldFocus}>
            <Text style={styles.focusToggleText}>{fieldFocusMode ? 'Show Controls' : 'Field Focus'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.roomBadge}>ROOM: {roomId ?? 'N/A'}</Text>
      </View>

      {transientNotice && (
        <View style={styles.transientNotice}>
          <Text style={styles.transientNoticeText}>{transientNotice}</Text>
        </View>
      )}

      {playToast && (
        <View style={styles.playToast}>
          <Text style={styles.playToastText}>{playToast}</Text>
        </View>
      )}

      <View style={[styles.desktopArena, showDesktopRail && styles.desktopArenaActive, desktopGridStyle]}>
        <View style={[
          styles.desktopMainColumn,
          showDesktopRail && styles.desktopMainColumnActive,
          fieldFocusMode && styles.desktopMainColumnFocused,
        ]}>
          <View style={[styles.fieldFrame, isCompactDesktop && styles.fieldFrameCompact, fieldFocusMode && styles.fieldFrameFocus]}>
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

        {showDesktopRail && (
          <View style={[styles.desktopRailColumn, desktopStickyRailStyle]}>
            <PlayerHand
              hand={hand}
              onPlayCard={onPlayCard}
              specialActions={specialActions}
              disabled={railDisabled}
              disabledReason={railDisabledReason}
              mode="sidebar"
              recommendedCardId={recommendedCardId}
              maxSidebarHeight={railMaxHeight - 12}
            />
          </View>
        )}
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

interface PendingConfirm {
  cardId: string;
  type: PlayType;
  label: string;
}

export default function GameScreen() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const isPhone = viewportWidth < 620;
  const isCompactDesktop = viewportWidth < 1280;
  const isDesktopRail = viewportWidth >= 1280;
  const isShortSurface = viewportHeight < 760;
  const railMaxHeight = Math.max(320, viewportHeight - 236);

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
  const [gameplayNotice, setGameplayNotice] = useState<string | null>(null);
  const [playToast, setPlayToast] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [fieldFocusMode, setFieldFocusMode] = useState(false);

  const gameplayNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGameplayErrorRef = useRef<string | null>(null);
  const lastPlayKeyRef = useRef<string | null>(null);

  const mySide = seat ?? (gameState?.myState.teamName === 'Away Team' ? 'away' : 'home');
  const possession = gameState?.field.possessionPlayerId === 'away' ? 'away' : 'home';
  const isGameOver = gameState?.phase === GamePhase.GAME_OVER;

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

  const displayedHand = useMemo(() => {
    if (!gameState) {
      return [];
    }
    if (gameState.phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
      return [];
    }
    return gameState.myState.hand;
  }, [gameState]);

  const recommendedCardId = useMemo(() => {
    if (!gameState || !isMyTurn || isGameOver || isRejoining) {
      return null;
    }

    const findSpecial = (type: PlayType) => {
      const action = gameState.myState.specialActions.find((item) => item.type === type && item.enabled);
      return action?.id ?? null;
    };

    if (gameState.phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
      if (gameState.conversion?.mandatoryTwoPoint) {
        return findSpecial('2PT');
      }
      return findSpecial('XP') ?? findSpecial('2PT');
    }

    if (gameState.phase === GamePhase.DEFENSE_SELECT || gameState.phase === GamePhase.CONVERSION_DEFENSE_SELECT) {
      return (
        displayedHand.find((card) => card.type === 'SP')?.id ??
        displayedHand.find((card) => card.type === 'SR')?.id ??
        displayedHand[0]?.id ??
        null
      );
    }

    if (gameState.phase === GamePhase.OFFENSE_SELECT) {
      const { down, toGo, ballOn } = gameState.field;

      if (down === 4) {
        if (ballOn >= 63 && toGo <= 7) {
          const fg = findSpecial('FG');
          if (fg) return fg;
        }

        if (toGo >= 6 || ballOn < 45) {
          const punt = findSpecial('PT');
          if (punt) return punt;
        }
      }

      if (toGo >= 15) {
        const hm = findSpecial('HM');
        if (hm) return hm;
      }

      if (toGo <= 2) {
        return (
          displayedHand.find((card) => card.type === 'SR')?.id ??
          displayedHand.find((card) => card.type === 'SP')?.id ??
          displayedHand[0]?.id ??
          null
        );
      }

      if (toGo >= 10) {
        return (
          displayedHand.find((card) => card.type === 'LP')?.id ??
          displayedHand.find((card) => card.type === 'LR')?.id ??
          displayedHand[0]?.id ??
          null
        );
      }
    }

    return displayedHand[0]?.id ?? null;
  }, [displayedHand, gameState, isGameOver, isMyTurn, isRejoining]);

  const specialActionItems = useMemo(() => {
    if (!gameState) {
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
        const label = SPECIAL_ACTION_LABELS[action.type] ?? action.type;
        const suffix = action.remaining === null ? '' : ` (${action.remaining})`;

        let status: SpecialActionItem['status'] = 'ready';
        let reasonText: string | undefined;
        if (isRejoining) {
          status = 'blocked';
          reasonText = 'Reconnecting';
        } else if (isGameOver) {
          status = 'blocked';
          reasonText = 'Game over';
        } else if (!isMyTurn) {
          status = 'blocked';
          reasonText = 'Wait your turn';
        } else if (!action.enabled) {
          status = 'locked';
          reasonText = formatActionReason(action.reason);
        }

        return {
          cardId: action.id,
          label: `${label}${suffix}`,
          enabled: status === 'ready',
          category: resolveActionCategory(action.type),
          status,
          reasonText,
          recommended: action.id === recommendedCardId,
        } as SpecialActionItem;
      });
  }, [gameState, isGameOver, isMyTurn, isRejoining, recommendedCardId]);

  const playTypeByCardId = useMemo(() => {
    const map = new Map<string, PlayType>();
    if (!gameState) return map;

    for (const card of gameState.myState.hand) {
      map.set(card.id, card.type);
    }
    for (const action of gameState.myState.specialActions) {
      map.set(action.id, action.type);
    }
    return map;
  }, [gameState]);

  const cardLabelById = useMemo(() => {
    const map = new Map<string, string>();
    if (!gameState) return map;

    for (const card of gameState.myState.hand) {
      map.set(card.id, card.name);
    }
    for (const action of gameState.myState.specialActions) {
      map.set(action.id, SPECIAL_ACTION_LABELS[action.type] ?? action.type);
    }
    return map;
  }, [gameState]);

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

  const confirmAndPlayCard = (cardId: string) => {
    const type = playTypeByCardId.get(cardId);
    if (type && HIGH_IMPACT_TYPES.has(type)) {
      setPendingConfirm({
        cardId,
        type,
        label: cardLabelById.get(cardId) ?? SPECIAL_ACTION_LABELS[type] ?? type,
      });
      return;
    }

    playCard(cardId);
  };

  const isInGame = !!gameState;
  const showJoinError = !!joinError && !isInGame;
  const winner = homeScore === awayScore ? 'DRAW' : homeScore > awayScore ? 'HOME' : 'AWAY';

  const railDisabled = !isMyTurn || isGameOver || isRejoining;
  const railDisabledReason = isRejoining
    ? 'reconnecting'
    : isGameOver
      ? 'game over'
      : !isMyTurn
        ? 'opponent turn'
        : undefined;

  useEffect(() => {
    if (!isInGame || !joinError) {
      return;
    }
    if (lastGameplayErrorRef.current === joinError) {
      return;
    }

    lastGameplayErrorRef.current = joinError;
    setGameplayNotice(joinError.replace(/_/g, ' '));

    if (gameplayNoticeTimerRef.current) {
      clearTimeout(gameplayNoticeTimerRef.current);
    }
    gameplayNoticeTimerRef.current = setTimeout(() => {
      setGameplayNotice(null);
    }, 2400);
  }, [isInGame, joinError]);

  useEffect(() => {
    if (!gameState?.lastPlay?.message) {
      return;
    }

    const key = `${gameState.lastPlay.message}|${gameState.field.quarter}|${gameState.field.clockSeconds}|${gameState.field.down}|${gameState.field.ballOn}`;
    if (lastPlayKeyRef.current === key) {
      return;
    }
    lastPlayKeyRef.current = key;

    const toast = buildToastMessage(gameState);
    if (!toast) {
      return;
    }

    setPlayToast(toast);
    if (playToastTimerRef.current) {
      clearTimeout(playToastTimerRef.current);
    }
    playToastTimerRef.current = setTimeout(() => {
      setPlayToast(null);
    }, 2600);
  }, [gameState]);

  useEffect(() => {
    if (!isInGame) {
      setPendingConfirm(null);
      setFieldFocusMode(false);
    }
  }, [isInGame]);

  useEffect(() => {
    if (!isDesktopRail && fieldFocusMode) {
      setFieldFocusMode(false);
    }
  }, [fieldFocusMode, isDesktopRail]);

  useEffect(() => {
    return () => {
      if (gameplayNoticeTimerRef.current) {
        clearTimeout(gameplayNoticeTimerRef.current);
      }
      if (playToastTimerRef.current) {
        clearTimeout(playToastTimerRef.current);
      }
    };
  }, []);

  const closeConfirm = () => setPendingConfirm(null);
  const commitConfirm = () => {
    if (!pendingConfirm) return;
    playCard(pendingConfirm.cardId);
    setPendingConfirm(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GameHud
        homeScore={homeScore}
        awayScore={awayScore}
        quarter={gameState?.field.quarter ?? 1}
        clockSeconds={gameState?.field.clockSeconds ?? 900}
        down={gameState?.field.down ?? 1}
        toGo={gameState?.field.toGo ?? 10}
        ballOn={gameState?.field.ballOn ?? 25}
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

      <View style={styles.centerRegion}>
        <ScrollView
          style={styles.playSurface}
          contentContainerStyle={[
            styles.playSurfaceContentWrap,
            isShortSurface && styles.playSurfaceContentWrapShort,
            gameState && !isDesktopRail && !fieldFocusMode
              ? (isPhone ? styles.playSurfaceBottomRailPhone : styles.playSurfaceBottomRail)
              : null,
          ]}
          showsVerticalScrollIndicator={!isPhone}
          keyboardShouldPersistTaps="handled">
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
                transientNotice={gameplayNotice}
                playToast={playToast}
                showDesktopRail={isDesktopRail && !fieldFocusMode}
                hand={displayedHand}
                specialActions={specialActionItems}
                onPlayCard={confirmAndPlayCard}
                railDisabled={railDisabled}
                railDisabledReason={railDisabledReason}
                recommendedCardId={recommendedCardId}
                fieldFocusMode={fieldFocusMode}
                onToggleFieldFocus={() => setFieldFocusMode((current) => !current)}
                railMaxHeight={railMaxHeight}
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
            {showJoinError && (
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
        </ScrollView>
      </View>

      {gameState && !isDesktopRail && !fieldFocusMode && (
        <PlayerHand
          hand={displayedHand}
          onPlayCard={confirmAndPlayCard}
          specialActions={specialActionItems}
          bottomInset={tabBarHeight}
          disabled={railDisabled}
          disabledReason={railDisabledReason}
          recommendedCardId={recommendedCardId}
        />
      )}

      {pendingConfirm && (
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Action</Text>
            <Text style={styles.confirmBody}>Use {pendingConfirm.label}? This can shift field position, time, or possession.</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.confirmCancel} onPress={closeConfirm}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmAccept} onPress={commitConfirm}>
                <Text style={styles.confirmAcceptText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    position: 'relative',
  },
  centerRegion: {
    flex: 1,
    width: '100%',
  },
  playSurfaceContentWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playSurfaceContentWrapShort: {
    paddingVertical: 8,
  },
  playSurfaceBottomRail: {
    paddingBottom: 124,
  },
  playSurfaceBottomRailPhone: {
    paddingBottom: 156,
  },
  surfaceContent: {
    width: '100%',
    maxWidth: 1320,
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
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: 12,
    paddingBottom: 8,
  },
  inGameShellCompact: {
    gap: 9,
  },
  inGameTopRow: {
    width: '100%',
    maxWidth: 1320,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inGameTopRowCompact: {
    flexWrap: 'wrap',
    rowGap: 6,
  },
  topRowLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  focusToggle: {
    backgroundColor: '#243447',
    borderColor: '#5f7898',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  focusToggleText: {
    color: '#dce9fb',
    fontSize: 11,
    fontWeight: '800',
  },
  roomBadge: {
    color: '#d3efd4',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    flexShrink: 1,
    textAlign: 'right',
  },
  transientNotice: {
    width: '100%',
    maxWidth: 1100,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b67a5a',
    backgroundColor: 'rgba(109, 45, 34, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transientNoticeText: {
    color: '#ffe1d2',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  playToast: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7d9ab8',
    backgroundColor: 'rgba(29, 46, 66, 0.93)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  playToastText: {
    color: '#d9ebff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  desktopArena: {
    width: '100%',
    maxWidth: 1320,
  },
  desktopArenaActive: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  desktopMainColumn: {
    width: '100%',
  },
  desktopMainColumnActive: {
    flex: 1,
    minWidth: 0,
  },
  desktopMainColumnFocused: {
    maxWidth: 1320,
  },
  desktopRailColumn: {
    width: '100%',
    minWidth: 300,
    maxWidth: 360,
    backgroundColor: '#171b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#324153',
    overflow: 'hidden',
  },
  fieldFrame: {
    width: '100%',
    maxWidth: '100%',
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
  fieldFrameFocus: {
    borderColor: 'rgba(149, 219, 164, 0.68)',
    borderWidth: 2,
  },
  playContextPanel: {
    width: '100%',
    maxWidth: '100%',
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
    width: '100%',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  bannerStackPhone: {
    marginTop: 8,
    marginBottom: 2,
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
  confirmBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1b2230',
    borderColor: '#4c5c73',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  confirmTitle: {
    color: '#f7fbff',
    fontSize: 20,
    fontWeight: '900',
  },
  confirmBody: {
    color: '#d6e2f0',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  confirmCancel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#68788f',
    backgroundColor: '#2a3344',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  confirmCancelText: {
    color: '#d5e0ef',
    fontWeight: '700',
    fontSize: 13,
  },
  confirmAccept: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d3aa3b',
    backgroundColor: '#f4c83b',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  confirmAcceptText: {
    color: '#291f00',
    fontWeight: '900',
    fontSize: 13,
  },
});
