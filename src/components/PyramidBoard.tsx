import React from 'react';
import { CARDS } from '../engine/cards';
import { getCardBuildCost } from '../engine/cost';
import { isSlotPlayable } from '../engine/pyramids';
import { GameState } from '../engine/types';
import { CardView } from './CardView';

interface PyramidBoardProps {
  state: GameState;
  canInteract: boolean;
  onSelectSlot: (slotIndex: number) => void;
}

export const PyramidBoard: React.FC<PyramidBoardProps> = ({
  state,
  canInteract,
  onSelectSlot,
}) => {
  const { pyramid, age, players, currentPlayer } = state;
  const player = players[currentPlayer];
  const opponent = players[currentPlayer === 0 ? 1 : 0];
  const maxRow = age === 3 ? 6 : 4;

  return (
    <div className={`pyramid-wrapper age-${age}`}>
      <div className="pyramid-stage" style={{ ['--rows' as string]: maxRow + 1 }}>
        {pyramid.map((slot) => {
          if (slot.cardId === null) return null;
          const playable = canInteract && isSlotPlayable(pyramid, slot.index);
          const blocked = !isSlotPlayable(pyramid, slot.index);
          const card = CARDS[slot.cardId];

          // x is in half-card units (-5..+5). Convert to percentage offset from center:
          // Total width = 6 cards -> 12 half-card units.
          const leftPct = 50 + slot.x * 8.1;
          const topPx = slot.row * (age === 3 ? 52 : 66);

          return (
            <div
              key={slot.index}
              className="pyramid-slot"
              style={{
                left: `${leftPct}%`,
                top: `${topPx}px`,
                zIndex: slot.row * 10 + (playable ? 5 : 0),
              }}
            >
              {slot.faceUp && card ? (
                <CardView
                  card={card}
                  playable={playable}
                  blocked={blocked}
                  costInfo={
                    playable ? getCardBuildCost(player, opponent, card) : undefined
                  }
                  onClick={() => onSelectSlot(slot.index)}
                />
              ) : (
                <div className={`card-back age-back-${age}`}>
                  <div className="card-back-inner">
                    <span className="age-roman">
                      {age === 1 ? 'I' : age === 2 ? 'II' : 'III'}
                    </span>
                    <span className="age-sub">시대</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
