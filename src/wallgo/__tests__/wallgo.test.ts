import { describe, expect, it } from 'vitest';
import {
  computeTerritories,
  createInitialWallGoState,
  getValidMoves,
  movePiece,
  placeInitialPiece,
  placeWall,
} from '../engine';

describe('Wall Go 2 Engine', () => {
  it('initializes 2-player and 3-player modes with correct setup order and wallBreakLeft', () => {
    const s2 = createInitialWallGoState({ mode: 'local', playerCount: 2 });
    expect(s2.phase).toBe('setup');
    expect(s2.pieces).toHaveLength(4); // 2 Circle pieces per player pre-placed symmetrically
    expect(s2.setupOrder).toEqual([0, 1, 1, 0]);
    expect(s2.players[0].wallBreakLeft).toBe(0);

    const s3 = createInitialWallGoState({ mode: 'local', playerCount: 3 });
    expect(s3.pieces).toHaveLength(0);
    expect(s3.setupOrder).toEqual([0, 1, 2, 2, 1, 0]);
    expect(s3.players[0].wallBreakLeft).toBe(1);
    expect(s3.players[2].wallBreakLeft).toBe(1);
  });

  it('enforces straight-only moves for Square and allows 90-degree bend for Circle', () => {
    let s = createInitialWallGoState({ mode: 'local', playerCount: 3 });
    // Place 6 pieces: P0(sq at 3,3), P1(sq at 0,0), P2(sq at 0,6), P2(cir at 6,6), P1(cir at 6,0), P0(cir at 3,4)
    s = placeInitialPiece(s, 3, 3); // P0 square
    s = placeInitialPiece(s, 0, 0); // P1 square
    s = placeInitialPiece(s, 0, 6); // P2 square
    s = placeInitialPiece(s, 6, 6); // P2 circle
    s = placeInitialPiece(s, 6, 0); // P1 circle
    s = placeInitialPiece(s, 3, 4); // P0 circle
    expect(s.phase).toBe('move');

    const p0Sq = s.pieces.find((p) => p.owner === 0 && p.shape === 'square')!;
    const sqMoves = getValidMoves(s, p0Sq.id, false);
    // Square at (3,3) cannot bend to (2,4)
    expect(sqMoves.some((m) => m.row === 2 && m.col === 4)).toBe(false);
    // Square at (3,3) can go straight to (1,3)
    expect(sqMoves.some((m) => m.row === 1 && m.col === 3)).toBe(true);

    const p0Cir = s.pieces.find((p) => p.owner === 0 && p.shape === 'circle')!;
    const cirMoves = getValidMoves(s, p0Cir.id, false);
    // Circle at (3,4) can bend to (2,5)
    expect(cirMoves.some((m) => m.row === 2 && m.col === 5)).toBe(true);
  });

  it('supports Wall Break in 3-player mode and separates territories cleanly', () => {
    let s = createInitialWallGoState({ mode: 'local', playerCount: 3 });
    s = placeInitialPiece(s, 0, 0);
    s = placeInitialPiece(s, 6, 6);
    s = placeInitialPiece(s, 0, 6);
    s = placeInitialPiece(s, 1, 6);
    s = placeInitialPiece(s, 5, 6);
    s = placeInitialPiece(s, 1, 0);

    // Move P0 square at (0,0) stay in place, place wall (h, 0, 0)
    const p0Sq = s.pieces.find((p) => p.owner === 0 && p.shape === 'square')!;
    s = movePiece(s, p0Sq.id, 0, 0);
    expect(s.phase).toBe('wall');
    s = placeWall(s, { type: 'h', r: 0, c: 0 });
    expect(s.hWalls[0][0]).toBe(0);
    expect(s.currentPlayer).toBe(1);

    const terr = computeTerritories(s);
    expect(terr.allSeparated).toBe(false);
  });
});
