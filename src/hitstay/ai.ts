import {
  getHandSum,
  performBetAction,
  performHitOrStay,
  revealInitialCard,
} from './engine';
import { HitStayState } from './types';

export function performHitStayAITurn(state: HitStayState): HitStayState {
  if (state.phase === 'round_end' || state.phase === 'game_over') return state;
  const pIdx = state.currentPlayer;
  const ai = state.players[pIdx];
  if (!ai || !ai.isAI || ai.eliminated) return state;

  // 1. Reveal 1 of 3 initial cards (prefer revealing a middle-value card to hide extremes)
  if (state.phase === 'reveal_one') {
    const sorted = [...ai.hand].sort((a, b) => a.value - b.value);
    const pick = sorted[1] ?? sorted[0];
    return revealInitialCard(state, pIdx, pick.id);
  }

  const diff = state.difficulty ?? 'normal';
  const sum = getHandSum(ai.hand);
  const diffToLimit = state.targetLimit - sum;

  // 2. HIT / STAY phase
  if (state.phase === 'hit_stay') {
    if (state.deck.length === 0) {
      return performHitOrStay(state, 'stay');
    }
    if (sum > state.targetLimit) {
      // Hard AI occasionally uses -1 recovery if remaining deck has high -1 ratio and sum == targetLimit + 1
      const negRatio =
        state.deck.filter((c) => c.value === -1).length / state.deck.length;
      if (diff === 'hard' && sum === state.targetLimit + 1 && negRatio >= 0.25) {
        return performHitOrStay(state, 'hit');
      }
      const bluffChance = diff === 'hard' ? 0.18 : diff === 'normal' ? 0.1 : 0.22;
      return performHitOrStay(state, Math.random() < bluffChance ? 'hit' : 'stay');
    }

    const safeCards = state.deck.filter((c) => sum + c.value <= state.targetLimit).length;
    const safeProb = safeCards / state.deck.length;

    if (diffToLimit === 0) {
      return performHitOrStay(state, 'stay');
    }
    if (diff === 'easy') {
      // Easy bot hits recklessly or stays early randomly
      return performHitOrStay(state, diffToLimit >= 2 && Math.random() < 0.65 ? 'hit' : 'stay');
    }
    const threshold = diff === 'hard' ? 0.56 : 0.62;
    if (safeProb >= threshold || (diffToLimit >= 3 && safeProb >= 0.42)) {
      return performHitOrStay(state, 'hit');
    }
    return performHitOrStay(state, 'stay');
  }

  // 3. Betting phases (bet1 / bet2)
  if (state.phase === 'bet1' || state.phase === 'bet2') {
    const toCall = Math.max(0, state.currentHighBet - ai.roundBet);
    const canRaise =
      state.currentHighBet < state.roundBetCap && ai.chips > toCall;

    if (state.phase === 'bet2' && sum > state.targetLimit) {
      if (toCall === 0) {
        // Hard AI may fire a small bluff bet when checked to
        if (diff === 'hard' && canRaise && Math.random() < 0.22) {
          return performBetAction(state, 'raise', 2);
        }
        return performBetAction(state, 'call');
      }
      const heroCall = diff === 'easy' ? 0.35 : diff === 'normal' ? 0.12 : 0.05;
      if (Math.random() < heroCall && toCall <= 4) {
        return performBetAction(state, 'call');
      }
      return performBetAction(state, 'fold');
    }

    if (diffToLimit >= 0 && diffToLimit <= 1) {
      const raiseProb = diff === 'hard' ? 0.8 : diff === 'normal' ? 0.6 : 0.35;
      if (canRaise && Math.random() < raiseProb) {
        const amt = Math.min(diff === 'hard' ? 4 : 2, state.roundBetCap - state.currentHighBet);
        return performBetAction(state, 'raise', Math.max(1, amt));
      }
      return performBetAction(state, 'call');
    }

    if (diffToLimit >= 2 && diffToLimit <= 3) {
      if (toCall <= (diff === 'hard' ? 5 : 4)) {
        if (canRaise && state.phase === 'bet1' && Math.random() < 0.25) {
          return performBetAction(state, 'raise', 1);
        }
        return performBetAction(state, 'call');
      }
      return Math.random() < 0.5 ? performBetAction(state, 'call') : performBetAction(state, 'fold');
    }

    if (toCall === 0) return performBetAction(state, 'call');
    if (toCall <= (diff === 'easy' ? 3 : 2)) return performBetAction(state, 'call');
    return performBetAction(state, 'fold');
  }

  return state;
}
