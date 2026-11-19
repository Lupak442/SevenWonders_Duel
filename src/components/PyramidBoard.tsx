import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
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

const STAGE_WIDTH = 560;

export const PyramidBoard: React.FC<PyramidBoardProps> = ({
  state,
  canInteract,
  onSelectSlot,
}) => {
  const { pyramid, age, players, currentPlayer } = state;
  const player = players[currentPlayer];
  const opponent = players[currentPlayer === 0 ? 1 : 0];
  const maxRow = age === 3 ? 6 : 4;
  const stageHeight = age === 3 ? 448 : 400;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  useEffect(() => {
    const updateFit = () => {
      if (!wrapperRef.current) return;
      const avail = wrapperRef.current.clientWidth;
      if (avail > 0 && avail < STAGE_WIDTH) {
        setFitScale(Math.max(0.48, (avail - 8) / STAGE_WIDTH));
      } else {
        setFitScale(1);
      }
    };
    updateFit();
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, []);

  const effectiveScale = Math.min(1.5, Math.max(0.45, fitScale * userZoom));

  const getTouchDist = (t: React.TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        startDist: getTouchDist(e.touches),
        startZoom: userZoom,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = getTouchDist(e.touches);
      const ratio = dist / Math.max(1, pinchRef.current.startDist);
      const next = Math.min(1.8, Math.max(0.75, pinchRef.current.startZoom * ratio));
      setUserZoom(next);
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  return (
    <div className="pyramid-container">
      <div className="pyramid-zoom-controls">
        <button
          type="button"
          className="zoom-btn"
          title="축소"
          onClick={() => setUserZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          className="zoom-btn zoom-reset"
          title="화면 맞춤"
          onClick={() => setUserZoom(1)}
        >
          <Maximize2 size={11} />
          <span>{Math.round(effectiveScale * 100)}%</span>
        </button>
        <button
          type="button"
          className="zoom-btn"
          title="확대"
          onClick={() => setUserZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
        >
          <ZoomIn size={13} />
        </button>
      </div>

      <div
        ref={wrapperRef}
        className={`pyramid-wrapper age-${age}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="pyramid-scale-box"
          style={{
            width: `${STAGE_WIDTH * effectiveScale}px`,
            height: `${stageHeight * effectiveScale}px`,
            margin: '0 auto',
          }}
        >
          <div
            className="pyramid-stage"
            style={{
              ['--rows' as string]: maxRow + 1,
              width: `${STAGE_WIDTH}px`,
              height: `${stageHeight}px`,
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
            }}
          >
            {pyramid.map((slot) => {
              if (slot.cardId === null) return null;
              const playable = canInteract && isSlotPlayable(pyramid, slot.index);
              const blocked = !isSlotPlayable(pyramid, slot.index);
              const card = CARDS[slot.cardId];

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
      </div>
    </div>
  );
};
