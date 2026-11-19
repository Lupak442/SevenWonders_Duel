import { CARDS, WONDERS } from './cards';
import { getCardBuildCost, getFixedProduction, getWonderBuildCost } from './cost';
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
import {
  calculateScore,
  getDistinctScienceCount,
  getScienceSymbolCounts,
} from './scoring';
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
    score += shields * (difficulty === 'hard' || difficulty === 'master' || difficulty === 'grandmaster' ? 3.8 : 3.0);
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

/**
 * Full zero-sum board evaluation from `aiIdx`'s perspective for Grandmaster Alpha-Beta search.
 */
function evaluateBoard(state: GameState, aiIdx: 0 | 1): number {
  const oppIdx: 0 | 1 = aiIdx === 0 ? 1 : 0;

  if (state.phase === 'game_over') {
    if (state.winner === aiIdx) return 100000;
    if (state.winner === oppIdx) return -100000;
    return 0;
  }

  const ai = state.players[aiIdx];
  const opp = state.players[oppIdx];

  const aiScore = calculateScore(state, aiIdx);
  const oppScore = calculateScore(state, oppIdx);
  let evalScore = (aiScore.total - oppScore.total) * 3.2;

  // 1. Military pressure & supremacy proximity
  const milPos = aiIdx === 0 ? state.conflictPosition : -state.conflictPosition;
  evalScore += milPos * 2.4;
  if (milPos >= 6) evalScore += 14;
  else if (milPos <= -6) evalScore -= 16;

  // 2. Science threat (4/6 and 5/6 are huge threats)
  const aiSci = getDistinctScienceCount(ai);
  const oppSci = getDistinctScienceCount(opp);
  evalScore += (aiSci - oppSci) * 6.5;
  if (aiSci >= 5) evalScore += 28;
  if (oppSci >= 5) evalScore -= 34;

  // 3. Economy & resource monopoly (Age 1 & 2 value resources & rare goods highly)
  const resWeight = state.age === 1 ? 4.0 : state.age === 2 ? 2.4 : 0.6;
  const aiProd = getFixedProduction(ai);
  const oppProd = getFixedProduction(opp);
  const resTypes = ['wood', 'clay', 'stone', 'glass', 'papyrus'] as const;
  for (const r of resTypes) {
    const rareMult = r === 'glass' || r === 'papyrus' ? 1.35 : 1.0;
    evalScore += (aiProd[r] - oppProd[r]) * resWeight * rareMult;
    // Monopoly bonus: if AI produces a resource that Opp has 0 of, Opp pays extra trade tax
    if (aiProd[r] > 0 && oppProd[r] === 0) {
      evalScore += aiProd[r] * (state.age <= 2 ? 1.6 : 0.5);
    }
    if (oppProd[r] > 0 && aiProd[r] === 0) {
      evalScore -= oppProd[r] * (state.age <= 2 ? 1.6 : 0.5);
    }
  }

  // Coin difference
  evalScore += (ai.coins - opp.coins) * 0.8;

  // 4. Progress tokens owned
  evalScore += (ai.progressTokens.length - opp.progressTokens.length) * 6.5;

  // 5. Unbuilt Wonders tempo (especially playAgain wonders)
  if (state.totalWondersBuilt < 7) {
    for (const w of ai.wonders) {
      if (!w.built) {
        const def = WONDERS[w.wonderId];
        evalScore += def?.playAgain ? 8.5 : 3.5;
      }
    }
    for (const w of opp.wonders) {
      if (!w.built) {
        const def = WONDERS[w.wonderId];
        evalScore -= def?.playAgain ? 8.5 : 3.5;
      }
    }
  }

  return evalScore;
}

/**
 * Automatically resolves intermediate sub-phases (progress token, destroy card, build discard)
 * during lookahead search so Alpha-Beta continues through the full turn!
 */
