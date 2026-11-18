import React from 'react';
import { Crown, ScrollText, Shield, Swords } from 'lucide-react';
import { PROGRESS_TOKENS } from '../engine/cards';
import { GameState } from '../engine/types';

interface ConflictTrackProps {
  state: GameState;
}

export const ConflictTrack: React.FC<ConflictTrackProps> = ({ state }) => {
  const { conflictPosition, militaryTokensRemoved, boardProgressTokens, players } = state;
  // Track cells from -9 to +9 (19 steps)
  const steps = Array.from({ length: 19 }, (_, i) => i - 9);

  return (
    <div className="conflict-strip">
      {/* Military Conflict Track */}
      <div className="conflict-track-box">
        <div className="conflict-labels">
          <span className="p1-label">
            <Swords size={12} />
            <span>{players[1].name} 패권 (-9)</span>
          </span>
          <span className="center-label">
            군사력 균형{' '}
            <strong className="balance-num">
              {conflictPosition > 0 ? `+${conflictPosition}` : conflictPosition}
            </strong>
          </span>
          <span className="p0-label">
            <span>{players[0].name} 패권 (+9)</span>
            <Swords size={12} />
          </span>
        </div>

        <div className="conflict-cells">
          {steps.map((pos) => {
            const isPawn = conflictPosition === pos;
            const isSupremacy = Math.abs(pos) === 9;
            const isCenter = pos === 0;
            const isMilestone = Math.abs(pos) === 3 || Math.abs(pos) === 6;
            const sideClass = pos < 0 ? 'side-p1' : pos > 0 ? 'side-p0' : 'side-neutral';
            const zoneClass =
              pos <= -6 || pos >= 6
                ? 'zone-10'
                : pos <= -3 || pos >= 3
                  ? 'zone-5'
                  : pos !== 0
                    ? 'zone-2'
                    : 'zone-0';

            return (
              <div
                key={pos}
                className={`conflict-cell ${sideClass} ${zoneClass} ${isPawn ? 'has-pawn' : ''} ${
                  isSupremacy ? 'is-supremacy' : ''
                } ${isCenter ? 'is-center' : ''} ${isMilestone ? 'is-milestone' : ''}`}
                title={`위치 ${pos}`}
              >
                {isPawn ? (
                  <span className="conflict-pawn" title="분쟁 말">
                    <Shield size={14} strokeWidth={2.4} />
                  </span>
                ) : isSupremacy ? (
                  <Crown size={11} className="supremacy-icon" />
                ) : (
                  <span className="cell-num">{pos === 0 ? '0' : Math.abs(pos)}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="military-tokens-row">
          <div className="mil-tok-group">
            <span className={`mil-tok ${militaryTokensRemoved.p0_6 ? 'removed' : ''}`}>
              -5 🪙
            </span>
            <span className={`mil-tok ${militaryTokensRemoved.p0_3 ? 'removed' : ''}`}>
              -2 🪙
            </span>
          </div>
          <span className="mil-vp-hint">승점: 10 · 5 · 2 &nbsp;|&nbsp; 0 &nbsp;|&nbsp; 2 · 5 · 10</span>
          <div className="mil-tok-group">
            <span className={`mil-tok ${militaryTokensRemoved.p1_3 ? 'removed' : ''}`}>
              -2 🪙
            </span>
            <span className={`mil-tok ${militaryTokensRemoved.p1_6 ? 'removed' : ''}`}>
              -5 🪙
            </span>
          </div>
        </div>
      </div>

      {/* Board Progress Tokens */}
      <div className="progress-board-box">
        <div className="progress-board-title">
          <ScrollText size={13} />
          <span>진보 토큰</span>
          <span className="pb-count">{boardProgressTokens.length}</span>
        </div>
        <div className="progress-board-list">
          {boardProgressTokens.length === 0 ? (
            <span className="empty-hint">모든 진보 토큰이 획득되었습니다</span>
          ) : (
            boardProgressTokens.map((id) => {
              const pt = PROGRESS_TOKENS[id];
              return (
                <div key={id} className="progress-chip" title={pt.descriptionKo}>
                  <span className="pt-dot" />
                  <span className="pt-name">{pt.nameKo}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
