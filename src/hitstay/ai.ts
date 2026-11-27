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

  const sum = getHandSum(ai.hand);
  const diffToLimit = state.targetLimit - sum;

  // 2. HIT / STAY phase
  if (state.phase === 'hit_stay') {
    if (state.deck.length === 0) {
      return performHitOrStay(state, 'stay');
    }
    // If already busted, small chance to bluff-hit, otherwise stay
    if (sum > state.targetLimit) {
      return performHitOrStay(state, Math.random() < 0.12 ? 'hit' : 'stay');
    }
    // Calculate bust probability from remaining deck
    const safeCards = state.deck.filter((c) => sum + c.value <= state.targetLimit).length;
    const safeProb = safeCards / state.deck.length;

    if (diffToLimit === 0) {
      // Exact hit! Only hit if -1 is abundant? No, stay!
      return performHitOrStay(state, 'stay');
    }
    if (safeProb >= 0.62 || (diffToLimit >= 3 && safeProb >= 0.45)) {
      return performHitOrStay(state, 'hit');
    }
    return performHitOrStay(state, 'stay');
  }

  // 3. Betting phases (bet1 / bet2)
  if (state.phase === 'bet1' || state.phase === 'bet2') {
    const toCall = Math.max(0, state.currentHighBet - ai.roundBet);
    const canRaise =
      state.currentHighBet < state.roundBetCap && ai.chips > toCall;

    // Busted in bet2 -> usually fold to a bet, occasionally bluff
    if (state.phase === 'bet2' && sum > state.targetLimit) {
      if (toCall === 0) return performBetAction(state, 'call');
      if (Math.random() < 0.15 && toCall <= 3) {
        return performBetAction(state, 'call');
      }
      return performBetAction(state, 'fold');
    }

    // Strong hand (0..1 away from targetLimit)
    if (diffToLimit >= 0 && diffToLimit <= 1) {
      if (canRaise && Math.random() < 0.65) {
        const amt = Math.min(3, state.roundBetCap - state.currentHighBet);
        return performBetAction(state, 'raise', Math.max(1, amt));
      }
      return performBetAction(state, 'call');
    }

    // Decent hand (2..3 away from targetLimit)
    if (diffToLimit >= 2 && diffToLimit <= 3) {
      if (toCall <= 4) {
        if (canRaise && state.phase === 'bet1' && Math.random() < 0.25) {
          return performBetAction(state, 'raise', 1);
        }
        return performBetAction(state, 'call');
      }
      return Math.random() < 0.5 ? performBetAction(state, 'call') : performBetAction(state, 'fold');
    }

    // Weak hand
    if (toCall === 0) return performBetAction(state, 'call');
    if (toCall <= 2) return performBetAction(state, 'call');
    return performBetAction(state, 'fold');
  }

  return state;
}