function resolveSubPhasesForSearch(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (
    guard++ < 4 &&
    s.phase !== 'playing' &&
    s.phase !== 'game_over' &&
    s.phase !== 'wonder_draft'
  ) {
    const cur = s.currentPlayer;
    const oppIdx: 0 | 1 = cur === 0 ? 1 : 0;
    const opp = s.players[oppIdx];

    if (s.phase === 'choose_progress') {
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
        priority.find((id) => s.boardProgressTokens.includes(id)) ??
        s.boardProgressTokens[0];
      if (!best) break;
      s = chooseProgressToken(s, best);
    } else if (s.phase === 'choose_discarded_progress') {
      const best = s.discardedProgressTokens[0];
      if (!best) break;
      s = chooseDiscardedProgressToken(s, best);
    } else if (s.phase === 'destroy_card') {
      const color = s.pendingDestroyColor;
      const candidates = opp.cards.filter((id) => CARDS[id]?.color === color);
      if (candidates.length === 0) break;
      candidates.sort((a, b) => {
        const resA = Object.values(CARDS[a]?.produces ?? {}).reduce((x, y) => x + (y ?? 0), 0);
        const resB = Object.values(CARDS[b]?.produces ?? {}).reduce((x, y) => x + (y ?? 0), 0);
        return resB - resA;
      });
      s = destroyOpponentCard(s, candidates[0]);
    } else if (s.phase === 'build_discard') {
      if (s.discardPile.length === 0) break;
      const sorted = [...s.discardPile].sort(
        (a, b) =>
          scoreCardValue(CARDS[b], s, cur, 'grandmaster') -
          scoreCardValue(CARDS[a], s, cur, 'grandmaster')
      );
      s = buildCardFromDiscard(s, sorted[0]);
    } else if (s.phase === 'choose_age_starter') {
      s = chooseAgeStarter(s, cur);
    } else {
      break;
    }
  }
  return s;
}

function countFaceUpCards(state: GameState): number {
  let c = 0;
  for (const s of state.pyramid) {
    if (s.cardId !== null && s.faceUp) c++;
  }
  return c;
}

type CandidateMove = { score: number; run: () => GameState };

