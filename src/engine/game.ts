import { CARDS, PROGRESS_TOKENS, WONDERS } from './cards';
import { getCardBuildCost, getWonderBuildCost } from './cost';
import { buildPyramid, isSlotPlayable, revealExposedSlots } from './pyramids';
import { calculateScore, getDistinctScienceCount, getScienceSymbolCounts } from './scoring';
import {
  AIDifficulty,
  CardDef,
  GameMode,
  GameState,
  PlayerState,
  WonderDef,
} from './types';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getAgeDeck(age: 1 | 2 | 3): string[] {
  if (age === 1) {
    const all = Object.values(CARDS)
      .filter((c) => c.age === 1)
      .map((c) => c.id);
    return shuffle(all).slice(0, 20);
  }
  if (age === 2) {
    const all = Object.values(CARDS)
      .filter((c) => c.age === 2)
      .map((c) => c.id);
    return shuffle(all).slice(0, 20);
  }
  const regular = shuffle(
    Object.values(CARDS)
      .filter((c) => c.age === 3 && c.color !== 'purple')
      .map((c) => c.id)
  ).slice(0, 17);
  const guilds = shuffle(
    Object.values(CARDS)
      .filter((c) => c.age === 3 && c.color === 'purple')
      .map((c) => c.id)
  ).slice(0, 3);
  return shuffle([...regular, ...guilds]);
}

function addLog(state: GameState, text: string, player?: 0 | 1): GameState['logs'] {
  const nextId = (state.logs[0]?.id ?? 0) + 1;
  return [{ id: nextId, text, player }, ...state.logs].slice(0, 60);
}

export function createInitialGameState(options: {
  mode: GameMode;
  aiDifficulty?: AIDifficulty;
  p0Name?: string;
  p1Name?: string;
  firstPlayer?: 0 | 1 | 'random';
}): GameState {
  const starter: 0 | 1 =
    options.firstPlayer === 'random'
      ? Math.random() < 0.5
        ? 0
        : 1
      : (options.firstPlayer ?? 0);
  const allProgress = shuffle(Object.keys(PROGRESS_TOKENS));
  const boardProgressTokens = allProgress.slice(0, 5);
  const discardedProgressTokens = allProgress.slice(5, 8);

  const allWonders = shuffle(Object.keys(WONDERS));
  const round1Pool = allWonders.slice(0, 4);

  const p0: PlayerState = {
    id: 0,
    name: options.p0Name ?? '플레이어 1',
    isAI: false,
    coins: 7,
    cards: [],
    wonders: [],
    progressTokens: [],
  };

  const p1: PlayerState = {
    id: 1,
    name:
      options.p1Name ??
      (options.mode === 'ai' ? '아테나 봇' : '플레이어 2'),
    isAI: options.mode === 'ai',
    coins: 7,
    cards: [],
    wonders: [],
    progressTokens: [],
  };

  return {
    phase: 'wonder_draft',
    mode: options.mode,
    aiDifficulty: options.aiDifficulty ?? 'normal',
    players: [p0, p1],
    currentPlayer: starter,
    age: 1,
    pyramid: buildPyramid(1, getAgeDeck(1)),
    discardPile: [],
    conflictPosition: 0,
    militaryTokensRemoved: {
      p0_3: false,
      p0_6: false,
      p1_3: false,
      p1_6: false,
    },
    boardProgressTokens,
    discardedProgressTokens,
    wonderDraft: {
      pool: round1Pool,
      step: 0,
      round: 1,
      firstPicker: starter,
    },
    totalWondersBuilt: 0,
    pendingPlayAgain: false,
    pendingDestroyColor: null,
    nextAgeStarterChooser: null,
    winner: null,
    victoryType: null,
    playerTimesSec: [0, 0],
    logs: [
      {
        id: 1,
        text: `게임 시작! (${starter === 0 ? p0.name : p1.name} 선공) 불가사의 드래프트를 진행하세요.`,
      },
    ],
    turnCount: 1,
  };
}

