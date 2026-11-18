import { PyramidSlot } from './types';

interface RowSpec {
  faceUp: boolean;
  xs: number[];
}

const AGE_1_ROWS: RowSpec[] = [
  { faceUp: true, xs: [-1, 1] },
  { faceUp: false, xs: [-2, 0, 2] },
  { faceUp: true, xs: [-3, -1, 1, 3] },
  { faceUp: false, xs: [-4, -2, 0, 2, 4] },
  { faceUp: true, xs: [-5, -3, -1, 1, 3, 5] },
];

const AGE_2_ROWS: RowSpec[] = [
  { faceUp: true, xs: [-5, -3, -1, 1, 3, 5] },
  { faceUp: false, xs: [-4, -2, 0, 2, 4] },
  { faceUp: true, xs: [-3, -1, 1, 3] },
  { faceUp: false, xs: [-2, 0, 2] },
  { faceUp: true, xs: [-1, 1] },
];

const AGE_3_ROWS: RowSpec[] = [
  { faceUp: true, xs: [-1, 1] },
  { faceUp: false, xs: [-2, 0, 2] },
  { faceUp: true, xs: [-3, -1, 1, 3] },
  { faceUp: false, xs: [-2, 2] },
  { faceUp: true, xs: [-3, -1, 1, 3] },
  { faceUp: false, xs: [-2, 0, 2] },
  { faceUp: true, xs: [-1, 1] },
];

export function buildPyramid(age: 1 | 2 | 3, cardIds: string[]): PyramidSlot[] {
  const rows = age === 1 ? AGE_1_ROWS : age === 2 ? AGE_2_ROWS : AGE_3_ROWS;
  const slots: PyramidSlot[] = [];
  let idx = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.xs.length; c++) {
      slots.push({
        index: idx,
        row: r,
        col: c,
        x: row.xs[c],
        faceUp: row.faceUp,
        cardId: cardIds[idx] ?? null,
        blockedBy: [],
      });
      idx++;
    }
  }

  for (const slot of slots) {
    slot.blockedBy = slots
      .filter((other) => other.row === slot.row + 1 && Math.abs(other.x - slot.x) === 1)
      .map((other) => other.index);
  }

  return slots;
}

export function isSlotPlayable(pyramid: PyramidSlot[], index: number): boolean {
  const slot = pyramid[index];
  if (!slot || slot.cardId === null) return false;
  return slot.blockedBy.every((blockerIdx) => pyramid[blockerIdx]?.cardId === null);
}

export function revealExposedSlots(pyramid: PyramidSlot[]): PyramidSlot[] {
  return pyramid.map((slot) => {
    if (slot.cardId !== null && !slot.faceUp) {
      const unblocked = slot.blockedBy.every((b) => pyramid[b]?.cardId === null);
      if (unblocked) {
        return { ...slot, faceUp: true };
      }
    }
    return slot;
  });
}
