export type WallGoMode = 'ai' | 'local' | 'online';
export type WallGoDifficulty = 'easy' | 'normal' | 'hard';
export type PieceShape = 'square' | 'circle';
export type WallDir = 'N' | 'S' | 'E' | 'W';

export interface WallGoPiece {
  id: string;
  owner: number;
  shape: PieceShape;
  row: number;
  col: number;
}

export interface WallGoPlayer {
  id: number;
  name: string;
  isAI: boolean;
  wallBreakLeft: number;
}

export interface WallEdge {
  type: 'h' | 'v';
  r: number;
  c: number;
}

export interface MoveTarget {
  row: number;
  col: number;
  brokenWall: WallEdge | null;
}

export interface TerritoryResult {
  areas: number[];
  maxSingle: number[];
  cellOwner: (number | null)[][];
  allSeparated: boolean;
}

export interface WallGoState {
  phase: 'setup' | 'move' | 'wall' | 'game_over';
  mode: WallGoMode;
  difficulty: WallGoDifficulty;
  playerCount: 2 | 3;
  players: WallGoPlayer[];
  currentPlayer: number;
  setupOrder: number[];
  setupStep: number;
  pieces: WallGoPiece[];
  hWalls: boolean[][]; // 6 x 7: between (r, c) and (r+1, c)
  vWalls: boolean[][]; // 7 x 6: between (r, c) and (r, c+1)
  selectedPieceId: string | null;
  movedPieceId: string | null;
  useWallBreak: boolean;
  turnCount: number;
  winner: number | null;
  logs: { id: number; text: string; player?: number }[];
}