// Snake draft order within a 4-wonder pool: [first, second, second, first]
function getDraftPicker(first: 0 | 1, step: number): 0 | 1 {
  const second: 0 | 1 = first === 0 ? 1 : 0;
  return step === 0 || step === 3 ? first : second;
}

export function pickWonder(state: GameState, wonderId: string): GameState {
  if (state.phase !== 'wonder_draft') return state;
  if (!state.wonderDraft.pool.includes(wonderId)) return state;

  const pIdx = state.currentPlayer;
  const players: [PlayerState, PlayerState] = [
    { ...state.players[0], wonders: [...state.players[0].wonders] },
    { ...state.players[1], wonders: [...state.players[1].wonders] },
  ];
  players[pIdx].wonders.push({ wonderId, built: false });

  const remainingPool = state.wonderDraft.pool.filter((id) => id !== wonderId);
  const nextStep = state.wonderDraft.step + 1;
  const wonderName = WONDERS[wonderId]?.nameKo ?? wonderId;
  let logs = addLog(state, `${players[pIdx].name}이(가) [${wonderName}] 선택`, pIdx);

  if (nextStep < 4) {
    const nextPicker = getDraftPicker(state.wonderDraft.firstPicker, nextStep);
    return {
      ...state,
      players,
      currentPlayer: nextPicker,
      wonderDraft: {
        ...state.wonderDraft,
        pool: remainingPool,
        step: nextStep,
      },
      logs,
    };
  }

  // Round 1 finished -> start Round 2
  if (state.wonderDraft.round === 1) {
    const taken = new Set([
      ...players[0].wonders.map((w) => w.wonderId),
      ...players[1].wonders.map((w) => w.wonderId),
      ...remainingPool,
    ]);
    // Actually we should pick 4 fresh wonders that were not in round 1
    const round2Pool = shuffle(
      Object.keys(WONDERS).filter((id) => !taken.has(id))
    ).slice(0, 4);

    // Note: in step 3 only 1 wonder remains, which the last picker automatically gets?
    // Wait: in 7 Wonders Duel, 4 wonders are shown, P1 picks 1, P2 picks 2, P1 gets the remaining 1.
    // Our step 0..3 lets P1 click the last one or we could auto-assign, clicking is explicit & clear!
    const round2First: 0 | 1 = state.wonderDraft.firstPicker === 0 ? 1 : 0;
    return {
      ...state,
      players,
      currentPlayer: round2First,
      wonderDraft: {
        pool: round2Pool,
        step: 0,
        round: 2,
        firstPicker: round2First,
      },
      logs,
    };
  }

  // Both rounds complete -> start Age I with Round 1's firstPicker
  const age1Starter: 0 | 1 = state.wonderDraft.firstPicker === 0 ? 1 : 0;
  logs = addLog(
    { ...state, logs },
    `불가사의 선택 완료! ${players[age1Starter].name} 선공으로 제1시대를 시작합니다.`
  );
  return {
    ...state,
    phase: 'playing',
    players,
    currentPlayer: age1Starter,
    wonderDraft: {
      ...state.wonderDraft,
      pool: [],
      step: 4,
    },
    logs,
  };
}

