import { describe, expect, it } from 'vitest';
import { CARDS } from '../cards';
import { getCardBuildCost } from '../cost';
import {
  buildCardFromPyramid,
  createInitialGameState,
  discardCardFromPyramid,
  pickWonder,
} from '../game';
import { isSlotPlayable } from '../pyramids';

describe('7 Wonders Duel Engine', () => {
  it('initializes with 20 Age I cards, 7 coins each, and 5 board progress tokens', () => {
    const state = createInitialGameState({ mode: 'ai' });
    expect(state.phase).toBe('wonder_draft');
    expect(state.pyramid).toHaveLength(20);
    expect(state.players[0].coins).toBe(7);
    expect(state.players[1].coins).toBe(7);
    expect(state.boardProgressTokens).toHaveLength(5);
    expect(state.discardedProgressTokens).toHaveLength(3);
  });

  it('completes 2-round snake wonder draft and enters playing phase', () => {
    let state = createInitialGameState({ mode: 'local' });
    // Round 1: P0 -> P1 -> P1 -> P0
    expect(state.currentPlayer).toBe(0);
    state = pickWonder(state, state.wonderDraft.pool[0]);
    expect(state.currentPlayer).toBe(1);
    state = pickWonder(state, state.wonderDraft.pool[0]);
    expect(state.currentPlayer).toBe(1);
    state = pickWonder(state, state.wonderDraft.pool[0]);
    expect(state.currentPlayer).toBe(0);
    state = pickWonder(state, state.wonderDraft.pool[0]);

    // Round 2: P1 -> P0 -> P0 -> P1
    expect(state.wonderDraft.round).toBe(2);
    expect(state.currentPlayer).toBe(1);
    state = pickWonder(state, state.wonderDraft.pool[0]);
    expect(state.currentPlayer).toBe(0);
    state = pickWonder(state, state.wonderDraft.pool[0]);
    expect(state.currentPlayer).toBe(0);
    state = pickWonder(state, state.wonderDraft.pool[0]);
    expect(state.currentPlayer).toBe(1);
    state = pickWonder(state, state.wonderDraft.pool[0]);

    expect(state.phase).toBe('playing');
    expect(state.players[0].wonders).toHaveLength(4);
    expect(state.players[1].wonders).toHaveLength(4);
    expect(state.currentPlayer).toBe(0);
  });

  it('only allows bottom row of Age I pyramid initially and reveals parent when unblocked', () => {
    let state = createInitialGameState({ mode: 'local' });
    for (let i = 0; i < 8; i++) {
      state = pickWonder(state, state.wonderDraft.pool[0]);
    }
    // Row 4 (indices 14..19) are playable; Row 3 (indices 9..13) are blocked & faceDown
    expect(isSlotPlayable(state.pyramid, 14)).toBe(true);
    expect(isSlotPlayable(state.pyramid, 15)).toBe(true);
    expect(isSlotPlayable(state.pyramid, 9)).toBe(false);
    expect(state.pyramid[9].faceUp).toBe(false);

    // Discard 14 and 15 -> slot 9 becomes unblocked & faceUp!
    state = discardCardFromPyramid(state, 14);
    state = discardCardFromPyramid(state, 15);
    expect(isSlotPlayable(state.pyramid, 9)).toBe(true);
    expect(state.pyramid[9].faceUp).toBe(true);
  });

  it('calculates chain free cost and trade cost accurately', () => {
    const state = createInitialGameState({ mode: 'local' });
    const p0 = { ...state.players[0], cards: ['a1_stable', 'a1_lumber_yard'] };
    const p1 = { ...state.players[1], cards: ['a1_quarry'] };

    // Horse Breeders chains from Stable (horseshoe) -> free!
    const horseCost = getCardBuildCost(p0, p1, CARDS.a2_horse_breeders);
    expect(horseCost.freeByChain).toBe(true);
    expect(horseCost.totalCoins).toBe(0);

    // Baths requires 1 stone; P1 produces 1 stone -> trade cost = 2 + 1 = 3
    const bathsCost = getCardBuildCost(p0, p1, CARDS.a1_baths);
    expect(bathsCost.freeByChain).toBe(false);
    expect(bathsCost.totalCoins).toBe(3);
  });

  it('triggers Military Supremacy when conflictPosition reaches 9', () => {
    let state = createInitialGameState({ mode: 'local' });
    for (let i = 0; i < 8; i++) {
      state = pickWonder(state, state.wonderDraft.pool[0]);
    }
    state = {
      ...state,
      conflictPosition: 7,
      pyramid: state.pyramid.map((s, idx) =>
        idx === 14 ? { ...s, cardId: 'a3_arsenal', faceUp: true } : s
      ),
      players: [
        { ...state.players[0], coins: 30, cards: ['a2_sawmill', 'a2_brickyard', 'a1_clay_pool'] },
        state.players[1],
      ],
    };
    state = buildCardFromPyramid(state, 14);
    expect(state.phase).toBe('game_over');
    expect(state.victoryType).toBe('military');
    expect(state.winner).toBe(0);
  });
});
