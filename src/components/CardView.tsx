import React from 'react';
import { CardDef, ResourceType } from '../engine/types';
import { CostResult } from '../engine/cost';
import {
  CHAIN_LABELS,
  CoinIcon,
  ResourceBadge,
  SCIENCE_META,
  ShieldIcon,
  VPIcon,
} from './Icons';
import { ScienceIcon } from './Illustrations';

interface CardViewProps {
  card: CardDef;
  playable?: boolean;
  blocked?: boolean;
  costInfo?: CostResult;
  onClick?: () => void;
  compact?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  playable = false,
  blocked = false,
  costInfo,
  onClick,
  compact = false,
}) => {
  const resEntries = Object.entries(card.cost.resources ?? {}) as [
    ResourceType,
    number,
  ][];
  const prodEntries = Object.entries(card.produces ?? {}) as [
    ResourceType,
    number,
  ][];

  return (
    <button
      type="button"
      onClick={playable ? onClick : undefined}
      disabled={!playable && !onClick}
      className={`game-card color-${card.color} ${playable ? 'is-playable' : ''} ${
        blocked ? 'is-blocked' : ''
      } ${compact ? 'is-compact' : ''}`}
    >
      {/* Top Color Header */}
      <div className="card-header">
        <span className="card-title" title={card.nameKo}>
          {card.nameKo}
        </span>
        {costInfo && playable && (
          <span
            className={`card-cost-pill ${
              costInfo.freeByChain
                ? 'pill-free'
                : costInfo.canAfford
                  ? 'pill-ok'
                  : 'pill-no'
            }`}
          >
            {costInfo.freeByChain
              ? '연쇄'
              : costInfo.totalCoins === 0
                ? '무료'
                : costInfo.totalCoins}
          </span>
        )}
      </div>

      {/* Illustrated Artwork Window */}
      <div className="card-art-window">
        <img
          src={`/assets/cards/${card.color}.jpg`}
          alt=""
          className="card-art-img"
          loading="lazy"
        />
        <div className="card-art-vignette" aria-hidden="true" />
        {(card.cost.coins || resEntries.length > 0) && (
          <div className="card-cost-strip">
            {card.cost.coins && (
              <span className="coin-cost">
                {card.cost.coins}
                <CoinIcon size={9} />
              </span>
            )}
            {resEntries.map(([r, cnt]) => (
              <ResourceBadge key={r} type={r} count={cnt} />
            ))}
          </div>
        )}
      </div>

      {/* Reward / Effect Strip */}
      <div className="card-body">
        <div className="card-reward">
          {prodEntries.map(([r, cnt]) => (
            <ResourceBadge key={r} type={r} count={cnt} size="md" />
          ))}

          {card.flexibleProduces && (
            <div className="flex-prod">
              {card.flexibleProduces.map((r, i) => (
                <React.Fragment key={r}>
                  {i > 0 && <span className="slash">/</span>}
                  <ResourceBadge type={r} size="sm" />
                </React.Fragment>
              ))}
            </div>
          )}

          {card.tradingDiscount && (
            <div className="trade-discount">
              <span className="td-coin">
                1<CoinIcon size={10} />:
              </span>
              {card.tradingDiscount.map((r) => (
                <ResourceBadge key={r} type={r} size="sm" />
              ))}
            </div>
          )}

          {card.vp !== undefined && (
            <span className="vp-badge">
              <VPIcon size={14} />
              <span>{card.vp}</span>
            </span>
          )}

          {card.shields !== undefined && (
            <span className="shield-badge">
              {Array.from({ length: card.shields }).map((_, i) => (
                <ShieldIcon key={i} size={13} />
              ))}
            </span>
          )}

          {card.science && (
            <span className="science-badge" title={SCIENCE_META[card.science].labelKo}>
              <ScienceIcon symbol={card.science} size={22} />
            </span>
          )}

          {card.coins !== undefined && (
            <span className="coin-gain-badge">
              +{card.coins}
              <CoinIcon size={12} />
            </span>
          )}

          {card.coinsPerCard && (
            <span className="special-badge">
              +{card.coinsPerCard.amount}
              <CoinIcon size={10} />
              /장
            </span>
          )}

          {card.guildVp && (
            <span className="special-badge">
              {card.guildVp.type === 'mostWonders'
                ? `불가사의 +${card.guildVp.vpPer}점`
                : card.guildVp.type === 'coins'
                  ? `3코인당 +${card.guildVp.vpPer}점`
                  : card.guildVp.colors?.includes('yellow')
                    ? `노랑 +${card.guildVp.vpPer}점`
                    : card.guildVp.colors?.includes('blue')
                      ? `파랑 +${card.guildVp.vpPer}점`
                      : card.guildVp.colors?.includes('green')
                        ? `초록 +${card.guildVp.vpPer}점`
                        : card.guildVp.colors?.includes('red')
                          ? `빨강 +${card.guildVp.vpPer}점`
                          : `자원 +${card.guildVp.vpPer}점`}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Chain symbols */}
      {(card.chainFrom || card.chainTo) && (
        <div className="card-footer">
          {card.chainFrom ? (
            <span className="chain-in" title="이 상징이 있으면 무료 건설">
              🔗 {CHAIN_LABELS[card.chainFrom]}
            </span>
          ) : (
            <span />
          )}
          {card.chainTo && (
            <span className="chain-out" title="다음 시대 무료 연쇄 제공">
              {CHAIN_LABELS[card.chainTo]} ➡
            </span>
          )}
        </div>
      )}
    </button>
  );
};
