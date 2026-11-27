import {
  CardValue,
  HitStayCard,
  HitStayDifficulty,
  HitStayMode,
  HitStayPlayer,
  HitStayState,
  SeatConfig,
} from './types';

export const DECK_COMPOSITION: { value: CardValue; count: number }[] = [
  { value: -1, count: 7 },
  { value: 1, count: 7 },
  { value: 2, count: 6 },
  { value: 3, count: 5 },
  { value: 4, count: 4 },
  { value: 5, count: 3 },
  { value: 6, count: 2 },
  { value: 7, count: 1 },
];

export const INITIAL_CHIPS = 40;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createShuffledDeck(): HitStayCard[] {
  const cards: HitStayCard[] = [];
  let seq = 0;
  for (const { value, count } of DECK_COMPOSITION) {
    for (let i = 0; i < count; i++) {
      cards.push({ id: `c_${value}_${seq++}`, value, faceUp: false });
    }
  }
  return shuffle(cards);
}

function addLog(
  state: HitStayState,
  text: string,
  player?: number
): HitStayState['logs'] {
  const nextId = (state.logs[0]?.id ?? 0) + 1;
  return [{ id: nextId, text, player }, ...state.logs].slice(0, 60);
}

export function getHandSum(hand: HitStayCard[]): number {
  return hand.reduce((acc, c) => acc + c.value, 0);
}

function findNextIndex(
  players: HitStayPlayer[],
  fromIdx: number,
  predicate: (p: HitStayPlayer) => boolean
): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (predicate(players[idx])) return idx;
  }
  return fromIdx;
}

function findFirstFromDealer(
  players: HitStayPlayer[],
  dealerIdx: number,
  predicate: (p: HitStayPlayer) => boolean
): number {
  const n = players.length;
  for (let step = 0; step < n; step++) {
    const idx = (dealerIdx + step) % n;
    if (predicate(players[idx])) return idx;
  }
  return dealerIdx;
}

export function createInitialHitStayState(options: {
  mode: HitStayMode;
  seats: SeatConfig[];
  difficulty?: HitStayDifficulty;
  showDeckCounter?: boolean;
}): HitStayState {
  const players: HitStayPlayer[] = options.seats.map((s, idx) => ({
    id: idx,
    name: s.name.trim() || (s.isAI ? `포커 봇 ${idx}` : `플레이어 ${idx + 1}`),
    isAI: s.isAI,
    chips: INITIAL_CHIPS,
    eliminated: false,
    hand: [],
    folded: false,
    stayed: false,
    hasRevealedInitial: false,
    hasActedInBet: false,
    roundBet: 0,
    revealedHandOnEnd: false,
  }));

  const randomDealer = Math.floor(Math.random() * players.length);
  const baseState: HitStayState = {
    phase: 'reveal_one',
    mode: options.mode,
    difficulty: options.difficulty ?? 'normal',
    roundNumber: 0,
    ante: 1,
    targetLimit: 8,
    dealerIndex: randomDealer,
    currentPlayer: randomDealer,
    pot: 0,
    currentHighBet: 0,
    roundBetCap: INITIAL_CHIPS,
    players,
    deck: createShuffledDeck(),
    discardPile: [],
    showDeckCounter: options.showDeckCounter ?? true,
    lastRoundSummary: null,
    lastWinners: [],
    winner: null,
    logs: [],
  };

  return startNextRound(baseState, true);
}