function applyMilitaryShields(
  state: GameState,
  playerIndex: 0 | 1,
  shields: number
): GameState {
  if (shields <= 0) return state;
  const dir = playerIndex === 0 ? 1 : -1;
  const newPos = Math.max(-9, Math.min(9, state.conflictPosition + dir * shields));
  const players: [PlayerState, PlayerState] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  const tokens = { ...state.militaryTokensRemoved };
  let logs = state.logs;

  // Check military coin penalties
  if (newPos >= 3 && !tokens.p1_3) {
    tokens.p1_3 = true;
    const lost = Math.min(players[1].coins, 2);
    players[1].coins -= lost;
    logs = addLog({ ...state, logs }, `${players[1].name} 군사 페널티로 코인 ${lost} 상실`);
  }
  if (newPos >= 6 && !tokens.p1_6) {
    tokens.p1_6 = true;
    const lost = Math.min(players[1].coins, 5);
    players[1].coins -= lost;
    logs = addLog({ ...state, logs }, `${players[1].name} 군사 페널티로 코인 ${lost} 상실`);
  }
  if (newPos <= -3 && !tokens.p0_3) {
    tokens.p0_3 = true;
    const lost = Math.min(players[0].coins, 2);
    players[0].coins -= lost;
    logs = addLog({ ...state, logs }, `${players[0].name} 군사 페널티로 코인 ${lost} 상실`);
  }
  if (newPos <= -6 && !tokens.p0_6) {
    tokens.p0_6 = true;
    const lost = Math.min(players[0].coins, 5);
    players[0].coins -= lost;
    logs = addLog({ ...state, logs }, `${players[0].name} 군사 페널티로 코인 ${lost} 상실`);
  }

  // Instant Military Supremacy
  if (newPos >= 9 || newPos <= -9) {
    const winner: 0 | 1 = newPos >= 9 ? 0 : 1;
    logs = addLog(
      { ...state, logs },
      `⚔️ ${players[winner].name} 군사적 패권 달성! 즉시 승리!`,
      winner
    );
    return {
      ...state,
      players,
      conflictPosition: newPos,
      militaryTokensRemoved: tokens,
      phase: 'game_over',
      winner,
      victoryType: 'military',
      logs,
    };
  }

  return {
    ...state,
    players,
    conflictPosition: newPos,
    militaryTokensRemoved: tokens,
    logs,
  };
}

function applyCardEffects(
  state: GameState,
  playerIndex: 0 | 1,
  card: CardDef,
  freeByChain: boolean
): { nextState: GameState; triggeredProgress: boolean } {
  const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
  const players: [PlayerState, PlayerState] = [
    { ...state.players[0], cards: [...state.players[0].cards] },
    { ...state.players[1], cards: [...state.players[1].cards] },
  ];
  const player = players[playerIndex];
  const opponent = players[oppIndex];

  // Add card
  player.cards.push(card.id);

  // Urbanism chain bonus
  if (freeByChain && player.progressTokens.includes('pt_urbanism')) {
    player.coins += 4;
  }

  // Instant coins
  if (card.coins) {
    player.coins += card.coins;
  }

  // Coins per card (Yellow Age 3 / Guilds)
  if (card.coinsPerCard) {
    const { target, colors, amount, includeWonders } = card.coinsPerCard;
    if (target === 'self') {
      if (includeWonders) {
        const builtCount = player.wonders.filter((w) => w.built).length;
        player.coins += builtCount * amount;
      } else {
        const count = player.cards.filter((id) =>
          colors.includes(CARDS[id]?.color)
        ).length;
        player.coins += count * amount;
      }
    } else {
      const pCount = player.cards.filter((id) =>
        colors.includes(CARDS[id]?.color)
      ).length;
      const oCount = opponent.cards.filter((id) =>
        colors.includes(CARDS[id]?.color)
      ).length;
      player.coins += Math.max(pCount, oCount) * amount;
    }
  }

  let nextState: GameState = { ...state, players };

  // Military shields
  if (card.color === 'red') {
    const extra = player.progressTokens.includes('pt_strategy') ? 1 : 0;
    const totalShields = (card.shields ?? 0) + extra;
    nextState = applyMilitaryShields(nextState, playerIndex, totalShields);
    if (nextState.phase === 'game_over') {
      return { nextState, triggeredProgress: false };
    }
  }

  // Science check
  let triggeredProgress = false;
  if (card.science) {
    const distinct = getDistinctScienceCount(nextState.players[playerIndex]);
    if (distinct >= 6) {
      const logs = addLog(
        nextState,
        `🔬 ${nextState.players[playerIndex].name} 과학적 패권 달성! 즉시 승리!`,
        playerIndex
      );
      return {
        nextState: {
          ...nextState,
          phase: 'game_over',
          winner: playerIndex,
          victoryType: 'scientific',
          logs,
        },
        triggeredProgress: false,
      };
    }

    const counts = getScienceSymbolCounts(nextState.players[playerIndex]);
    if (counts[card.science] === 2 && nextState.boardProgressTokens.length > 0) {
      triggeredProgress = true;
    }
  }

  return { nextState, triggeredProgress };
}

