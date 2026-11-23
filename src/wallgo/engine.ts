import {
  MoveTarget,
  PieceShape,
  TerritoryResult,
  WallDir,
  WallEdge,
  WallGoDifficulty,
  WallGoMode,
  WallGoPiece,
  WallGoPlayer,
  WallGoState,
} from './types';

export const GRID_SIZE = 7;

function createEmptyGrid<T>(rows: number, cols: number, val: T): T[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => val));
}

function addLog(
  state: WallGoState,
  text: string,
  player?: number
): WallGoState['logs'] {
  const nextId = (state.logs[0]?.id ?? 0) + 1;
  return [{ id: nextId, text, player }, ...state.logs].slice(0, 50);
}

function buildSnakeOrder(playerCount: 2 | 3, starter: number): number[] {
  const base = playerCount === 2 ? [0, 1, 1, 0] : [0, 1, 2, 2, 1, 0];
  return base.map((idx) => (idx + starter) % playerCount);
}

export function createInitialWallGoState(options: {
  mode: WallGoMode;
  playerCount: 2 | 3;
  difficulty?: WallGoDifficulty;
  playerNames?: string[];
  firstPlayer?: number | 'random';
}): WallGoState {
  const {
    mode,
    playerCount,
    difficulty = 'normal',
    playerNames = [],
    firstPlayer = 0,
  } = options;
  const starter =
    firstPlayer === 'random'
      ? Math.floor(Math.random() * playerCount)
      : ((firstPlayer % playerCount) + playerCount) % playerCount;
  const players: WallGoPlayer[] = Array.from({ length: playerCount }, (_, idx) => ({
    id: idx,
    name:
      playerNames[idx]?.trim() ||
      (mode === 'ai' && idx > 0 ? `데블스 봇 ${idx}` : `플레이어 ${idx + 1}`),
    isAI: mode === 'ai' && idx > 0,
    wallBreakLeft: playerCount === 3 ? 1 : 0,
  }));

  const setupOrder = buildSnakeOrder(playerCount, starter);

  // In 2-player mode, each player's 2 Circle pieces start at fixed symmetric positions
  const initialPieces: WallGoPiece[] =
    playerCount === 2
      ? [
          { id: 'p0_init_0', owner: 0, shape: 'circle', row: 1, col: 1 },
          { id: 'p0_init_1', owner: 0, shape: 'circle', row: 5, col: 5 },
          { id: 'p1_init_0', owner: 1, shape: 'circle', row: 1, col: 5 },
          { id: 'p1_init_1', owner: 1, shape: 'circle', row: 5, col: 1 },
        ]
      : [];

  return {
    phase: 'setup',
    mode,
    difficulty,
    playerCount,
    players,
    currentPlayer: setupOrder[0],
    setupOrder,
    setupStep: 0,
    pieces: initialPieces,
    hWalls: createEmptyGrid<number | null>(GRID_SIZE - 1, GRID_SIZE, null),
    vWalls: createEmptyGrid<number | null>(GRID_SIZE, GRID_SIZE - 1, null),
    selectedPieceId: null,
    movedPieceId: null,
    useWallBreak: false,
    turnCount: 1,
    winner: null,
    logs: [
      {
        id: 1,
        text:
          playerCount === 2
            ? `벽바둑 2 (2인전) 시작! 원형 말 2개씩 지정 배치 완료. ${players[setupOrder[0]].name}부터 사각 말(■)을 배치하세요.`
            : `벽바둑 2 (3인전) 시작! ${players[setupOrder[0]].name}부터 말을 배치하세요.`,
      },
    ],
  };
}

export function getNextPlacementShape(state: WallGoState, playerId: number): PieceShape {
  if (state.playerCount === 2) return 'square';
  const owned = state.pieces.filter((p) => p.owner === playerId);
  const squares = owned.filter((p) => p.shape === 'square').length;
  const circles = owned.filter((p) => p.shape === 'circle').length;
  return squares <= circles ? 'square' : 'circle';
}