export function startNextRound(
  state: HitStayState,
  isFirstRound = false
): HitStayState {
  const activeIndices = state.players
    .map((p, i) => (!p.eliminated && p.chips > 0 ? i : -1))
    .filter((i) => i >= 0);

  if (activeIndices.length <= 1) {
    const winner = activeIndices[0] ?? null;
    return {
      ...state,
      phase: 'game_over',
      winner,
      logs: addLog(
        state,
        winner !== null
          ? `🏆 최종 우승: ${state.players[winner].name}!`
          : '게임 종료'
      ),
    };
  }

  // Move previous hands to discard pile
  let discardPile = [...state.discardPile];
  for (const p of state.players) {
    for (const c of p.hand) {
      discardPile.push({ ...c, faceUp: false });
    }
  }

  let deck = [...state.deck];
  let reshuffledNote = '';
  if (deck.length < activeIndices.length * 3) {
    deck = [...deck, ...shuffle(discardPile)];
    discardPile = [];
    reshuffledNote = ' (버린 카드 셔플 보충!)';
  }

  const roundNumber = state.roundNumber + 1;
  const ante = 1 + Math.floor((roundNumber - 1) / 10);
  const dealerIndex = isFirstRound
    ? state.dealerIndex
    : findNextIndex(state.players, state.dealerIndex, (p) => !p.eliminated && p.chips > 0);
  const targetLimit = 5 + Math.floor(Math.random() * 8); // 5..12

  let pot = 0;
  const players: HitStayPlayer[] = state.players.map((p) => {
    if (p.eliminated || p.chips <= 0) {
      return {
        ...p,
        eliminated: true,
        hand: [],
        folded: true,
        stayed: true,
        hasRevealedInitial: true,
        hasActedInBet: true,
        roundBet: 0,
        revealedHandOnEnd: false,
      };
    }
    const paidAnte = Math.min(p.chips, ante);
    pot += paidAnte;
    const dealt = deck.splice(0, 3).map((c) => ({ ...c, faceUp: false }));
    return {
      ...p,
      chips: p.chips - paidAnte,
      hand: dealt,
      folded: false,
      stayed: false,
      hasRevealedInitial: false,
      hasActedInBet: false,
      roundBet: 0,
      revealedHandOnEnd: false,
    };
  });

  // Round bet cap = minimum remaining chips among active players in this round
  const activeChips = players.filter((p) => !p.eliminated).map((p) => p.chips);
  const roundBetCap = Math.max(0, Math.min(...activeChips));

  const logs = addLog(
    state,
    `🎲 ${roundNumber}라운드 시작! 한계 숫자 [${targetLimit}] · 기본 베팅 ${ante}칩 · 선: ${players[dealerIndex].name}${reshuffledNote}`
  );

  return {
    ...state,
    phase: 'reveal_one',
    roundNumber,
    ante,
    targetLimit,
    dealerIndex,
    currentPlayer: dealerIndex,
    pot,
    currentHighBet: 0,
    roundBetCap,
    players,
    deck,
    discardPile,
    lastRoundSummary: null,
    lastWinners: [],
    logs,
  };
}

export function revealInitialCard(
  state: HitStayState,
  playerId: number,
  cardId: string
): HitStayState {
  if (state.phase !== 'reveal_one') return state;
  const player = state.players[playerId];
  if (!player || player.eliminated || player.hasRevealedInitial) return state;

  const hasCard = player.hand.some((c) => c.id === cardId);
  if (!hasCard) return state;

  const players = state.players.map((p, idx) =>
    idx === playerId
      ? {
          ...p,
          hasRevealedInitial: true,
          hand: p.hand.map((c) => (c.id === cardId ? { ...c, faceUp: true } : c)),
        }
      : p
  );

  const revealedCard = player.hand.find((c) => c.id === cardId)!;
  let logs = addLog(
    state,
    `${player.name}: 카드 [${revealedCard.value}] 공개`,
    playerId
  );

  const allRevealed = players.every((p) => p.eliminated || p.hasRevealedInitial);
  if (allRevealed) {
    const firstBetter = findFirstFromDealer(
      players,
      state.dealerIndex,
      (p) => !p.eliminated && !p.folded
    );
    logs = addLog(
      { ...state, logs },
      `1차 베팅 시작! (라운드 최대 베팅 상한: ${state.roundBetCap}칩)`
    );
    return {
      ...state,
      phase: 'bet1',
      players: players.map((p) => ({ ...p, hasActedInBet: false })),
      currentPlayer: firstBetter,
      logs,
    };
  }

  const nextReveal = findNextIndex(
    players,
    playerId,
    (p) => !p.eliminated && !p.hasRevealedInitial
  );

  return {
    ...state,
    players,
    currentPlayer: nextReveal,
    logs,
  };
}