function resolveEndOfTurn(state: GameState, lastPlayer: 0 | 1): GameState {
  if (state.phase === 'game_over') return state;

  // Check if any pending interactive phase is active
  if (
    state.phase === 'choose_progress' ||
    state.phase === 'destroy_card' ||
    state.phase === 'build_discard' ||
    state.phase === 'choose_discarded_progress'
  ) {
    return state;
  }

  // Check if pyramid is empty -> End of Age / End of Game
  const anyCardLeft = state.pyramid.some((s) => s.cardId !== null);
  if (!anyCardLeft) {
    if (state.age < 3) {
      const nextAge = (state.age + 1) as 2 | 3;
      const nextPyramid = buildPyramid(nextAge, getAgeDeck(nextAge));
      // Player with weaker military chooses who starts next Age
      let chooser: 0 | 1 = lastPlayer;
      if (state.conflictPosition > 0) chooser = 1;
      else if (state.conflictPosition < 0) chooser = 0;

      const logs = addLog(
        state,
        `제${state.age}시대 종료! ${state.players[chooser].name}이(가) 제${nextAge}시대 선공을 선택합니다.`
      );
      return {
        ...state,
        age: nextAge,
        pyramid: nextPyramid,
        phase: 'choose_age_starter',
        currentPlayer: chooser,
        nextAgeStarterChooser: chooser,
        pendingPlayAgain: false,
        logs,
      };
    } else {
      // End of Age 3 -> Civilian Victory!
      const s0 = calculateScore(state, 0);
      const s1 = calculateScore(state, 1);
      let winner: 0 | 1 | null = null;
      if (s0.total > s1.total) winner = 0;
      else if (s1.total > s0.total) winner = 1;
      else if (s0.blue > s1.blue) winner = 0;
      else if (s1.blue > s0.blue) winner = 1;
      else if (state.playerTimesSec[0] < state.playerTimesSec[1]) winner = 0;
      else if (state.playerTimesSec[1] < state.playerTimesSec[0]) winner = 1;

      const tieNote =
        s0.total === s1.total && winner !== null
          ? s0.blue !== s1.blue
            ? ' [파랑 승점 판정]'
            : ' [누적 시간 판정]'
          : '';
      const winMsg =
        winner !== null
          ? `🏛️ 제3시대 종료! ${state.players[winner].name} 시민 승리 (${s0.total} vs ${s1.total})${tieNote}`
          : `🏛️ 제3시대 종료! 무승부 (${s0.total} vs ${s1.total})`;
      const logs = addLog(state, winMsg, winner ?? undefined);

      return {
        ...state,
        phase: 'game_over',
        winner,
        victoryType: 'civilian',
        pendingPlayAgain: false,
        logs,
      };
    }
  }

  if (state.pendingPlayAgain) {
    const logs = addLog(
      state,
      `⚡ ${state.players[lastPlayer].name} 추가 턴 진행!`,
      lastPlayer
    );
    return {
      ...state,
      phase: 'playing',
      currentPlayer: lastPlayer,
      pendingPlayAgain: false,
      turnCount: state.turnCount + 1,
      logs,
    };
  }

  const nextPlayer: 0 | 1 = lastPlayer === 0 ? 1 : 0;
  return {
    ...state,
    phase: 'playing',
    currentPlayer: nextPlayer,
    turnCount: state.turnCount + 1,
  };
}

