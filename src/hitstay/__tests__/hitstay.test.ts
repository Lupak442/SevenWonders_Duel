import { describe, expect, it } from 'vitest';
import {
  createInitialHitStayState,
  createShuffledDeck,
  performBetAction,
  performHitOrStay,
  revealInitialCard,
} from '../engine';

describe('Hit & Stay Engine', () => {
  it('builds exact 35-card deck (-1x7, 1x7, 2x6, 3x5, 4x4, 5x3, 6x2, 7x1)', () => {
    const deck = createShuffledDeck();
    expect(deck).toHaveLength(35);
    expect(deck.filter((c) => c.value === -1)).toHaveLength(7);
    expect(deck.filter((c) => c.value === 1)).toHaveLength(7);
    expect(deck.filter((c) => c.value === 7)).toHaveLength(1);
  });

  it('starts with 40 chips each, pays 1 ante, deals 3 cards each, and rolls 5..12 target', () => {
    const s = createInitialHitStayState({
      mode: 'local',
      seats: [
        { name: 'P1', isAI: false },
        { name: 'P2', isAI: false },
        { name: 'Bot1', isAI: true },
      ],
    });
    expect(s.phase).toBe('reveal_one');
    expect(s.pot).toBe(3);
    expect(s.players[0].chips).toBe(39);
    expect(s.players[0].hand).toHaveLength(3);
    expect(s.deck).toHaveLength(35 - 9);
    expect(s.targetLimit).toBeGreaterThanOrEqual(5);
    expect(s.targetLimit).toBeLessThanOrEqual(12);
  });

  it('progresses reveal_one -> bet1 -> hit_stay -> bet2 -> round_end cleanly', () => {
    let s = createInitialHitStayState({
      mode: 'local',
      seats: [
        { name: 'P1', isAI: false },
        { name: 'P2', isAI: false },
      ],
    });
    // Both reveal 1 card
    s = revealInitialCard(s, s.currentPlayer, s.players[s.currentPlayer].hand[0].id);
    s = revealInitialCard(s, s.currentPlayer, s.players[s.currentPlayer].hand[0].id);
    expect(s.phase).toBe('bet1');

    // Both check
    s = performBetAction(s, 'call');
    s = performBetAction(s, 'call');
    expect(s.phase).toBe('hit_stay');

    // Both stay
    s = performHitOrStay(s, 'stay');
    s = performHitOrStay(s, 'stay');
    expect(s.phase).toBe('bet2');

    // Both check -> showdown
    s = performBetAction(s, 'call');
    s = performBetAction(s, 'call');
    expect(['round_end', 'game_over']).toContain(s.phase);
    expect(s.lastWinners.length).toBeGreaterThanOrEqual(1);
  });
});
