import React from 'react';
import {
  Bot,
  CheckCircle2,
  Coins,
  Crown,
  FlaskConical,
  Landmark,
  ScrollText,
  Sparkles,
  User,
} from 'lucide-react';
import { CARDS, PROGRESS_TOKENS, WONDERS } from '../engine/cards';
import {
  ALL_RESOURCES,
  getFixedProduction,
  getFlexibleProducers,
  getTradingDiscounts,
} from '../engine/cost';
import {
  calculateScore,
  getDistinctScienceCount,
  getScienceSymbolCounts,
} from '../engine/scoring';
import { CardColor, GameState, PlayerState, ResourceType, ScienceSymbol } from '../engine/types';
import { ResourceBadge, SCIENCE_META } from './Icons';
import { ScienceIcon, WonderArtwork } from './Illustrations';

interface PlayerPanelProps {
  state: GameState;
  player: PlayerState;
  isCurrentTurn: boolean;
  isOpponent?: boolean;
}

const COLOR_ORDER: CardColor[] = ['brown', 'grey', 'yellow', 'red', 'green', 'blue', 'purple'];
const COLOR_LABELS: Record<CardColor, string> = {
  brown: '원자재',
  grey: '제조품',
  yellow: '상업',
  red: '군사',
  green: '과학',
  blue: '시민',
  purple: '길드',
};

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  state,
  player,
  isCurrentTurn,
  isOpponent = false,
}) => {
  const fixed = getFixedProduction(player);
  const flex = getFlexibleProducers(player);
  const discounts = getTradingDiscounts(player);
  const sciCounts = getScienceSymbolCounts(player);
  const distinctSci = getDistinctScienceCount(player);
  const score = calculateScore(state, player.id);

  const activeSciSymbols = (Object.entries(sciCounts) as [ScienceSymbol, number][]).filter(
    ([, c]) => c > 0
  );

  return (
    <aside
      className={`player-panel ${isCurrentTurn ? 'is-active-turn' : ''} ${
        isOpponent ? 'is-opponent' : 'is-self'
      }`}
    >
      {/* Commander Header */}
      <div className="pp-header">
        <div className="pp-identity">
          <div className={`pp-avatar-badge ${isCurrentTurn ? 'active' : ''}`}>
            {player.isAI ? (
              <Bot size={18} />
            ) : isOpponent ? (
              <User size={18} />
            ) : (
              <Crown size={18} />
            )}
          </div>
          <div className="pp-id-text">
            <div className="pp-name">
              <span>{player.name}</span>
              {isCurrentTurn && (
                <span className="turn-pill">
                  <span className="pulse-dot" />
                  진행 중
                </span>
              )}
            </div>
            <div className="pp-stats-row">
              <span className="pp-stat-chip vp" title="예상 승점">
                <Sparkles size={11} />
                <strong>{score.total}</strong>점
              </span>
              <span className="pp-stat-chip sci" title="서로 다른 과학 상징 (6개 시 승리)">
                <FlaskConical size={11} />
                <strong>{distinctSci}/6</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="pp-coins" title="보유 코인">
          <Coins size={15} className="coin-lucide" />
          <span>{player.coins}</span>
        </div>
      </div>

      {/* Resources */}
      <div className="pp-section">
        <div className="pp-sec-title">생산 자원 & 무역 할인</div>
        <div className="pp-resources">
          {ALL_RESOURCES.map((r) => (
            <div key={r} className={`pp-res-item ${fixed[r] === 0 ? 'is-zero' : ''}`}>
              <ResourceBadge type={r} />
              <span className="pp-res-cnt">{fixed[r]}</span>
              {discounts.has(r) && (
                <span className="discount-tag" title="무역 비용 1코인 고정">
                  1G
                </span>
              )}
            </div>
          ))}
          {flex.map((opts, idx) => (
            <div key={idx} className="pp-flex-item" title="매 턴 택1 생산">
              {opts.map((r, i) => (
                <React.Fragment key={r}>
                  {i > 0 && <span className="flex-slash">/</span>}
                  <ResourceBadge type={r} size="sm" />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Science & Progress Tokens */}
      {(activeSciSymbols.length > 0 || player.progressTokens.length > 0) && (
        <div className="pp-section">
          <div className="pp-sec-title">과학 & 진보 토큰</div>
          <div className="pp-sci-row">
            {activeSciSymbols.map(([sym, count]) => (
              <span
                key={sym}
                className={`sci-pill ${count >= 2 ? 'is-pair' : ''}`}
                title={SCIENCE_META[sym].labelKo}
              >
                <ScienceIcon symbol={sym} size={16} />
                {count > 1 ? `×${count}` : ''}
              </span>
            ))}
            {player.progressTokens.map((ptId) => {
              const pt = PROGRESS_TOKENS[ptId];
              return (
                <span key={ptId} className="pt-owned-pill" title={pt.descriptionKo}>
                  <ScrollText size={11} />
                  {pt.nameKo}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Wonders */}
      <div className="pp-section">
        <div className="pp-sec-title">
          <span className="sec-title-left">
            <Landmark size={12} />
            불가사의
          </span>
          <span className="sec-count">
            {player.wonders.filter((w) => w.built).length}/{player.wonders.length}
          </span>
        </div>
        <div className="pp-wonders-grid">
          {player.wonders.map((w) => {
            const def = WONDERS[w.wonderId];
            if (!def) return null;
            const costEntries = Object.entries(def.cost) as [ResourceType, number][];
            return (
              <div
                key={w.wonderId}
                className={`wonder-mini ${w.built ? 'is-built' : 'is-unbuilt'}`}
                title={def.descriptionKo}
              >
                <div className="wm-art-banner">
                  <WonderArtwork wonderId={w.wonderId} compact />
                  <span className={`wm-status-overlay ${w.built ? 'built' : ''}`}>
                    {w.built ? (
                      <>
                        <CheckCircle2 size={10} />
                        완공
                      </>
                    ) : (
                      '미완공'
                    )}
                  </span>
                </div>
                <div className="wm-content">
                  <div className="wm-top">
                    <span className="wm-name">{def.nameKo}</span>
                  </div>
                  {!w.built && (
                    <div className="wm-cost">
                      {costEntries.map(([r, c]) => (
                        <ResourceBadge key={r} type={r} count={c} />
                      ))}
                    </div>
                  )}
                  <div className="wm-desc">{def.descriptionKo}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Built Cards by Color */}
      <div className="pp-section">
        <div className="pp-sec-title">
          <span>건설된 건물</span>
          <span className="sec-count">{player.cards.length}장</span>
        </div>
        <div className="pp-cards-summary">
          {COLOR_ORDER.map((color) => {
            const group = player.cards
              .map((id) => CARDS[id])
              .filter((c) => c && c.color === color);
            if (group.length === 0) return null;
            return (
              <div key={color} className={`card-stack stack-${color}`}>
                <span className="stack-label">
                  {COLOR_LABELS[color]} <em>{group.length}</em>
                </span>
                <div className="stack-names">
                  {group.map((c, i) => (
                    <span key={`${c.id}-${i}`} className="stack-chip">
                      {c.nameKo}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {player.cards.length === 0 && (
            <span className="empty-hint">아직 건설된 건물이 없습니다.</span>
          )}
        </div>
      </div>
    </aside>
  );
};