export function buildCardFromPyramid(state: GameState, slotIndex: number): GameState {
  if (state.phase !== 'playing') return state;
  if (!isSlotPlayable(state.pyramid, slotIndex)) return state;

  const slot = state.pyramid[slotIndex];
  const card = slot.cardId ? CARDS[slot.cardId] : null;
  if (!card) return state;

  const pIdx = state.currentPlayer;
  const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
  const player = state.players[pIdx];
  const opponent = state.players[oppIdx];

  const cost = getCardBuildCost(player, opponent, card);
  if (!cost.canAfford) return state;

  const players: [PlayerState, PlayerState] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  players[pIdx].coins -= cost.totalCoins;
  // Economy progress token: trade coins go to opponent
  if (cost.tradeCoins > 0 && opponent.progressTokens.includes('pt_economy')) {
    players[oppIdx].coins += cost.tradeCoins;
  }

  const nextPyramid = revealExposedSlots(
    state.pyramid.map((s, i) => (i === slotIndex ? { ...s, cardId: null } : s))
  );

  const costDesc = cost.freeByChain
    ? '연쇄 무료'
    : cost.totalCoins > 0
      ? `${cost.totalCoins} 코인`
      : '무료';
  const logs = addLog(
    state,
    `${player.name} [${card.nameKo}] 건설 (${costDesc})`,
    pIdx
  );

  const { nextState, triggeredProgress } = applyCardEffects(
    { ...state, players, pyramid: nextPyramid, logs },
    pIdx,
    card,
    cost.freeByChain
  );

  if (nextState.phase === 'game_over') return nextState;

  if (triggeredProgress) {
    return {
      ...nextState,
      phase: 'choose_progress',
      currentPlayer: pIdx,
    };
  }

  return resolveEndOfTurn(nextState, pIdx);
}

export function discardCardFromPyramid(state: GameState, slotIndex: number): GameState {
  if (state.phase !== 'playing') return state;
  if (!isSlotPlayable(state.pyramid, slotIndex)) return state;

  const slot = state.pyramid[slotIndex];
  const card = slot.cardId ? CARDS[slot.cardId] : null;
  if (!card) return state;

  const pIdx = state.currentPlayer;
  const yellowCount = state.players[pIdx].cards.filter(
    (id) => CARDS[id]?.color === 'yellow'
  ).length;
  const gain = 2 + yellowCount;

  const players: [PlayerState, PlayerState] = [
    { ...state.players[0] },
    { ...state.players[1] },
  ];
  players[pIdx].coins += gain;

  const nextPyramid = revealExposedSlots(
    state.pyramid.map((s, i) => (i === slotIndex ? { ...s, cardId: null } : s))
  );
  const discardPile = [...state.discardPile, card.id];
  const logs = addLog(
    state,
    `${players[pIdx].name} [${card.nameKo}] 버리고 +${gain} 코인`,
    pIdx
  );

  return resolveEndOfTurn(
    { ...state, players, pyramid: nextPyramid, discardPile, logs },
    pIdx
  );
}