export function isCellOccupied(pieces: WallGoPiece[], r: number, c: number): boolean {
  return pieces.some((p) => p.row === r && p.col === c);
}

export function placeInitialPiece(
  state: WallGoState,
  row: number,
  col: number
): WallGoState {
  if (state.phase !== 'setup') return state;
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return state;
  if (isCellOccupied(state.pieces, row, col)) return state;

  const pIdx = state.currentPlayer;
  const shape = getNextPlacementShape(state, pIdx);
  const newPiece: WallGoPiece = {
    id: `p${pIdx}_${state.pieces.length}`,
    owner: pIdx,
    shape,
    row,
    col,
  };

  const pieces = [...state.pieces, newPiece];
  const nextStep = state.setupStep + 1;
  const shapeLabel = shape === 'square' ? '사각 말(■)' : '원형 말(●)';
  let logs = addLog(
    state,
    `${state.players[pIdx].name}: (${row + 1},${col + 1})에 ${shapeLabel} 배치`,
    pIdx
  );

  if (nextStep >= state.setupOrder.length) {
    const firstMover = state.setupOrder[0] ?? 0;
    logs = addLog(
      { ...state, logs },
      `배치 완료! ${state.players[firstMover].name} 차례부터 이동을 시작합니다.`
    );
    return {
      ...state,
      phase: 'move',
      pieces,
      setupStep: nextStep,
      currentPlayer: firstMover,
      logs,
    };
  }

  return {
    ...state,
    pieces,
    setupStep: nextStep,
    currentPlayer: state.setupOrder[nextStep],
    logs,
  };
}