function generateCandidates(state: GameState, playerIdx: 0 | 1): CandidateMove[] {
  const player = state.players[playerIdx];
  const oppIdx: 0 | 1 = playerIdx === 0 ? 1 : 0;
  const opp = state.players[oppIdx];
  const candidates: CandidateMove[] = [];

  const playableSlots = state.pyramid.filter((s) => isSlotPlayable(state.pyramid, s.index));

  for (const slot of playableSlots) {
    const card = slot.cardId ? CARDS[slot.cardId] : null;
    if (!card) continue;

    // 1. Build card
    const buildCost = getCardBuildCost(player, opp, card);
    if (buildCost.canAfford) {
      let val = scoreCardValue(card, state, playerIdx, 'grandmaster');
      val -= buildCost.totalCoins * 0.75;
      if (buildCost.freeByChain && player.progressTokens.includes('pt_urbanism')) {
        val += 3.5;
      }
      candidates.push({
        score: val,
        run: () => buildCardFromPyramid(state, slot.index),
      });
    }

    // 2. Build Wonder
    if (state.totalWondersBuilt < 7) {
      for (const w of player.wonders) {
        if (w.built) continue;
        const wonderDef = WONDERS[w.wonderId];
        if (!wonderDef) continue;
        const wCost = getWonderBuildCost(player, opp, wonderDef);
        if (wCost.canAfford) {
          let val = scoreWonderDraft(w.wonderId) - wCost.totalCoins * 0.7;
          const pos = playerIdx === 0 ? state.conflictPosition : -state.conflictPosition;
          if (wonderDef.shields && pos + wonderDef.shields >= 9) val = 1000;
          if (player.progressTokens.includes('pt_theology') && !wonderDef.playAgain) {
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
    const yellowCount = player.cards.filter((id) => CARDS[id]?.color === 'yellow').length;
    const coinGain = 2 + yellowCount;
    const oppThreat = scoreCardValue(card, state, oppIdx, 'hard');
    const discardScore =
      coinGain * 0.8 + (player.coins < 3 ? 3 : 0) + (oppThreat > 15 ? oppThreat * 0.25 : 0);
    candidates.push({
      score: discardScore,
      run: () => discardCardFromPyramid(state, slot.index),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  aiIdx: 0 | 1,
  deadline: number
): number {
  const resolved = resolveSubPhasesForSearch(state);
  if (
    depth <= 0 ||
    resolved.phase === 'game_over' ||
    resolved.phase !== 'playing' ||
    Date.now() > deadline
  ) {
    return evaluateBoard(resolved, aiIdx);
  }

  const cur = resolved.currentPlayer;
  const isMax = cur === aiIdx;
  const moves = generateCandidates(resolved, cur).slice(0, 8);
  if (moves.length === 0) return evaluateBoard(resolved, aiIdx);

  const faceUpBefore = countFaceUpCards(resolved);

  if (isMax) {
    let best = -Infinity;
    for (const m of moves) {
      const nextRaw = m.run();
      const next = resolveSubPhasesForSearch(nextRaw);
      let val = alphaBeta(next, depth - 1, alpha, beta, aiIdx, deadline);
      // Turn-parity penalty: avoid flipping face-down cards for the opponent
      if (next.currentPlayer !== cur && next.phase === 'playing') {
        const faceUpAfter = countFaceUpCards(next);
        const flippedForOpp = Math.max(0, faceUpAfter - (faceUpBefore - 1));
        if (flippedForOpp > 0) val -= flippedForOpp * 2.8;
      }
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const nextRaw = m.run();
      const next = resolveSubPhasesForSearch(nextRaw);
      let val = alphaBeta(next, depth - 1, alpha, beta, aiIdx, deadline);
      if (next.currentPlayer !== cur && next.phase === 'playing') {
        const faceUpAfter = countFaceUpCards(next);
        const flippedForAi = Math.max(0, faceUpAfter - (faceUpBefore - 1));
        if (flippedForAi > 0) val += flippedForAi * 2.8;
      }
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function performAITurn(state: GameState): GameState {
  const aiIdx = state.currentPlayer;
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
    if (diff === 'grandmaster') {
      // In Grandmaster, evaluate whether going 1st or 2nd yields a better board after 2 plies
      const sFirst = chooseAgeStarter(state, aiIdx);
      const sSecond = chooseAgeStarter(state, oppIdx);
      const deadline = Date.now() + 80;
      const vFirst = alphaBeta(sFirst, 2, -Infinity, Infinity, aiIdx, deadline);
      const vSecond = alphaBeta(sSecond, 2, -Infinity, Infinity, aiIdx, deadline);
      return vFirst >= vSecond ? sFirst : sSecond;
    }
    return chooseAgeStarter(state, aiIdx);
  }

  if (state.phase !== 'playing') return state;

  const candidates = generateCandidates(state, aiIdx);

  // Grandmaster difficulty: Iterative-deepening Alpha-Beta Minimax (up to depth 5–7)
  if (diff === 'grandmaster' && candidates.length > 1) {
    if (candidates[0].score >= 900) return candidates[0].run();
    const remainingCards = state.pyramid.filter((s) => s.cardId !== null).length;
    const maxDepth = remainingCards <= 10 ? 7 : 5;
    const deadline = Date.now() + 650;
    const topMoves = candidates.slice(0, 10);
    const faceUpBefore = countFaceUpCards(state);

    let bestMove = topMoves[0];
    for (let depth = 2; depth <= maxDepth; depth++) {
      if (Date.now() > deadline) break;
      let iterBest = topMoves[0];
      let iterBestVal = -Infinity;
      let completed = true;

      for (const cand of topMoves) {
        if (Date.now() > deadline) {
          completed = false;
          break;
        }
        const nextRaw = cand.run();
        const next = resolveSubPhasesForSearch(nextRaw);
        let val = alphaBeta(next, depth - 1, -Infinity, Infinity, aiIdx, deadline);
        if (next.currentPlayer !== aiIdx && next.phase === 'playing') {
          const faceUpAfter = countFaceUpCards(next);
          const flippedForOpp = Math.max(0, faceUpAfter - (faceUpBefore - 1));
          if (flippedForOpp > 0) val -= flippedForOpp * 2.8;
        }
        if (val > iterBestVal) {
          iterBestVal = val;
          iterBest = cand;
        }
      }

      if (completed) {
        bestMove = iterBest;
      }
    }
    return bestMove.run();
  }

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