export function buildWonderFromPyramid(
  state: GameState,
  slotIndex: number,
  wonderId: string
): GameState {
  if (state.phase !== 'playing') return state;
  if (state.totalWondersBuilt >= 7) return state;
  if (!isSlotPlayable(state.pyramid, slotIndex)) return state;

  const slot = state.pyramid[slotIndex];
  const card = slot.cardId ? CARDS[slot.cardId] : null;
  if (!card) return state;

  const pIdx = state.currentPlayer;
  const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
  const player = state.players[pIdx];
  const opponent = state.players[oppIdx];

  const wonderSlotIdx = player.wonders.findIndex(
    (w) => w.wonderId === wonderId && !w.built
  );
  if (wonderSlotIdx === -1) return state;

  const wonder: WonderDef | undefined = WONDERS[wonderId];
  if (!wonder) return state;

  const cost = getWonderBuildCost(player, opponent, wonder);
  if (!cost.canAfford) return state;

  const players: [PlayerState, PlayerState] = [
    { ...state.players[0], wonders: state.players[0].wonders.map((w) => ({ ...w })) },
    { ...state.players[1], wonders: state.players[1].wonders.map((w) => ({ ...w })) },
  ];
  players[pIdx].coins -= cost.totalCoins;
  if (cost.tradeCoins > 0 && opponent.progressTokens.includes('pt_economy')) {
    players[oppIdx].coins += cost.tradeCoins;
  }
  players[pIdx].wonders[wonderSlotIdx].built = true;
  players[pIdx].wonders[wonderSlotIdx].ageBuilt = state.age;

  if (wonder.coins) players[pIdx].coins += wonder.coins;
  if (wonder.opponentLoseCoins) {
    players[oppIdx].coins = Math.max(0, players[oppIdx].coins - wonder.opponentLoseCoins);
  }

  const nextPyramid = revealExposedSlots(
    state.pyramid.map((s, i) => (i === slotIndex ? { ...s, cardId: null } : s))
  );

  let logs = addLog(
    state,
    `🏛️ ${player.name} 불가사의 [${wonder.nameKo}] 건설!`,
    pIdx
  );

  let nextState: GameState = {
    ...state,
    players,
    pyramid: nextPyramid,
    totalWondersBuilt: state.totalWondersBuilt + 1,
    pendingPlayAgain: Boolean(
      wonder.playAgain || player.progressTokens.includes('pt_theology')
    ),
    logs,
  };

  if (wonder.shields) {
    nextState = applyMilitaryShields(nextState, pIdx, wonder.shields);
    if (nextState.phase === 'game_over') return nextState;
  }

  // Interactive Wonder effects
  if (wonder.destroyOpponentCard) {
    const color = wonder.destroyOpponentCard;
    const hasTarget = nextState.players[oppIdx].cards.some(
      (id) => CARDS[id]?.color === color
    );
    if (hasTarget) {
      return {
        ...nextState,
        phase: 'destroy_card',
        pendingDestroyColor: color,
        currentPlayer: pIdx,
      };
    }
  }

  if (wonder.buildFromDiscard && nextState.discardPile.length > 0) {
    return {
      ...nextState,
      phase: 'build_discard',
      currentPlayer: pIdx,
    };
  }

  if (wonder.drawDiscardedProgress && nextState.discardedProgressTokens.length > 0) {
    return {
      ...nextState,
      phase: 'choose_discarded_progress',
      currentPlayer: pIdx,
    };
  }

  return resolveEndOfTurn(nextState, pIdx);
}

function applyProgressToken(
  state: GameState,
  playerIndex: 0 | 1,
  tokenId: string
): GameState {
  const players: [PlayerState, PlayerState] = [
    { ...state.players[0], progressTokens: [...state.players[0].progressTokens] },
    { ...state.players[1], progressTokens: [...state.players[1].progressTokens] },
  ];
  players[playerIndex].progressTokens.push(tokenId);

  if (tokenId === 'pt_agriculture' || tokenId === 'pt_urbanism') {
    players[playerIndex].coins += 6;
  }

  const tokenName = PROGRESS_TOKENS[tokenId]?.nameKo ?? tokenId;
  const logs = addLog(
    state,
    `📜 ${players[playerIndex].name} 진보 토큰 [${tokenName}] 획득!`,
    playerIndex
  );

  let nextState: GameState = { ...state, players, logs };

  // Law token grants a 7th science symbol -> check Scientific Supremacy!
  if (tokenId === 'pt_law' && getDistinctScienceCount(players[playerIndex]) >= 6) {
    const winLogs = addLog(
      nextState,
      `🔬 ${players[playerIndex].name} 과학적 패권 달성! 즉시 승리!`,
      playerIndex
    );
    return {
      ...nextState,
      phase: 'game_over',
      winner: playerIndex,
      victoryType: 'scientific',
      logs: winLogs,
    };
  }

  return nextState;
}