export function hasWallBetween(
  hWalls: (number | null)[][],
  vWalls: (number | null)[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number
): WallEdge | null {
  if (r1 === r2 && Math.abs(c1 - c2) === 1) {
    const minC = Math.min(c1, c2);
    return vWalls[r1][minC] !== null ? { type: 'v', r: r1, c: minC } : null;
  }
  if (c1 === c2 && Math.abs(r1 - r2) === 1) {
    const minR = Math.min(r1, r2);
    return hWalls[minR][c1] !== null ? { type: 'h', r: minR, c: c1 } : null;
  }
  return null;
}

const DIRS: { dr: number; dc: number; dir: WallDir }[] = [
  { dr: -1, dc: 0, dir: 'N' },
  { dr: 1, dc: 0, dir: 'S' },
  { dr: 0, dc: 1, dir: 'E' },
  { dr: 0, dc: -1, dir: 'W' },
];

/**
 * Computes all valid destinations (0, 1, or 2 steps) for a piece.
 * - Square: straight line only (0, 1, or 2 steps in one cardinal direction).
 * - Circle: up to 2 orthogonal steps, may turn 90 degrees on step 2.
 * - If allowWallBreak is true, may cross at most 1 wall along the path.
 */
export function getValidMoves(
  state: WallGoState,
  pieceId: string,
  allowWallBreak = false
): MoveTarget[] {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece) return [];

  const results: MoveTarget[] = [];
  const seen = new Map<string, WallEdge | null>();

  const tryAdd = (r: number, c: number, broken: WallEdge | null) => {
    const key = `${r},${c}`;
    if (!seen.has(key)) {
      seen.set(key, broken);
      results.push({ row: r, col: c, brokenWall: broken });
    } else if (seen.get(key) !== null && broken === null) {
      // Prefer non-breaking path if both exist
      seen.set(key, null);
      const idx = results.findIndex((t) => t.row === r && t.col === c);
      if (idx >= 0) results[idx] = { row: r, col: c, brokenWall: null };
    }
  };

  if (piece.shape === 'square') {
    // Straight line up to 2 steps
    for (const { dr, dc } of DIRS) {
      let broken: WallEdge | null = null;
      for (let step = 1; step <= 2; step++) {
        const nr = piece.row + dr * step;
        const nc = piece.col + dc * step;
        const pr = piece.row + dr * (step - 1);
        const pc = piece.col + dc * (step - 1);
        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) break;
        const wall = hasWallBetween(state.hWalls, state.vWalls, pr, pc, nr, nc);
        if (wall) {
          if (allowWallBreak && broken === null) {
            broken = wall;
          } else {
            break;
          }
        }
        if (isCellOccupied(state.pieces, nr, nc)) break;
        tryAdd(nr, nc, broken);
      }
    }
  } else {
    // Circle: 8 directions (orthogonal + diagonal), max 1 step
    // 1) Orthogonal 4 directions (1 step)
    for (const d1 of DIRS) {
      const r1 = piece.row + d1.dr;
      const c1 = piece.col + d1.dc;
      if (r1 < 0 || r1 >= GRID_SIZE || c1 < 0 || c1 >= GRID_SIZE) continue;
      if (isCellOccupied(state.pieces, r1, c1)) continue;
      const w1 = hasWallBetween(state.hWalls, state.vWalls, piece.row, piece.col, r1, c1);
      if (w1 && !allowWallBreak) continue;
      tryAdd(r1, c1, w1);
    }

    // 2) Diagonal 4 directions (1 step)
    const DIAGS = [
      { dr: -1, dc: -1 },
      { dr: -1, dc: 1 },
      { dr: 1, dc: -1 },
      { dr: 1, dc: 1 },
    ];
    for (const { dr, dc } of DIAGS) {
      const nr = piece.row + dr;
      const nc = piece.col + dc;
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
      if (isCellOccupied(state.pieces, nr, nc)) continue;

      // Check the two L-paths: via (nr, piece.col) and via (piece.row, nc)
      const wA1 = hasWallBetween(state.hWalls, state.vWalls, piece.row, piece.col, nr, piece.col);
      const wA2 = hasWallBetween(state.hWalls, state.vWalls, nr, piece.col, nr, nc);
      const wallsA = [wA1, wA2].filter(Boolean) as WallEdge[];

      const wB1 = hasWallBetween(state.hWalls, state.vWalls, piece.row, piece.col, piece.row, nc);
      const wB2 = hasWallBetween(state.hWalls, state.vWalls, piece.row, nc, nr, nc);
      const wallsB = [wB1, wB2].filter(Boolean) as WallEdge[];

      if (wallsA.length === 0 || wallsB.length === 0) {
        tryAdd(nr, nc, null);
      } else if (allowWallBreak) {
        if (wallsA.length === 1) tryAdd(nr, nc, wallsA[0]);
        else if (wallsB.length === 1) tryAdd(nr, nc, wallsB[0]);
      }
    }
  }

  // Filter out destinations where no adjacent wall can be placed (must place 1 wall adjacent to moved piece)
  return results.filter((t) => {
    const hasEmptyAdj =
      (t.row > 0 &&
        (state.hWalls[t.row - 1][t.col] === null ||
          (t.brokenWall?.type === 'h' &&
            t.brokenWall.r === t.row - 1 &&
            t.brokenWall.c === t.col))) ||
      (t.row < GRID_SIZE - 1 &&
        (state.hWalls[t.row][t.col] === null ||
          (t.brokenWall?.type === 'h' &&
            t.brokenWall.r === t.row &&
            t.brokenWall.c === t.col))) ||
      (t.col > 0 &&
        (state.vWalls[t.row][t.col - 1] === null ||
          (t.brokenWall?.type === 'v' &&
            t.brokenWall.r === t.row &&
            t.brokenWall.c === t.col - 1))) ||
      (t.col < GRID_SIZE - 1 &&
        (state.vWalls[t.row][t.col] === null ||
          (t.brokenWall?.type === 'v' &&
            t.brokenWall.r === t.row &&
            t.brokenWall.c === t.col)));
    return hasEmptyAdj;
  });
}

