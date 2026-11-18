import { CARDS, WONDERS } from './cards';
import { getCardBuildCost, getWonderBuildCost } from './cost';
import {
  buildCardFromDiscard,
  buildCardFromPyramid,
  buildWonderFromPyramid,
  chooseAgeStarter,
  chooseDiscardedProgressToken,
  chooseProgressToken,
  destroyOpponentCard,
  discardCardFromPyramid,
  pickWonder,
} from './game';
import { isSlotPlayable } from './pyramids';
import { getDistinctScienceCount, getScienceSymbolCounts } from './scoring';
import { AIDifficulty, CardDef, GameState } from './types';

function scoreWonderDraft(wonderId: string): number {
  const w = WONDERS[wonderId];
  if (!w) return 0;
  let score = (w.vp ?? 0) * 1.1;
  if (w.playAgain) score += 8;
  if (w.shields) score += w.shields * 3;
  if (w.coins) score += w.coins * 0.6;
  if (w.flexibleProduces) score += 5;
  if (w.buildFromDiscard) score += 5;
  if (w.drawDiscardedProgress) score += 5;
  if (w.destroyOpponentCard) score += 4;
  return score;
}

function scoreCardValue(
  card: CardDef,
  state: GameState,
  aiIdx: 0 | 1,
  difficulty: AIDifficulty
): number {
  const ai = state.players[aiIdx];
  const opp = state.players[aiIdx === 0 ? 1 : 0];
  let score = (card.vp ?? 0) * 1.4;

  if (card.produces) {
    const totalRes = Object.values(card.produces).reduce((a, b) => a + (b ?? 0), 0);
    score += totalRes * (state.age === 1 ? 4.5 : 2.5);
  }
  if (card.flexibleProduces) {
    score += 5.5;
  }
  if (card.tradingDiscount) {
    score += 4;
  }
  if (card.coins) {
    score += card.coins * 0.7;
  }
  if (card.chainTo) {
    score += state.age === 1 ? 2.5 : 1.5;
  }
  if (card.shields) {
    const extra = ai.progressTokens.includes('pt_strategy') ? 1 : 0;
    const shields = card.shields + extra;
    const pos = aiIdx === 0 ? state.conflictPosition : -state.conflictPosition;
    // Instant military win!
    if (pos + shields >= 9) return 1000;
    score += shields * (difficulty === 'hard' || difficulty === 'master' ? 3.8 : 3.0);
  }
  if (card.science) {
    const counts = getScienceSymbolCounts(ai);
    const distinct = getDistinctScienceCount(ai);
    if (counts[card.science] === 0 && distinct + 1 >= 6) return 1000;
    if (counts[card.science] === 1 && state.boardProgressTokens.length > 0) {
      score += 8; // Triggers progress token!
    } else if (counts[card.science] === 0) {
      score += 5;
    } else {
      score += 1.5;
    }
  }
  if (card.color === 'purple') {
    score += 7;
  }
  if (card.coinsPerCard) {
    score += 4;
  }

  // Defensive blocking in normal/hard: deny opponent's science pair or military win
  if (difficulty !== 'easy') {
    if (card.science) {
      const oppCounts = getScienceSymbolCounts(opp);
      const oppDistinct = getDistinctScienceCount(opp);
      if (oppCounts[card.science] === 0 && oppDistinct + 1 >= 6) score += 25;
      else if (oppCounts[card.science] === 1) score += 4;
    }
    if (card.shields) {
      const oppPos = aiIdx === 0 ? -state.conflictPosition : state.conflictPosition;
      if (oppPos + card.shields >= 9) score += 25;
    }
  }

  return score;
}