export function chooseProgressToken(state: GameState, tokenId: string): GameState {
  if (state.phase !== 'choose_progress') return state;
  if (!state.boardProgressTokens.includes(tokenId)) return state;

  const pIdx = state.currentPlayer;
  const boardProgressTokens = state.boardProgressTokens.filter((id) => id !== tokenId);
  const nextState = applyProgressToken(
    { ...state, boardProgressTokens },
    pIdx,
    tokenId
  );

  if (nextState.phase === 'game_over') return nextState;
  return resolveEndOfTurn({ ...nextState, phase: 'playing' }, pIdx);
}

export function chooseDiscardedProgressToken(state: GameState, tokenId: string): GameState {
  if (state.phase !== 'choose_discarded_progress') return state;
  if (!state.discardedProgressTokens.includes(tokenId)) return state;

  const pIdx = state.currentPlayer;
  const discardedProgressTokens = state.discardedProgressTokens.filter(
    (id) => id !== tokenId
  );
  const nextState = applyProgressToken(
    { ...state, discardedProgressTokens },
    pIdx,
    tokenId
  );

  if (nextState.phase === 'game_over') return nextState;
  return resolveEndOfTurn({ ...nextState, phase: 'playing' }, pIdx);
}

export function destroyOpponentCard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'destroy_card' || !state.pendingDestroyColor) return state;
  const pIdx = state.currentPlayer;
  const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;

  const targetIdx = state.players[oppIdx].cards.indexOf(cardId);
  if (targetIdx === -1) return state;
  if (CARDS[cardId]?.color !== state.pendingDestroyColor) return state;

  const players: [PlayerState, PlayerState] = [
    { ...state.players[0], cards: [...state.players[0].cards] },
    { ...state.players[1], cards: [...state.players[1].cards] },
  ];
  players[oppIdx].cards.splice(targetIdx, 1);

  const discardPile = [...state.discardPile, cardId];
  const logs = addLog(
    state,
    `💥 ${players[pIdx].name}이(가) 상대의 [${CARDS[cardId]?.nameKo}] 파괴!`,
    pIdx
  );

  return resolveEndOfTurn(
    {
      ...state,
      players,
      discardPile,
      pendingDestroyColor: null,
      phase: 'playing',
      logs,
    },
    pIdx
  );
}

export function buildCardFromDiscard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'build_discard') return state;
  const idx = state.discardPile.indexOf(cardId);
  if (idx === -1) return state;

  const card = CARDS[cardId];
  if (!card) return state;

  const pIdx = state.currentPlayer;
  const discardPile = [...state.discardPile];
  discardPile.splice(idx, 1);

  const logs = addLog(
    state,
    `🏺 ${state.players[pIdx].name} 버려진 카드에서 [${card.nameKo}] 무료 건설!`,
    pIdx
  );

  const { nextState, triggeredProgress } = applyCardEffects(
    { ...state, discardPile, logs },
    pIdx,
    card,
    false
  );

  if (nextState.phase === 'game_over') return nextState;

  if (triggeredProgress) {
    return {
      ...nextState,
      phase: 'choose_progress',
      currentPlayer: pIdx,
    };
  }

  return resolveEndOfTurn({ ...nextState, phase: 'playing' }, pIdx);
}

export function chooseAgeStarter(state: GameState, starter: 0 | 1): GameState {
  if (state.phase !== 'choose_age_starter') return state;
  const logs = addLog(
    state,
    `제${state.age}시대 시작! 선공: ${state.players[starter].name}`
  );
  return {
    ...state,
    phase: 'playing',
    currentPlayer: starter,
    nextAgeStarterChooser: null,
    turnCount: state.turnCount + 1,
    logs,
  };
}