export function performBetAction(
  state: HitStayState,
  action: 'call' | 'raise' | 'fold',
  raiseAmount = 1
): HitStayState {
  if (state.phase !== 'bet1' && state.phase !== 'bet2') return state;
  const pIdx = state.currentPlayer;
  const player = state.players[pIdx];
  if (!player || player.eliminated || player.folded) return state;

  // Dynamic cap: cannot exceed min(chips + roundBet) among active non-folded players
  const activeNonFolded = state.players.filter((p) => !p.eliminated && !p.folded);
  const dynamicCap = Math.min(
    state.roundBetCap,
    ...activeNonFolded.map((p) => p.chips + p.roundBet)
  );

  let players = state.players.map((p) => ({ ...p }));
  let pot = state.pot;
  let currentHighBet = state.currentHighBet;
  let logs = state.logs;

  if (action === 'fold') {
    players[pIdx].folded = true;
    players[pIdx].stayed = true;
    players[pIdx].hasActedInBet = true;
    logs = addLog(state, `${player.name}: 포기(Fold)`, pIdx);

    const remaining = players.filter((p) => !p.eliminated && !p.folded);
    if (remaining.length <= 1) {
      return resolveRound({ ...state, players, pot, currentHighBet, logs });
    }
  } else if (action === 'call') {
    const targetBet = Math.min(currentHighBet, dynamicCap);
    const toPay = Math.min(players[pIdx].chips, Math.max(0, targetBet - players[pIdx].roundBet));
    players[pIdx].chips -= toPay;
    players[pIdx].roundBet += toPay;
    players[pIdx].hasActedInBet = true;
    pot += toPay;
    logs = addLog(
      state,
      toPay === 0
        ? `${player.name}: 체크(Check)`
        : `${player.name}: 콜(Call, +${toPay}칩)`,
      pIdx
    );
  } else if (action === 'raise') {
    const desiredHigh = Math.min(dynamicCap, currentHighBet + Math.max(1, raiseAmount));
    const toPay = Math.min(players[pIdx].chips, Math.max(0, desiredHigh - players[pIdx].roundBet));
    players[pIdx].chips -= toPay;
    players[pIdx].roundBet += toPay;
    pot += toPay;

    if (players[pIdx].roundBet > currentHighBet) {
      currentHighBet = players[pIdx].roundBet;
      // Everyone else must act again
      players = players.map((p, idx) =>
        idx === pIdx ? { ...p, hasActedInBet: true } : { ...p, hasActedInBet: false }
      );
      logs = addLog(
        state,
        `${player.name}: 레이즈(Raise → 총 ${currentHighBet}칩)`,
        pIdx
      );
    } else {
      players[pIdx].hasActedInBet = true;
      logs = addLog(state, `${player.name}: 콜(Call, +${toPay}칩)`, pIdx);
    }
  }

  // Check if betting phase is complete
  const stillNeedsAct = players.some(
    (p) =>
      !p.eliminated &&
      !p.folded &&
      (!p.hasActedInBet || (p.roundBet < currentHighBet && p.chips > 0))
  );

  if (!stillNeedsAct) {
    if (state.phase === 'bet1') {
      const firstHitter = findFirstFromDealer(
        players,
        state.dealerIndex,
        (p) => !p.eliminated && !p.folded
      );
      logs = addLog(
        { ...state, logs },
        `🃏 HIT / STAY 페이즈 시작! (남은 덱: ${state.deck.length}장)`
      );
      return {
        ...state,
        phase: 'hit_stay',
        players,
        pot,
        currentHighBet,
        roundBetCap: dynamicCap,
        currentPlayer: firstHitter,
        logs,
      };
    } else {
      // End of bet2 -> Showdown!
      return resolveRound({
        ...state,
        players,
        pot,
        currentHighBet,
        roundBetCap: dynamicCap,
        logs,
      });
    }
  }

  const nextBetter = findNextIndex(
    players,
    pIdx,
    (p) =>
      !p.eliminated &&
      !p.folded &&
      (!p.hasActedInBet || (p.roundBet < currentHighBet && p.chips > 0))
  );

  return {
    ...state,
    players,
    pot,
    currentHighBet,
    roundBetCap: dynamicCap,
    currentPlayer: nextBetter,
    logs,
  };
}

export function performHitOrStay(
  state: HitStayState,
  choice: 'hit' | 'stay'
): HitStayState {
  if (state.phase !== 'hit_stay') return state;
  const pIdx = state.currentPlayer;
  const player = state.players[pIdx];
  if (!player || player.eliminated || player.folded || player.stayed) return state;

  const players = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
  const deck = [...state.deck];
  let logs = state.logs;

  if (choice === 'hit' && deck.length > 0) {
    const drawn = { ...deck.shift()!, faceUp: true };
    players[pIdx].hand.push(drawn);
    logs = addLog(
      state,
      `${player.name}: HIT! [${drawn.value}] 획득 (총 ${players[pIdx].hand.length}장)`,
      pIdx
    );
  } else {
    players[pIdx].stayed = true;
    logs = addLog(
      state,
      choice === 'hit'
        ? `${player.name}: 덱 소진으로 자동 STAY`
        : `${player.name}: STAY`,
      pIdx
    );
  }

  const deckEmpty = deck.length === 0;
  const anyStillHitting =
    !deckEmpty &&
    players.some((p) => !p.eliminated && !p.folded && !p.stayed);

  if (!anyStillHitting) {
    const firstBetter = findFirstFromDealer(
      players,
      state.dealerIndex,
      (p) => !p.eliminated && !p.folded
    );
    const activeNonFolded = players.filter((p) => !p.eliminated && !p.folded);
    const dynamicCap = Math.min(
      state.roundBetCap,
      ...activeNonFolded.map((p) => p.chips + p.roundBet)
    );
    logs = addLog(
      { ...state, logs },
      deckEmpty
        ? '덱이 모두 소진되어 2차 베팅으로 넘어갑니다!'
        : '모두 STAY 완료! 2차 베팅을 시작합니다.'
    );
    return {
      ...state,
      phase: 'bet2',
      players: players.map((p) => ({
        ...p,
        stayed: true,
        hasActedInBet: false,
      })),
      deck,
      roundBetCap: dynamicCap,
      currentPlayer: firstBetter,
      logs,
    };
  }

  const nextHitter = findNextIndex(
    players,
    pIdx,
    (p) => !p.eliminated && !p.folded && !p.stayed
  );

  return {
    ...state,
    players,
    deck,
    currentPlayer: nextHitter,
    logs,
  };
}

