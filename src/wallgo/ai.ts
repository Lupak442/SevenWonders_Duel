import {
  computeTerritories,
  getValidMoves,
  getValidWallEdgesForPiece,
  GRID_SIZE,
  hasWallBetween,
  isCellOccupied,
  movePiece,
  placeInitialPiece,
  placeWall,
} from './engine';
import { WallEdge, WallGoState } from './types';

/**
 * Multi-source BFS Voronoi territory potential: counts how many open cells
 * are strictly closer to `aiIdx`'s pieces than to any opponent's pieces.
 */
function computeVoronoiAdvantage(state: WallGoState, aiIdx: number): number {
  const dist: number[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(99)
  );
  const ownerMap: number[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(-1)
  );
  const queue: [number, number, number, number][] = [];

  for (const p of state.pieces) {
    if (state.players[p.owner]?.disqualified) continue;
    dist[p.row][p.col] = 0;
    ownerMap[p.row][p.col] = p.owner;
    queue.push([p.row, p.col, p.owner, 0]);
  }

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, 1],
    [0, -1],
  ];

  let head = 0;
  while (head < queue.length) {
    const [r, c, own, d] = queue[head++];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
      if (hasWallBetween(state.hWalls, state.vWalls, r, c, nr, nc)) continue;
      if (dist[nr][nc] > d + 1) {
        dist[nr][nc] = d + 1;
        ownerMap[nr][nc] = own;
        queue.push([nr, nc, own, d + 1]);
      } else if (dist[nr][nc] === d + 1 && ownerMap[nr][nc] !== own) {
        ownerMap[nr][nc] = -2; // contested tie
      }
    }
  }

  let aiCells = 0;
  let oppCells = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (ownerMap[r][c] === aiIdx) aiCells++;
      else if (ownerMap[r][c] >= 0) oppCells++;
    }
  }
  return aiCells - oppCells / Math.max(1, state.playerCount - 1);
}

function evaluateWallGo(state: WallGoState, aiIdx: number, useVoronoi = false): number {
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

  let score = (terr.areas[aiIdx] - bestOppArea) * 5.0;
  if (useVoronoi) {
    score += computeVoronoiAdvantage(state, aiIdx) * 1.45;
  }

  // Mobility bonus: how many reachable cells AI pieces have vs opponents
  for (const p of state.pieces) {
    const mob = getValidMoves(state, p.id, false).length;
    if (p.owner === aiIdx) score += mob * 0.55;
    else score -= mob * 0.45;
  }

  return score;
}

function getTopFullTurnStates(
  state: WallGoState,
  playerIdx: number,
  allowBreak: boolean,
  useVoronoi: boolean,
  limit: number
): { afterMove: WallGoState; afterWall: WallGoState; edge: WallEdge | null; score: number }[] {
  const myPieces = state.pieces.filter((p) => p.owner === playerIdx);
  const results: {
    afterMove: WallGoState;
    afterWall: WallGoState;
    edge: WallEdge | null;
    score: number;
  }[] = [];

  for (const piece of myPieces) {
    const targets = getValidMoves(state, piece.id, allowBreak);
    for (const t of targets) {
      const stateForMove: WallGoState = t.brokenWall
        ? { ...state, useWallBreak: true }
        : { ...state, useWallBreak: false };
      const afterMove = movePiece(stateForMove, piece.id, t.row, t.col);

      if (afterMove.phase !== 'wall' || !afterMove.movedPieceId) {
        results.push({
          afterMove,
          afterWall: afterMove,
          edge: null,
          score: evaluateWallGo(afterMove, playerIdx, useVoronoi),
        });
        continue;
      }

      const edges = getValidWallEdgesForPiece(
        afterMove.pieces,
        afterMove.hWalls,
        afterMove.vWalls,
        afterMove.movedPieceId
      );
      for (const e of edges) {
        const afterWall = placeWall(afterMove, e);
        let val = evaluateWallGo(afterWall, playerIdx, useVoronoi);
        if (t.brokenWall) val -= 3.5;
        results.push({ afterMove, afterWall, edge: e, score: val });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
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

  // 2. 'wall' phase: place best wall adjacent to movedPieceId
  if (state.phase === 'wall' && state.movedPieceId) {
    const edges = getValidWallEdgesForPiece(
      state.pieces,
      state.hWalls,
      state.vWalls,
      state.movedPieceId
    );
    if (edges.length === 0) return state;
    const useVoronoi = state.difficulty === 'master';
    let bestEdge = edges[0];
    let bestScore = -Infinity;
    for (const e of edges) {
      const next = placeWall(state, e);
      const val = evaluateWallGo(next, aiIdx, useVoronoi);
      if (val > bestScore) {
        bestScore = val;
        bestEdge = e;
      }
    }
    return placeWall(state, bestEdge);
  }

  // 3. 'move' phase -> evaluate (piece, target, wallEdge), then perform ONLY the move first
  const allowBreak =
    (state.difficulty === 'hard' || state.difficulty === 'master') &&
    player.wallBreakLeft > 0;
  const useVoronoi = state.difficulty === 'master';
  const topCandidates = getTopFullTurnStates(
    state,
    aiIdx,
    allowBreak,
    useVoronoi,
    state.difficulty === 'master' ? 10 : 12
  );

  if (topCandidates.length === 0) return state;

  // Master difficulty: 2-ply lookahead — simulate opponent's best counter-move (move + wall)
  if (state.difficulty === 'master' && topCandidates.length > 1) {
    const deadline = Date.now() + 320;
    let bestMove = topCandidates[0].afterMove;
    let bestMinimax = -Infinity;

    for (const cand of topCandidates) {
      if (Date.now() > deadline) break;
      if (cand.afterWall.phase === 'game_over') {
        const endVal = evaluateWallGo(cand.afterWall, aiIdx, true);
        if (endVal > bestMinimax) {
          bestMinimax = endVal;
          bestMove = cand.afterMove;
        }
        continue;
      }

      const oppIdx = cand.afterWall.currentPlayer;
      const oppReplies = getTopFullTurnStates(cand.afterWall, oppIdx, false, true, 5);
      let worstForAi = evaluateWallGo(cand.afterWall, aiIdx, true);
      if (oppReplies.length > 0) {
        worstForAi = Math.min(
          ...oppReplies.map((r) => evaluateWallGo(r.afterWall, aiIdx, true))
        );
      }

      if (worstForAi > bestMinimax) {
        bestMinimax = worstForAi;
        bestMove = cand.afterMove;
      }
    }
    return bestMove;
  }

  if (state.difficulty === 'easy' && topCandidates.length > 4) {
    const idx = Math.floor(Math.random() * Math.min(5, topCandidates.length));
    return topCandidates[idx].afterMove;
  }
  if (state.difficulty === 'normal' && topCandidates.length > 2 && Math.random() < 0.2) {
    return topCandidates[1].afterMove;
  }

  return topCandidates[0].afterMove;
}