export function movePiece(
  state: WallGoState,
  pieceId: string,
  targetRow: number,
  targetCol: number
): WallGoState {
  if (state.phase !== 'move') return state;
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.owner !== state.currentPlayer) return state;

  const player = state.players[state.currentPlayer];
  const allowBreak = state.useWallBreak && player.wallBreakLeft > 0;
  const valid = getValidMoves(state, pieceId, allowBreak);
  const target = valid.find((v) => v.row === targetRow && v.col === targetCol);
  if (!target) return state;

  const hWalls = state.hWalls.map((row) => [...row]);
  const vWalls = state.vWalls.map((row) => [...row]);
  const players = state.players.map((p) => ({ ...p }));

  let logText =
    piece.row === targetRow && piece.col === targetCol
      ? `${player.name}: 제자리 유지 (${targetRow + 1},${targetCol + 1})`
      : `${player.name}: ${piece.shape === 'square' ? '■' : '●'} (${targetRow + 1},${targetCol + 1}) 이동`;

  if (target.brokenWall) {
    if (target.brokenWall.type === 'h') {
      hWalls[target.brokenWall.r][target.brokenWall.c] = null;
    } else {
      vWalls[target.brokenWall.r][target.brokenWall.c] = null;
    }
    players[state.currentPlayer].wallBreakLeft -= 1;
    logText += ' [벽 부수기 사용!]';
  }

  const pieces = state.pieces.map((p) =>
    p.id === pieceId ? { ...p, row: targetRow, col: targetCol } : p
  );

  // Check if any adjacent wall slot is available; if not, check anywhere
  const adjEdges = getValidWallEdgesForPiece(pieces, hWalls, vWalls, pieceId);
  if (adjEdges.length === 0) {
    // No walls left on board at all -> advance turn
    return advanceTurnAfterWall({
      ...state,
      players,
      pieces,
      hWalls,
      vWalls,
      selectedPieceId: null,
      movedPieceId: null,
      useWallBreak: false,
      logs: addLog(state, logText, state.currentPlayer),
    });
  }

  return {
    ...state,
    phase: 'wall',
    players,
    pieces,
    hWalls,
    vWalls,
    selectedPieceId: pieceId,
    movedPieceId: pieceId,
    useWallBreak: false,
    logs: addLog(state, logText, state.currentPlayer),
  };
}

export function getValidWallEdgesForPiece(
  pieces: WallGoPiece[],
  hWalls: (number | null)[][],
  vWalls: (number | null)[][],
  pieceId: string
): WallEdge[] {
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return [];

  const edges: WallEdge[] = [];
  const { row, col } = piece;
  if (row > 0 && hWalls[row - 1][col] === null) edges.push({ type: 'h', r: row - 1, c: col });
  if (row < GRID_SIZE - 1 && hWalls[row][col] === null) edges.push({ type: 'h', r: row, c: col });
  if (col > 0 && vWalls[row][col - 1] === null) edges.push({ type: 'v', r: row, c: col - 1 });
  if (col < GRID_SIZE - 1 && vWalls[row][col] === null) edges.push({ type: 'v', r: row, c: col });

  return edges;
}

export function placeWall(state: WallGoState, edge: WallEdge): WallGoState {
  if (state.phase !== 'wall' || !state.movedPieceId) return state;
  const validEdges = getValidWallEdgesForPiece(
    state.pieces,
    state.hWalls,
    state.vWalls,
    state.movedPieceId
  );
  const ok = validEdges.some(
    (e) => e.type === edge.type && e.r === edge.r && e.c === edge.c
  );
  if (!ok) return state;

  const hWalls = state.hWalls.map((row) => [...row]);
  const vWalls = state.vWalls.map((row) => [...row]);
  if (edge.type === 'h') hWalls[edge.r][edge.c] = state.currentPlayer;
  else vWalls[edge.r][edge.c] = state.currentPlayer;

  const logs = addLog(
    state,
    `${state.players[state.currentPlayer].name}: 벽 설치 완료`,
    state.currentPlayer
  );

  return advanceTurnAfterWall({
    ...state,
    hWalls,
    vWalls,
    selectedPieceId: null,
    movedPieceId: null,
    logs,
  });
}

