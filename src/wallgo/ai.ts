import {
  computeTerritories,
  getValidMoves,
  getValidWallEdgesForPiece,
  GRID_SIZE,
  isCellOccupied,
  movePiece,
  placeInitialPiece,
  placeWall,
} from './engine';
import { WallGoState } from './types';

function evaluateWallGo(state: WallGoState, aiIdx: number): number {
  const terr = computeTerritories(state);
  if (state.phase === 'game_over') {
    if (state.winner === aiIdx) return 10000 + terr.areas[aiIdx];
    if (state.winner === null) return 0;
    return -10000 - terr.areas[aiIdx];
  }

  let bestOppArea = 0;
  for (let i = 0; i < state.playerCount; i++) {
    if (i !== aiIdx && terr.areas[i] > bestOppArea) bestOppArea = terr.areas[i];
  }

  let score = (terr.areas[aiIdx] - bestOppArea) * 4.5;

  // Mobility bonus: how many reachable cells AI pieces have vs opponents
  for (const p of state.pieces) {
    const mob = getValidMoves(state, p.id, false).length;
    if (p.owner === aiIdx) score += mob * 0.6;
    else score -= mob * 0.45;
  }

  return score;
}

export function performWallGoAITurn(state: WallGoState): WallGoState {
  if (state.phase === 'game_over') return state;
  const aiIdx = state.currentPlayer;
  const player = state.players[aiIdx];
  if (!player?.isAI) return state;

  // 1. Setup placement
  if (state.phase === 'setup') {
    const candidates: { r: number; c: number; score: number }[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (isCellOccupied(state.pieces, r, c)) continue;
        // Prefer inner cells (dist from center) and separation from enemy pieces
        const centerDist = Math.abs(r - 3) + Math.abs(c - 3);
        let minEnemyDist = 10;
        for (const p of state.pieces) {
          if (p.owner !== aiIdx) {
            const d = Math.abs(r - p.row) + Math.abs(c - p.col);
            if (d < minEnemyDist) minEnemyDist = d;
          }
        }
        const s = -centerDist * 1.4 + Math.min(minEnemyDist, 4) * 1.2 + Math.random() * 0.4;
        candidates.push({ r, c, score: s });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const pick =
      state.difficulty === 'easy' && candidates.length > 3
        ? candidates[Math.floor(Math.random() * 4)]
        : candidates[0];
    return placeInitialPiece(state, pick.r, pick.c);
  }

  // 2. If somehow already in 'wall' phase
  if (state.phase === 'wall' && state.movedPieceId) {
    const edges = getValidWallEdgesForPiece(
      state.pieces,
      state.hWalls,
      state.vWalls,
      state.movedPieceId
    );
    if (edges.length === 0) return state;
    let bestEdge = edges[0];
    let bestScore = -Infinity;
    for (const e of edges) {
      const next = placeWall(state, e);
      const val = evaluateWallGo(next, aiIdx);
      if (val > bestScore) {
        bestScore = val;
        bestEdge = e;
      }
    }
    return placeWall(state, bestEdge);
  }

  // 3. 'move' phase -> evaluate (piece, target, wallEdge), then perform ONLY the move first
  // so the user clearly sees which piece moved before the wall is placed next to it!
  const myPieces = state.pieces.filter((p) => p.owner === aiIdx);
  const scoredMoves: { afterMove: WallGoState; score: number }[] = [];

  for (const piece of myPieces) {
    const allowBreak =
      state.difficulty === 'hard' && player.wallBreakLeft > 0;
    const targets = getValidMoves(state, piece.id, allowBreak);

    for (const t of targets) {
      const stateForMove: WallGoState = t.brokenWall
        ? { ...state, useWallBreak: true }
        : { ...state, useWallBreak: false };
      const afterMove = movePiece(stateForMove, piece.id, t.row, t.col);

      if (afterMove.phase !== 'wall' || !afterMove.movedPieceId) {
        scoredMoves.push({
          afterMove,
          score: evaluateWallGo(afterMove, aiIdx),
        });
        continue;
      }

      const edges = getValidWallEdgesForPiece(
        afterMove.pieces,
        afterMove.hWalls,
        afterMove.vWalls,
        afterMove.movedPieceId
      );
      let bestForThisMove = -Infinity;
      for (const e of edges) {
        const afterWall = placeWall(afterMove, e);
        let val = evaluateWallGo(afterWall, aiIdx);
        if (t.brokenWall) val -= 3.5;
        if (val > bestForThisMove) bestForThisMove = val;
      }
      if (bestForThisMove > -Infinity) {
        scoredMoves.push({ afterMove, score: bestForThisMove });
      }
    }
  }

  if (scoredMoves.length === 0) return state;
  scoredMoves.sort((a, b) => b.score - a.score);

  if (state.difficulty === 'easy' && scoredMoves.length > 4) {
    const idx = Math.floor(Math.random() * Math.min(5, scoredMoves.length));
    return scoredMoves[idx].afterMove;
  }
  if (state.difficulty === 'normal' && scoredMoves.length > 2 && Math.random() < 0.2) {
    return scoredMoves[1].afterMove;
  }

  return scoredMoves[0].afterMove;
}