function resolveRound(state: HitStayState): HitStayState {
  const survivors = state.players.filter((p) => !p.eliminated && !p.folded);
  const players = state.players.map((p) => ({ ...p }));
  let winners: number[] = [];
  let summary = '';

  if (survivors.length === 1) {
    const sole = survivors[0];
    winners = [sole.id];
    players[sole.id].chips += state.pot;
    summary = `${sole.name} 단독 생존 승리! (+${state.pot}칩)`;
  } else {
    // Showdown: reveal all surviving players' hands
    for (const s of survivors) {
      players[s.id].revealedHandOnEnd = true;
      players[s.id].hand = players[s.id].hand.map((c) => ({ ...c, faceUp: true }));
    }

    const nonBusted = survivors.filter(
      (s) => getHandSum(s.hand) <= state.targetLimit
    );

    if (nonBusted.length === 0) {
      // Everyone busted -> split pot equally among survivors
      winners = survivors.map((s) => s.id);
      summary = `전원 버스트(한계 ${state.targetLimit} 초과)! 팟(${state.pot}칩) 균등 분배`;
    } else {
      // Best sum closest to targetLimit (i.e. highest sum <= targetLimit)
      const bestSum = Math.max(...nonBusted.map((s) => getHandSum(s.hand)));
      const sumTied = nonBusted.filter((s) => getHandSum(s.hand) === bestSum);
      // Tiebreaker 1: most cards
      const bestCount = Math.max(...sumTied.map((s) => s.hand.length));
      const finalWinners = sumTied.filter((s) => s.hand.length === bestCount);
      winners = finalWinners.map((s) => s.id);
      summary =
        winners.length === 1
          ? `쇼다운 승리: ${players[winners[0]].name} (합 ${bestSum}, ${bestCount}장) → +${state.pot}칩!`
          : `동점 무승부 (합 ${bestSum}, ${bestCount}장): ${winners
              .map((id) => players[id].name)
              .join(', ')} 팟 분배!`;
    }

    // Distribute pot; odd chip goes to tied winner closest clockwise to dealerIndex
    const share = Math.floor(state.pot / winners.length);
    let remainder = state.pot % winners.length;
    const orderedWinners = [...winners].sort((a, b) => {
      const da = (a - state.dealerIndex + players.length) % players.length;
      const db = (b - state.dealerIndex + players.length) % players.length;
      return da - db;
    });
    for (const wId of orderedWinners) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      players[wId].chips += share + extra;
    }
  }

  // Eliminate anyone with 0 chips
  for (const p of players) {
    if (!p.eliminated && p.chips <= 0) {
      p.eliminated = true;
    }
  }

  const remainingAlive = players.filter((p) => !p.eliminated);
  const logs = addLog(state, `🏁 ${summary}`);

  if (remainingAlive.length <= 1) {
    const finalWinner = remainingAlive[0]?.id ?? null;
    return {
      ...state,
      phase: 'game_over',
      players,
      pot: 0,
      lastRoundSummary: summary,
      lastWinners: winners,
      winner: finalWinner,
      logs: addLog(
        { ...state, logs },
        finalWinner !== null
          ? `🏆 최후의 생존자: ${players[finalWinner].name} 우승!`
          : '게임 종료'
      ),
    };
  }

  return {
    ...state,
    phase: 'round_end',
    players,
    pot: 0,
    lastRoundSummary: summary,
    lastWinners: winners,
    logs,
  };
}

export function toggleShowHandOnEnd(
  state: HitStayState,
  playerId: number
): HitStayState {
  if (state.phase !== 'round_end' && state.phase !== 'game_over') return state;
  const players = state.players.map((p, idx) =>
    idx === playerId
      ? {
          ...p,
          revealedHandOnEnd: !p.revealedHandOnEnd,
        }
      : p
  );
  return { ...state, players };
}