export function canPlayerMoveAnyPiece(state: WallGoState, playerId: number): boolean {
  const player = state.players[playerId];
  if (!player) return false;
  const allowBreak = player.wallBreakLeft > 0;
  return state.pieces
    .filter((p) => p.owner === playerId)
    .some((p) => getValidMoves(state, p.id, allowBreak).length > 0);
}

function advanceTurnAfterWall(state: WallGoState): WallGoState {
  const terr = computeTerritories(state);

  // Find next player who can actually move at least 1 piece
  let nextPlayer: number | null = null;
  for (let step = 1; step <= state.playerCount; step++) {
    const candidate = (state.currentPlayer + step) % state.playerCount;
    if (canPlayerMoveAnyPiece(state, candidate)) {
      nextPlayer = candidate;
      break;
    }
  }

  if (terr.allSeparated || nextPlayer === null) {
    // Determine winner: max total area, tiebreak maxSingle
    let bestPlayer = 0;
    let tied = false;
    for (let i = 1; i < state.playerCount; i++) {
      if (terr.areas[i] > terr.areas[bestPlayer]) {
        bestPlayer = i;
        tied = false;
      } else if (terr.areas[i] === terr.areas[bestPlayer]) {
        if (terr.maxSingle[i] > terr.maxSingle[bestPlayer]) {
          bestPlayer = i;
          tied = false;
        } else if (terr.maxSingle[i] === terr.maxSingle[bestPlayer]) {
          tied = true;
        }
      }
    }
    const winner = tied ? null : bestPlayer;
    const summary = terr.areas
      .map((a, i) => `${state.players[i].name} ${a}칸`)
      .join(' vs ');
    const winMsg =
      winner !== null
        ? `🏆 모든 영역 분리 완료! ${state.players[winner].name} 승리! (${summary})`
        : `🤝 모든 영역 분리 완료! 무승부 (${summary})`;

    return {
      ...state,
      phase: 'game_over',
      winner,
      logs: addLog(state, winMsg, winner ?? undefined),
    };
  }

  return {
    ...state,
    phase: 'move',
    currentPlayer: nextPlayer,
    turnCount: state.turnCount + 1,
  };
}

/**
 * Flood-fills all connected components on the 7x7 board separated by walls.
 * A region belongs to player P iff it contains >= 1 piece of P and 0 pieces of other players.
 */
export function computeTerritories(state: WallGoState): TerritoryResult {
  const visited = createEmptyGrid(GRID_SIZE, GRID_SIZE, false);
  const cellOwner: (number | null)[][] = createEmptyGrid(GRID_SIZE, GRID_SIZE, null);
  const areas = Array(state.playerCount).fill(0);
  const maxSingle = Array(state.playerCount).fill(0);
  let allSeparated = true;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (visited[r][c]) continue;
      const queue: [number, number][] = [[r, c]];
      visited[r][c] = true;
      const cells: [number, number][] = [];
      const ownersInRegion = new Set<number>();

      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        cells.push([cr, cc]);
        const piece = state.pieces.find((p) => p.row === cr && p.col === cc);
        if (piece) ownersInRegion.add(piece.owner);

        for (const { dr, dc } of DIRS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
          if (visited[nr][nc]) continue;
          if (hasWallBetween(state.hWalls, state.vWalls, cr, cc, nr, nc)) continue;
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }

      if (ownersInRegion.size > 1) {
        allSeparated = false;
      } else if (ownersInRegion.size === 1) {
        const owner = Array.from(ownersInRegion)[0];
        areas[owner] += cells.length;
        if (cells.length > maxSingle[owner]) maxSingle[owner] = cells.length;
        for (const [cr, cc] of cells) {
          cellOwner[cr][cc] = owner;
        }
      }
    }
  }

  return { areas, maxSingle, cellOwner, allSeparated };
}