export function performAITurn(state: GameState): GameState {
  const aiIdx = state.currentPlayer;
  const ai = state.players[aiIdx];
  const oppIdx: 0 | 1 = aiIdx === 0 ? 1 : 0;
  const opp = state.players[oppIdx];
  const diff = state.aiDifficulty;

  if (state.phase === 'wonder_draft') {
    const sorted = [...state.wonderDraft.pool].sort(
      (a, b) => scoreWonderDraft(b) - scoreWonderDraft(a)
    );
    const pick =
      diff === 'easy' && sorted.length > 1 && Math.random() < 0.4
        ? sorted[1]
        : sorted[0];
    return pickWonder(state, pick);
  }

  if (state.phase === 'choose_progress') {
    const priority = [
      'pt_law',
      'pt_theology',
      'pt_mathematics',
      'pt_philosophy',
      'pt_economy',
      'pt_architecture',
      'pt_strategy',
      'pt_masonry',
      'pt_urbanism',
      'pt_agriculture',
    ];
    const best =
      priority.find((id) => state.boardProgressTokens.includes(id)) ??
      state.boardProgressTokens[0];
    return chooseProgressToken(state, best);
  }

  if (state.phase === 'choose_discarded_progress') {
    const best = state.discardedProgressTokens[0];
    return chooseDiscardedProgressToken(state, best);
  }

  if (state.phase === 'destroy_card') {
    const color = state.pendingDestroyColor;
    const candidates = opp.cards.filter((id) => CARDS[id]?.color === color);
    candidates.sort((a, b) => {
      const resA = Object.values(CARDS[a]?.produces ?? {}).reduce((x, y) => x + (y ?? 0), 0);
      const resB = Object.values(CARDS[b]?.produces ?? {}).reduce((x, y) => x + (y ?? 0), 0);
      return resB - resA;
    });
    return destroyOpponentCard(state, candidates[0]);
  }

  if (state.phase === 'build_discard') {
    const sorted = [...state.discardPile].sort(
      (a, b) =>
        scoreCardValue(CARDS[b], state, aiIdx, diff) -
        scoreCardValue(CARDS[a], state, aiIdx, diff)
    );
    return buildCardFromDiscard(state, sorted[0]);
  }

  if (state.phase === 'choose_age_starter') {
    return chooseAgeStarter(state, aiIdx);
  }

  if (state.phase !== 'playing') return state;

  // Evaluate all playable actions
  type Candidate = { score: number; run: () => GameState };
  const candidates: Candidate[] = [];

  const playableSlots = state.pyramid.filter((s) => isSlotPlayable(state.pyramid, s.index));

  for (const slot of playableSlots) {
    const card = slot.cardId ? CARDS[slot.cardId] : null;
    if (!card) continue;

    // 1. Build card
    const buildCost = getCardBuildCost(ai, opp, card);
    if (buildCost.canAfford) {
      let val = scoreCardValue(card, state, aiIdx, diff);
      val -= buildCost.totalCoins * 0.75;
      if (buildCost.freeByChain && ai.progressTokens.includes('pt_urbanism')) {
        val += 3;
      }
      candidates.push({
        score: val,
        run: () => buildCardFromPyramid(state, slot.index),
      });
    }

    // 2. Build Wonder
    if (state.totalWondersBuilt < 7) {
      for (const w of ai.wonders) {
        if (w.built) continue;
        const wonderDef = WONDERS[w.wonderId];
        if (!wonderDef) continue;
        const wCost = getWonderBuildCost(ai, opp, wonderDef);
        if (wCost.canAfford) {
          let val = scoreWonderDraft(w.wonderId) - wCost.totalCoins * 0.7;
          const pos = aiIdx === 0 ? state.conflictPosition : -state.conflictPosition;
          if (wonderDef.shields && pos + wonderDef.shields >= 9) val = 1000;
          if (ai.progressTokens.includes('pt_theology') && !wonderDef.playAgain) {
            val += 6;
          }
          candidates.push({
            score: val,
            run: () => buildWonderFromPyramid(state, slot.index, w.wonderId),
          });
        }
      }
    }

    // 3. Discard for coins
    const yellowCount = ai.cards.filter((id) => CARDS[id]?.color === 'yellow').length;
    const coinGain = 2 + yellowCount;
    const discardScore = coinGain * 0.8 + (ai.coins < 3 ? 3 : 0);
    candidates.push({
      score: discardScore,
      run: () => discardCardFromPyramid(state, slot.index),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Master difficulty: 2-ply lookahead to avoid unlocking killer cards for the opponent
  if (diff === 'master' && candidates.length > 1) {
    let bestCandidate = candidates[0];
    let bestAdjusted = -Infinity;

    for (const cand of candidates.slice(0, 6)) {
      if (cand.score >= 900) {
        bestCandidate = cand;
        break;
      }

      const nextState = cand.run();
      let adjusted = cand.score;

      if (nextState.phase === 'game_over' && nextState.winner === aiIdx) {
        bestCandidate = cand;
        break;
      }

      // If AI gets another turn (playAgain wonder), add strong tempo bonus
      if (nextState.currentPlayer === aiIdx && nextState.phase === 'playing') {
        adjusted += 8;
      } else if (nextState.phase === 'playing' && nextState.currentPlayer === oppIdx) {
        // Evaluate opponent's best response on the resulting board
        const nextOpp = nextState.players[oppIdx];
        const nextAi = nextState.players[aiIdx];
        const oppPlayable = nextState.pyramid.filter((s) =>
          isSlotPlayable(nextState.pyramid, s.index)
        );
        let oppMaxThreat = 0;
        for (const os of oppPlayable) {
          const oCard = os.cardId ? CARDS[os.cardId] : null;
          if (!oCard) continue;
          const oCost = getCardBuildCost(nextOpp, nextAi, oCard);
          if (!oCost.canAfford) continue;
          const threat =
            scoreCardValue(oCard, nextState, oppIdx, 'hard') - oCost.totalCoins * 0.65;
          if (threat > oppMaxThreat) oppMaxThreat = threat;
        }
        adjusted -= oppMaxThreat * 0.65;
      }

      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestCandidate = cand;
      }
    }

    return bestCandidate.run();
  }

  if (diff === 'easy' && candidates.length > 2 && Math.random() < 0.35) {
    const pickIdx = Math.floor(Math.random() * Math.min(3, candidates.length));
    return candidates[pickIdx].run();
  }

  return candidates[0].run();
}
