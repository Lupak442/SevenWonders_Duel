import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Coins,
  Copy,
  FlaskConical,
  Hammer,
  Home,
  Link2,
  RotateCcw,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { CARDS, PROGRESS_TOKENS, WONDERS } from '../engine/cards';
import { getCardBuildCost, getWonderBuildCost } from '../engine/cost';
import { calculateScore } from '../engine/scoring';
import { GameState, ResourceType } from '../engine/types';
import { CardView } from './CardView';
import { CHAIN_LABELS, ResourceBadge } from './Icons';
import { WonderArtwork } from './Illustrations';

interface CardActionModalProps {
  state: GameState;
  slotIndex: number;
  onBuildCard: () => void;
  onDiscardCard: () => void;
  onBuildWonder: (wonderId: string) => void;
  onClose: () => void;
}

export const CardActionModal: React.FC<CardActionModalProps> = ({
  state,
  slotIndex,
  onBuildCard,
  onDiscardCard,
  onBuildWonder,
  onClose,
}) => {
  const slot = state.pyramid[slotIndex];
  const card = slot?.cardId ? CARDS[slot.cardId] : null;
  if (!card) return null;

  const pIdx = state.currentPlayer;
  const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
  const player = state.players[pIdx];
  const opponent = state.players[oppIdx];

  const cardCost = getCardBuildCost(player, opponent, card);
  const yellowCount = player.cards.filter((id) => CARDS[id]?.color === 'yellow').length;
  const discardCoins = 2 + yellowCount;
  const unbuiltWonders = player.wonders.filter((w) => !w.built);
  const wonderLimitReached = state.totalWondersBuilt >= 7;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card action-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>카드 행동 선택</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="action-preview">
          <CardView card={card} costInfo={cardCost} playable />
        </div>

        {/* Detailed live effect box for Yellow (Gold) commercial cards */}
        {!card.guildVp &&
          (card.coinsPerCard || card.tradingDiscount || card.flexibleProduces) &&
          (() => {
            const colorKo = (c: string) =>
              c === 'yellow'
                ? '노란색'
                : c === 'blue'
                  ? '파란색'
                  : c === 'green'
                    ? '초록색'
                    : c === 'red'
                      ? '빨간색'
                      : c === 'brown'
                        ? '갈색'
                        : '회색';

            if (card.coinsPerCard) {
              const { colors, amount, includeWonders } = card.coinsPerCard;
              const matchCount = includeWonders
                ? player.wonders.filter((w) => w.built).length
                : player.cards.filter((id) => colors.includes(CARDS[id]?.color)).length;
              const totalGain = matchCount * amount;
              const targetLabel = includeWonders
                ? '완공된 내 불가사의'
                : `내 [${colors.map(colorKo).join(' + ')}] 카드`;
              return (
                <div className="action-effect-desc desc-yellow">
                  <div>
                    <strong>금색 상업 효과:</strong> 코인을 내는 것이 아니라, 건설 시{' '}
                    <strong>{targetLabel}</strong> 1개당 <strong>+{amount}코인</strong>을 즉시 획득
                    {card.vp ? ` + 종료 시 승점 ${card.vp}점!` : '!'}
                  </div>
                  <div className="aed-live">
                    현재 {targetLabel} {matchCount}개 → 지금 지으면 즉시 +{totalGain}코인
                    {card.vp ? ` · 승점 +${card.vp}점` : ''}
                  </div>
                </div>
              );
            }

            if (card.tradingDiscount) {
              return (
                <div className="action-effect-desc desc-yellow">
                  <strong>무역 할인 효과:</strong> 이후 해당 자원이 부족할 때 상대 생산량과 상관없이{' '}
                  <strong>무조건 1코인</strong>으로 사옵니다!
                </div>
              );
            }

            if (card.flexibleProduces) {
              return (
                <div className="action-effect-desc desc-yellow">
                  <strong>자유 자원 생산:</strong> 매 턴 표시된 자원 중 원하는 1개를 무료로 생산합니다!
                </div>
              );
            }
            return null;
          })()}

        {card.guildVp && (() => {
          let desc = '';
          let preview = '';
          if (card.guildVp.type === 'mostWonders') {
            const pW = player.wonders.filter((w) => w.built).length;
            const oW = opponent.wonders.filter((w) => w.built).length;
            const best = Math.max(pW, oW);
            desc = `나와 상대 중 완공된 불가사의가 더 많은 쪽 개수 × ${card.guildVp.vpPer}점`;
            preview = `현재 나 ${pW}개 vs 상대 ${oW}개 → 지금 지으면 예상 +${best * card.guildVp.vpPer}점`;
          } else if (card.guildVp.type === 'coins') {
            const maxC = Math.max(player.coins, opponent.coins);
            const pts = Math.floor(maxC / 3) * card.guildVp.vpPer;
            desc = `코인을 내는 것이 아니라, 게임 종료 시 나와 상대 중 보유 코인이 더 많은 쪽의 3코인마다 +${card.guildVp.vpPer}점!`;
            preview = `현재 나 ${player.coins}코인 vs 상대 ${opponent.coins}코인 → 최고 ${maxC}코인 기준 예상 +${pts}점`;
          } else {
            const colors = card.guildVp.colors ?? [];
            const pC = player.cards.filter((id) => colors.includes(CARDS[id]?.color)).length;
            const oC = opponent.cards.filter((id) => colors.includes(CARDS[id]?.color)).length;
            const best = Math.max(pC, oC);
            const colorLabel = colors
              .map((c) =>
                c === 'yellow'
                  ? '노란색'
                  : c === 'blue'
                    ? '파란색'
                    : c === 'green'
                      ? '초록색'
                      : c === 'red'
                        ? '빨간색'
                        : c === 'brown'
                          ? '갈색'
                          : '회색'
              )
              .join(' + ');
            desc = `나와 상대 중 [${colorLabel}] 카드를 더 많이 가진 쪽 장수만큼 즉시 +1코인 & 종료 시 +${card.guildVp.vpPer}점`;
            preview = `현재 나 ${pC}장 vs 상대 ${oC}장 → 지금 지으면 즉시 +${best}코인 · 예상 +${best * card.guildVp.vpPer}점`;
          }
          return (
            <div className="action-effect-desc">
              <div>
                <strong>길드 효과:</strong> {desc}
              </div>
              <div className="aed-live">{preview}</div>
            </div>
          );
        })()}

        <div className="action-buttons-col">
          {/* 1. Build Building */}
          <button
            type="button"
            className="action-btn btn-build"
            disabled={!cardCost.canAfford}
            onClick={onBuildCard}
          >
            <div className="ab-main">
              <span className="ab-title-icon">
                <Hammer size={15} />
                건물 건설하기
              </span>
              <span className="ab-cost">
                {cardCost.freeByChain
                  ? '연쇄 무료!'
                  : cardCost.totalCoins === 0
                    ? '무료'
                    : `${cardCost.totalCoins} 코인`}
              </span>
            </div>
            {!cardCost.canAfford && (
              <div className="ab-sub">
                코인이 부족합니다 (보유 {player.coins} / 필요 {cardCost.totalCoins})
              </div>
            )}
            {cardCost.canAfford && cardCost.tradeCoins > 0 && (
              <div className="ab-sub">
                기본 {cardCost.baseCoins} + 자원 무역 {cardCost.tradeCoins} 코인
              </div>
            )}
          </button>

          {/* 2. Discard for Coins */}
          <button type="button" className="action-btn btn-discard" onClick={onDiscardCard}>
            <div className="ab-main">
              <span className="ab-title-icon">
                <Coins size={15} />
                버리고 코인 획득
              </span>
              <span className="ab-cost">+{discardCoins} 코인</span>
            </div>
            <div className="ab-sub">기본 2 + 노란색 카드 {yellowCount}장</div>
          </button>

          {/* 3. Build Wonder */}
          <div className="wonder-actions-box">
            <div className="wa-title">
              ✨ 불가사의 건설 ({state.totalWondersBuilt}/7 완공됨)
            </div>
            {wonderLimitReached ? (
              <div className="wa-limit">
                이미 7개의 불가사의가 완공되어 더 이상 지을 수 없습니다.
              </div>
            ) : (
              <div className="wa-list">
                {unbuiltWonders.map((w) => {
                  const def = WONDERS[w.wonderId];
                  if (!def) return null;
                  const wCost = getWonderBuildCost(player, opponent, def);
                  const reqs = Object.entries(def.cost) as [ResourceType, number][];
                  return (
                    <button
                      key={w.wonderId}
                      className="wonder-build-btn"
                      disabled={!wCost.canAfford}
                      onClick={() => onBuildWonder(w.wonderId)}
                    >
                      <div className="wb-top">
                        <strong>{def.nameKo}</strong>
                        <span className={wCost.canAfford ? 'cost-ok' : 'cost-no'}>
                          {wCost.totalCoins === 0 ? '무료' : `${wCost.totalCoins}🪙`}
                        </span>
                      </div>
                      <div className="wb-reqs">
                        {reqs.map(([r, c]) => (
                          <ResourceBadge key={r} type={r} count={c} />
                        ))}
                      </div>
                      <div className="wb-desc">{def.descriptionKo}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const WonderDraftModal: React.FC<{
  state: GameState;
  canInteract: boolean;
  onPickWonder: (wonderId: string) => void;
}> = ({ state, canInteract, onPickWonder }) => {
  const picker = state.players[state.currentPlayer];

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide-modal">
        <div className="modal-header">
          <div>
            <h3>🏛️ 불가사의 드래프트 ({state.wonderDraft.round}/2 라운드)</h3>
            <p className="modal-sub">
              {canInteract
                ? `${picker.name} 차례: 건설할 불가사의를 선택하세요.`
                : `${picker.name}이(가) 불가사의를 고르는 중...`}
            </p>
          </div>
        </div>

        <div className="draft-grid">
          {state.wonderDraft.pool.map((wId) => {
            const def = WONDERS[wId];
            if (!def) return null;
            const reqs = Object.entries(def.cost) as [ResourceType, number][];
            return (
              <button
                type="button"
                key={wId}
                className="draft-wonder-card"
                disabled={!canInteract}
                onClick={() => onPickWonder(wId)}
              >
                <div className="dw-art-wrap">
                  <WonderArtwork wonderId={wId} />
                </div>
                <div className="dw-body">
                  <div className="dw-title">{def.nameKo}</div>
                  <div className="dw-en">{def.name}</div>
                  <div className="dw-cost">
                    {reqs.map(([r, c]) => (
                      <ResourceBadge key={r} type={r} count={c} size="md" />
                    ))}
                  </div>
                  <div className="dw-desc">{def.descriptionKo}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="draft-picked-summary">
          {state.players.map((p) => (
            <div key={p.id} className="dps-col">
              <strong>{p.name} 선택:</strong>{' '}
              {p.wonders.length === 0
                ? '없음'
                : p.wonders.map((w) => WONDERS[w.wonderId]?.nameKo).join(', ')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ProgressTokenModal: React.FC<{
  title: string;
  subtitle: string;
  tokenIds: string[];
  canInteract: boolean;
  onPick: (tokenId: string) => void;
}> = ({ title, subtitle, tokenIds, canInteract, onPick }) => (
  <div className="modal-backdrop">
    <div className="modal-card">
      <div className="modal-header">
        <div>
          <h3>{title}</h3>
          <p className="modal-sub">{subtitle}</p>
        </div>
      </div>
      <div className="token-pick-grid">
        {tokenIds.map((id) => {
          const pt = PROGRESS_TOKENS[id];
          return (
            <button
              key={id}
              className="token-pick-btn"
              disabled={!canInteract}
              onClick={() => onPick(id)}
            >
              <div className="tp-name">📜 {pt.nameKo}</div>
              <div className="tp-desc">{pt.descriptionKo}</div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export const DestroyCardModal: React.FC<{
  state: GameState;
  canInteract: boolean;
  onDestroy: (cardId: string) => void;
}> = ({ state, canInteract, onDestroy }) => {
  const opp = state.players[state.currentPlayer === 0 ? 1 : 0];
  const color = state.pendingDestroyColor;
  const targets = opp.cards.filter((id) => CARDS[id]?.color === color);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h3>💥 상대 건물 파괴</h3>
            <p className="modal-sub">
              파괴할 상대의 {color === 'brown' ? '갈색(원자재)' : '회색(제조품)'} 카드를 선택하세요.
            </p>
          </div>
        </div>
        <div className="cards-pick-grid">
          {targets.map((cid, idx) => (
            <CardView
              key={`${cid}-${idx}`}
              card={CARDS[cid]}
              playable={canInteract}
              onClick={() => onDestroy(cid)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const BuildDiscardModal: React.FC<{
  state: GameState;
  canInteract: boolean;
  onBuild: (cardId: string) => void;
}> = ({ state, canInteract, onBuild }) => (
  <div className="modal-backdrop">
    <div className="modal-card wide-modal">
      <div className="modal-header">
        <div>
          <h3>🏺 마우솔로스 영묘 — 버려진 카드 무료 건설</h3>
          <p className="modal-sub">버려진 카드 더미에서 1장을 선택해 무료로 건설하세요.</p>
        </div>
      </div>
      <div className="cards-pick-grid">
        {state.discardPile.map((cid, idx) => (
          <CardView
            key={`${cid}-${idx}`}
            card={CARDS[cid]}
            playable={canInteract}
            onClick={() => onBuild(cid)}
          />
        ))}
      </div>
    </div>
  </div>
);

export const AgeStarterModal: React.FC<{
  state: GameState;
  canInteract: boolean;
  onChoose: (starter: 0 | 1) => void;
}> = ({ state, canInteract, onChoose }) => {
  const chooser = state.players[state.currentPlayer];
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h3>⏳ 제{state.age}시대 선공 선택</h3>
            <p className="modal-sub">
              군사력이 약한 {chooser.name}이(가) 제{state.age}시대의 선공을 결정합니다.
            </p>
          </div>
        </div>
        <div className="starter-btn-row">
          <button
            className="action-btn btn-build"
            disabled={!canInteract}
            onClick={() => onChoose(0)}
          >
            👑 {state.players[0].name} 선공
          </button>
          <button
            className="action-btn btn-build"
            disabled={!canInteract}
            onClick={() => onChoose(1)}
          >
            {state.players[1].isAI ? '🤖' : '👤'} {state.players[1].name} 선공
          </button>
        </div>
      </div>
    </div>
  );
};

export const GameOverModal: React.FC<{
  state: GameState;
  onRestart: () => void;
  onBackToLobby: () => void;
}> = ({ state, onRestart, onBackToLobby }) => {
  const [showDetails, setShowDetails] = useState(false);
  const s0 = calculateScore(state, 0);
  const s1 = calculateScore(state, 1);

  const getPlayerScoreItems = (pIdx: 0 | 1) => {
    const p = state.players[pIdx];
    const opp = state.players[pIdx === 0 ? 1 : 0];
    const items: { cat: string; name: string; pts: number }[] = [];

    for (const cid of p.cards) {
      const c = CARDS[cid];
      if (!c) continue;
      if (c.vp && (c.color === 'blue' || c.color === 'green' || c.color === 'yellow')) {
        items.push({
          cat: c.color === 'blue' ? '파랑' : c.color === 'green' ? '초록' : '노랑',
          name: c.nameKo,
          pts: c.vp,
        });
      } else if (c.color === 'purple' && c.guildVp) {
        let pts = 0;
        if (c.guildVp.type === 'mostColor' && c.guildVp.colors) {
          const cols = c.guildVp.colors;
          const pc = p.cards.filter((id) => cols.includes(CARDS[id]?.color)).length;
          const oc = opp.cards.filter((id) => cols.includes(CARDS[id]?.color)).length;
          pts = Math.max(pc, oc) * c.guildVp.vpPer;
        } else if (c.guildVp.type === 'mostWonders') {
          const pw = p.wonders.filter((w) => w.built).length;
          const ow = opp.wonders.filter((w) => w.built).length;
          pts = Math.max(pw, ow) * c.guildVp.vpPer;
        } else if (c.guildVp.type === 'coins') {
          pts = Math.floor(Math.max(p.coins, opp.coins) / 3) * c.guildVp.vpPer;
        }
        items.push({ cat: '길드', name: c.nameKo, pts });
      }
    }

    for (const w of p.wonders) {
      if (w.built) {
        const wd = WONDERS[w.wonderId];
        if (wd?.vp) items.push({ cat: '불가사의', name: wd.nameKo, pts: wd.vp });
      }
    }

    for (const ptId of p.progressTokens) {
      const pt = PROGRESS_TOKENS[ptId];
      const pts =
        ptId === 'pt_agriculture'
          ? 4
          : ptId === 'pt_philosophy'
            ? 7
            : ptId === 'pt_mathematics'
              ? 3 * p.progressTokens.length
              : 0;
      if (pts > 0 && pt) items.push({ cat: '진보', name: pt.nameKo, pts });
    }

    const sc = pIdx === 0 ? s0 : s1;
    if (sc.military > 0) items.push({ cat: '군사', name: '군사력 트랙', pts: sc.military });
    if (sc.coins > 0) items.push({ cat: '코인', name: `${p.coins}코인 (÷3)`, pts: sc.coins });
    return items;
  };

  const victoryTitle =
    state.victoryType === 'military'
      ? '⚔️ 군사적 패권 승리!'
      : state.victoryType === 'scientific'
        ? '🔬 과학적 패권 승리!'
        : '🏛️ 시민 점수 승리!';

  const winnerName =
    state.winner !== null ? state.players[state.winner].name : '무승부';

  const rows: { label: string; k: keyof typeof s0 }[] = [
    { label: '시민 건물 (파랑)', k: 'blue' },
    { label: '과학 건물 (초록)', k: 'green' },
    { label: '상업 건물 (노랑)', k: 'yellow' },
    { label: '길드 (보라)', k: 'purple' },
    { label: '불가사의', k: 'wonders' },
    { label: '진보 토큰', k: 'progress' },
    { label: '군사력 트랙', k: 'military' },
    { label: '보유 코인 (÷3)', k: 'coins' },
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide-modal gameover-modal">
        <div className="victory-banner">
          <div className="victory-trophy-ring">
            {state.victoryType === 'military' ? (
              <Swords size={28} />
            ) : state.victoryType === 'scientific' ? (
              <FlaskConical size={28} />
            ) : (
              <Trophy size={28} />
            )}
          </div>
          <div className="vb-type">{victoryTitle}</div>
          <h2>{state.winner !== null ? `${winnerName} 승리!` : '무승부!'}</h2>
        </div>

        <table className="score-table">
          <thead>
            <tr>
              <th>항목</th>
              <th className={state.winner === 0 ? 'winner-col' : ''}>{state.players[0].name}</th>
              <th className={state.winner === 1 ? 'winner-col' : ''}>{state.players[1].name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td>{r.label}</td>
                <td className={state.winner === 0 ? 'winner-col' : ''}>{s0[r.k]}</td>
                <td className={state.winner === 1 ? 'winner-col' : ''}>{s1[r.k]}</td>
              </tr>
            ))}
            <tr>
              <td>누적 시간 (동점 시 판정)</td>
              <td className={state.winner === 0 ? 'winner-col' : ''}>
                {`${String(Math.floor((state.playerTimesSec?.[0] ?? 0) / 60)).padStart(2, '0')}:${String((state.playerTimesSec?.[0] ?? 0) % 60).padStart(2, '0')}`}
              </td>
              <td className={state.winner === 1 ? 'winner-col' : ''}>
                {`${String(Math.floor((state.playerTimesSec?.[1] ?? 0) / 60)).padStart(2, '0')}:${String((state.playerTimesSec?.[1] ?? 0) % 60).padStart(2, '0')}`}
              </td>
            </tr>
            <tr className="total-row">
              <td>총점</td>
              <td className={state.winner === 0 ? 'winner-col' : ''}>{s0.total}</td>
              <td className={state.winner === 1 ? 'winner-col' : ''}>{s1.total}</td>
            </tr>
          </tbody>
        </table>

        <button
          type="button"
          className="score-details-toggle"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? '▲ 점수 상세 내역 접기' : '▼ 어떻게 합산되었나요? 점수 상세 내역 보기'}
        </button>

        {showDetails && (
          <div className="score-details-grid">
            {([0, 1] as const).map((pIdx) => {
              const items = getPlayerScoreItems(pIdx);
              return (
                <div key={pIdx} className="sd-col">
                  <div className="sd-head">{state.players[pIdx].name}</div>
                  {items.length === 0 ? (
                    <div className="sd-empty">점수 항목 없음</div>
                  ) : (
                    <ul className="sd-list">
                      {items.map((it, idx) => (
                        <li key={idx}>
                          <span className="sd-cat">{it.cat}</span>
                          <span className="sd-name">{it.name}</span>
                          <strong className="sd-pts">+{it.pts}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="gameover-actions">
          <button type="button" className="action-btn btn-build" onClick={onRestart}>
            <span className="ab-title-icon">
              <RotateCcw size={15} />
              같은 모드로 다시 하기
            </span>
          </button>
          <button type="button" className="action-btn btn-discard" onClick={onBackToLobby}>
            <span className="ab-title-icon">
              <Home size={15} />
              로비로 돌아가기
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const OnlineWaitingModal: React.FC<{
  roomCode: string | null;
  statusText: string | null;
  onCancel: () => void;
}> = ({ roomCode, statusText, onCancel }) => {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copyText = (text: string, type: 'code' | 'link') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const inviteUrl =
    typeof window !== 'undefined' && roomCode
      ? `${window.location.origin}/?room=${roomCode}`
      : '';

  return (
    <div className="modal-backdrop">
      <div className="modal-card online-wait-modal">
        <div className="modal-header">
          <div>
            <h3 className="ab-title-icon">
              <Users size={18} />
              상대방 입장 대기 중
            </h3>
            <p className="modal-sub">
              아래 방 코드 또는 초대 링크를 친구에게 보내주세요.
            </p>
          </div>
        </div>

        <div className="wait-code-box">
          <span className="wait-code-label">방 코드</span>
          <strong className="wait-code-value">{roomCode ?? '....'}</strong>
        </div>

        <div className="wait-copy-row">
          <button
            type="button"
            className="action-btn btn-build"
            disabled={!roomCode}
            onClick={() => roomCode && copyText(roomCode, 'code')}
          >
            <span className="ab-title-icon">
              {copied === 'code' ? <Check size={15} /> : <Copy size={15} />}
              {copied === 'code' ? '코드 복사됨!' : '방 코드 복사'}
            </span>
          </button>

          <button
            type="button"
            className="action-btn btn-discard"
            disabled={!inviteUrl}
            onClick={() => inviteUrl && copyText(inviteUrl, 'link')}
          >
            <span className="ab-title-icon">
              {copied === 'link' ? <Check size={15} /> : <Link2 size={15} />}
              {copied === 'link' ? '링크 복사됨!' : '초대 링크 복사'}
            </span>
          </button>
        </div>

        {statusText && <div className="online-status">{statusText}</div>}

        <button type="button" className="wait-cancel-btn" onClick={onCancel}>
          취소하고 로비로 돌아가기
        </button>
      </div>
    </div>
  );
};

export const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tab, setTab] = useState<
    'basics' | 'cards' | 'yellowPurple' | 'chains' | 'tokens' | 'wonders' | 'tips'
  >('basics');

  // Group chain symbols -> { fromCards, toCards }
  const chainEntries = Object.entries(CHAIN_LABELS).map(([sym, labelKo]) => {
    const fromCards = Object.values(CARDS).filter((c) => c.chainTo === sym);
    const toCards = Object.values(CARDS).filter((c) => c.chainFrom === sym);
    return { sym, labelKo, fromCards, toCards };
  });

  const yellowCards = Object.values(CARDS).filter((c) => c.color === 'yellow');
  const purpleCards = Object.values(CARDS).filter((c) => c.color === 'purple');

  const colorKo = (c: string) =>
    c === 'yellow'
      ? '노란색'
      : c === 'blue'
        ? '파란색'
        : c === 'green'
          ? '초록색'
          : c === 'red'
            ? '빨간색'
            : c === 'brown'
              ? '갈색'
              : '회색';

  const resKo = (r: string) =>
    r === 'wood'
      ? '목재'
      : r === 'clay'
        ? '진흙'
        : r === 'stone'
          ? '석재'
          : r === 'glass'
            ? '유리'
            : '파피루스';

  const describeYellowCard = (c: (typeof yellowCards)[number]) => {
    const parts: string[] = [];
    if (c.coins) parts.push(`즉시 +${c.coins}코인 획득`);
    if (c.tradingDiscount) {
      parts.push(`[${c.tradingDiscount.map(resKo).join('/')}] 무역 비용 1코인 고정 할인`);
    }
    if (c.flexibleProduces) {
      parts.push(`매 턴 [${c.flexibleProduces.map(resKo).join('/')}] 중 1개 자유 생산`);
    }
    if (c.coinsPerCard) {
      const target = c.coinsPerCard.includeWonders
        ? '완공된 내 불가사의'
        : `내 [${c.coinsPerCard.colors.map(colorKo).join('+')}] 카드`;
      parts.push(`${target} 1개당 즉시 +${c.coinsPerCard.amount}코인`);
    }
    if (c.vp) parts.push(`종료 시 승점 +${c.vp}점`);
    return parts.join(' · ');
  };

  const describePurpleCard = (c: (typeof purpleCards)[number]) => {
    if (!c.guildVp) return '';
    if (c.guildVp.type === 'mostWonders') {
      return `나와 상대 중 완공된 불가사의가 더 많은 쪽 개수 × ${c.guildVp.vpPer}점 (즉시 코인 없음)`;
    }
    if (c.guildVp.type === 'coins') {
      return `나와 상대 중 보유 코인이 더 많은 쪽 기준 3코인당 +${c.guildVp.vpPer}점 (코인을 내는 것 아님!)`;
    }
    const cols = (c.guildVp.colors ?? []).map(colorKo).join(' + ');
    return `나와 상대 중 [${cols}] 카드가 더 많은 쪽 장수만큼 즉시 +1코인 & 종료 시 +${c.guildVp.vpPer}점`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="ab-title-icon">
              <BookOpen size={18} />
              세븐 원더스 듀얼 완벽 가이드
            </h3>
            <p className="modal-sub">
              처음 하시는 분도 1분 만에 이해할 수 있는 카드·토큰·불가사의 총정리
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="rules-tabs" role="tablist">
          <button
            type="button"
            className={`rtab ${tab === 'basics' ? 'active' : ''}`}
            onClick={() => setTab('basics')}
          >
            기본 & 승리
          </button>
          <button
            type="button"
            className={`rtab ${tab === 'cards' ? 'active' : ''}`}
            onClick={() => setTab('cards')}
          >
            카드 색상별 역할
          </button>
          <button
            type="button"
            className={`rtab ${tab === 'yellowPurple' ? 'active' : ''}`}
            onClick={() => setTab('yellowPurple')}
          >
            금색·보라 도감
          </button>
          <button
            type="button"
            className={`rtab ${tab === 'chains' ? 'active' : ''}`}
            onClick={() => setTab('chains')}
          >
            연쇄 테크
          </button>
          <button
            type="button"
            className={`rtab ${tab === 'tokens' ? 'active' : ''}`}
            onClick={() => setTab('tokens')}
          >
            진보 토큰 (10종)
          </button>
          <button
            type="button"
            className={`rtab ${tab === 'wonders' ? 'active' : ''}`}
            onClick={() => setTab('wonders')}
          >
            불가사의 (12종)
          </button>
          <button
            type="button"
            className={`rtab ${tab === 'tips' ? 'active' : ''}`}
            onClick={() => setTab('tips')}
          >
            고수 팁
          </button>
        </div>

        <div className="rules-body">
          {tab === 'basics' && (
            <>
              <div className="rule-section-card">
                <h4>🏆 3가지 승리 조건</h4>
                <ul>
                  <li>
                    <strong>⚔️ 군사적 패권 (즉시 승리):</strong> 분쟁 말을 상대 끝(<strong>±9</strong>)까지 밀어내면 시대에 상관없이 <strong>즉시 승리</strong>합니다.
                  </li>
                  <li>
                    <strong>🔬 과학적 패권 (즉시 승리):</strong> 서로 다른 과학 상징 <strong>6종류</strong>를 모으면 <strong>즉시 승리</strong>합니다.
                  </li>
                  <li>
                    <strong>🏛️ 시민 승리 (점수 대결):</strong> 제3시대가 끝날 때까지 즉시 승리가 나오지 않으면, 파랑·초록·노랑·보라 카드 + 불가사의 + 진보 토큰 + 군사 트랙 + 보유 코인(3코인당 1점)을 합산해 <strong>총점이 높은 쪽이 승리</strong>합니다.
                  </li>
                </ul>
              </div>

              <div className="rule-section-card">
                <h4>🎯 내 턴에 하는 행동 (3가지 중 택 1)</h4>
                <p className="rule-lead">
                  피라미드에서 <strong>앞면이고 다른 카드에 가려지지 않은 카드 1장</strong>을 골라 아래 3가지 중 하나를 실행합니다.
                </p>
                <ul>
                  <li>
                    <strong>1. 건물 건설하기:</strong> 카드 왼쪽의 비용(코인·자원)을 내고 내 도시에 짓습니다. 이전 시대에 지은 카드의 <strong>연쇄 상징(🔗)</strong>이 있으면 <strong>무료 건설</strong>이 가능합니다!
                  </li>
                  <li>
                    <strong>2. 버리고 코인 획득:</strong> 카드를 버리고 <code>2 + 내가 가진 노란색 카드 수</code>만큼 코인을 얻습니다. (돈이 급하거나 상대에게 주기 싫은 카드를 없앨 때 사용)
                  </li>
                  <li>
                    <strong>3. 불가사의 건설:</strong> 고른 카드를 불가사의 아래에 꽂아 비용을 지불하고 불가사의의 강력한 특수 효과를 발동합니다.
                  </li>
                </ul>
              </div>

              <div className="rule-section-card">
                <h4>💰 자원 부족 & 무역 규칙 + 선공 규칙</h4>
                <ul>
                  <li>
                    <strong>자원 무역:</strong> 부족한 자원이 있어도 건물을 지을 수 있습니다! 부족한 자원 1개당 <code>2 + 상대가 생산하는 해당 자원 수</code>만큼 코인을 은행에 내고 사옵니다.
                  </li>
                  <li>
                    <strong>시대 전환 선공 선택:</strong> 제1·2시대가 끝나면 <strong>군사력이 더 약한(불리한) 플레이어</strong>가 다음 시대에 누가 먼저 시작할지 직접 고릅니다.
                  </li>
                </ul>
              </div>
            </>
          )}

          {tab === 'cards' && (
            <div className="color-guide-grid">
              <div className="cg-card cg-brown cg-with-sample">
                <div className="cg-sample-card">
                  <CardView card={CARDS.a1_lumber_yard} compact />
                </div>
                <div>
                  <div className="cg-head">🟤 갈색 (원자재) & ⚪ 회색 (제조품)</div>
                  <p>
                    <strong>목재·진흙·석재(갈색)</strong>와 <strong>유리·파피루스(회색)</strong>를 매 턴 자동 생산합니다.
                  </p>
                  <p className="cg-why">
                    <strong>왜 모아야 하나요?</strong> 내 건설비가 <strong>무료</strong>에 가까워지고, <strong>상대가 무역할 때 내야 하는 코인(2 + 내 생산량)</strong>이 폭등합니다!
                  </p>
                </div>
              </div>

              <div className="cg-card cg-red cg-with-sample">
                <div className="cg-sample-card">
                  <CardView card={CARDS.a1_guard_tower} compact />
                </div>
                <div>
                  <div className="cg-head">🔴 빨간 카드 (군사)</div>
                  <p>
                    <strong>방패(🛡️)</strong>로 분쟁 말을 상대 끝(<strong>±9</strong>)까지 밀면 <strong>즉시 군사 승리!</strong>
                  </p>
                  <p className="cg-why">
                    <strong>핵심 룰:</strong> <strong>±3, ±6 돌파 시</strong> 상대 코인 <strong>-2 / -5 압수</strong>, 종료 시 위치에 따라 <strong>+2 / +5 / +10점</strong>!
                  </p>
                </div>
              </div>

              <div className="cg-card cg-green cg-with-sample">
                <div className="cg-sample-card">
                  <CardView card={CARDS.a1_workshop} compact />
                </div>
                <div>
                  <div className="cg-head">🟢 초록 카드 (과학)</div>
                  <p>
                    서로 다른 과학 상징 <strong>6종류</strong>를 모으면 <strong>즉시 과학 승리!</strong>
                  </p>
                  <p className="cg-why">
                    <strong>핵심 룰:</strong> <strong>같은 상징 2개(한 쌍)</strong>를 모을 때마다 보드의 <strong>진보 토큰 1개</strong>를 획득합니다.
                  </p>
                </div>
              </div>

              <div className="cg-card cg-yellow cg-with-sample">
                <div className="cg-sample-card">
                  <CardView card={CARDS.a1_tavern} compact />
                </div>
                <div>
                  <div className="cg-head">🟡 금색 / 노란 카드 (상업)</div>
                  <p>
                    즉시 코인을 주거나 특정 자원의 <strong>무역 비용을 1코인으로 고정 할인</strong>합니다.
                  </p>
                  <p className="cg-why">
                    <strong>왜 좋은가요?</strong> 노란 카드가 많을수록 카드 판매 시 얻는 코인(<code>2 + 노란 수</code>)이 늘어납니다!
                  </p>
                </div>
              </div>

              <div className="cg-card cg-blue cg-with-sample">
                <div className="cg-sample-card">
                  <CardView card={CARDS.a1_baths} compact />
                </div>
                <div>
                  <div className="cg-head">🔵 파란 카드 (시민)</div>
                  <p>
                    특수 기능은 없지만 가장 높은 <strong>순수 승점(3~8점)</strong>을 제공합니다.
                  </p>
                  <p className="cg-why">
                    <strong>핵심 룰:</strong> 3시대 점수 대결(동점 시 파랑 점수 우선 판정)의 핵심입니다.
                  </p>
                </div>
              </div>

              <div className="cg-card cg-purple cg-with-sample">
                <div className="cg-sample-card">
                  <CardView card={CARDS.g_merchants} compact />
                </div>
                <div>
                  <div className="cg-head">🟣 보라 카드 (길드 — 3시대)</div>
                  <p>
                    카드 중앙의 <strong>미니 색상/아이콘</strong> 기준으로 <strong>나와 상대 중 더 많은 쪽</strong>만큼 즉시 코인 & 종료 시 승점을 줍니다!
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'yellowPurple' && (
            <>
              <div className="rule-section-card">
                <h4>🔎 금색 · 보라 카드 문양(아이콘) 읽는 법</h4>
                <ul>
                  <li>
                    <strong><code>1🪙: 자원</code></strong> — 해당 자원이 부족할 때 상대 생산량과 상관없이 <strong>무조건 1코인</strong>으로 무역!
                  </li>
                  <li>
                    <strong><code>자원 / 자원</code></strong> — 매 턴 표시된 자원 중 원하는 1개를 무료로 생산!
                  </li>
                  <li>
                    <strong><code>+N🪙/장</code></strong> — 건설 시 내 특정 색 카드(또는 불가사의) 개수만큼 <strong>즉시 코인 획득</strong>!
                  </li>
                  <li>
                    <strong><code>[컬러 미니 카드] +1🪙 +1★</code></strong> — 나와 상대 중 해당 색을 <strong>더 많이 가진 쪽 장수</strong>만큼 즉시 코인 & 종료 시 승점!
                  </li>
                  <li>
                    <strong><code>[🏛️] +2★</code></strong> — 나와 상대 중 완공된 불가사의 최다 개수 × 2점!
                  </li>
                  <li>
                    <strong><code>[보유3🪙] +1★</code></strong> — 코인을 내는 것이 아니라, 종료 시 보유 코인이 더 많은 쪽의 <strong>3코인마다 +1점</strong>!
                  </li>
                </ul>
              </div>

              <div className="rule-section-card">
                <h4>🟡 금색 (노란색 상업) 카드 전체 ({yellowCards.length}종)</h4>
                <div className="guide-item-grid">
                  {yellowCards.map((c) => (
                    <div key={c.id} className="guide-item-card">
                      <div className="gi-title">
                        [{c.age}시대] {c.nameKo}
                      </div>
                      <div className="gi-desc">{describeYellowCard(c)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rule-section-card">
                <h4>🟣 보라색 (길드 — 3시대) 카드 전체 ({purpleCards.length}종)</h4>
                <div className="guide-item-grid">
                  {purpleCards.map((c) => (
                    <div key={c.id} className="guide-item-card">
                      <div className="gi-title">{c.nameKo}</div>
                      <div className="gi-desc">{describePurpleCard(c)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'chains' && (
            <>
              <p className="rule-lead">
                이전 시대 카드의 오른쪽 아래(<strong>➡ 상징</strong>)를 미리 지어두면, 다음 시대 카드의 왼쪽 아래(<strong>🔗 상징</strong>)와 연결되어 <strong>자원·코인 없이 무료로 건설</strong>할 수 있습니다!
              </p>
              <div className="chain-tree-grid">
                {chainEntries.map((ch) => (
                  <div key={ch.sym} className="chain-tree-item">
                    <span className="ct-sym">🔗 {ch.labelKo}</span>
                    <span className="ct-from">
                      {ch.fromCards.map((c) => `(${c.age}시대) ${c.nameKo}`).join(', ')}
                    </span>
                    <span className="ct-arrow">➡ 무료 ➡</span>
                    <span className="ct-to">
                      {ch.toCards.map((c) => `(${c.age}시대) ${c.nameKo}`).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'tokens' && (
            <>
              <p className="rule-lead">
                같은 과학 상징을 <strong>2개(한 쌍)</strong> 모을 때마다 보드에 깔린 5개의 진보 토큰 중 1개를 선택해 영구 효과를 얻습니다. (게임당 총 10종 중 5종이 보드에 배치됨)
              </p>
              <div className="guide-item-grid">
                {Object.values(PROGRESS_TOKENS).map((pt) => (
                  <div key={pt.id} className="guide-item-card token-card">
                    <div className="gi-title">📜 {pt.nameKo}</div>
                    <div className="gi-en">{pt.name}</div>
                    <div className="gi-desc">{pt.descriptionKo}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'wonders' && (
            <>
              <div className="rule-section-card">
                <h4>🏛️ 불가사의를 꼭 지어야 하는 이유 3가지</h4>
                <ul>
                  <li>
                    <strong>1. 추가 턴(Play Again)의 사기성:</strong> 많은 불가사의가 <strong>"한 턴 더 진행"</strong> 효과를 가지고 있어, 연속으로 카드를 2장 가져오거나 상대에게 불리한 카드 공개 순서를 떠넘길 수 있습니다.
                  </li>
                  <li>
                    <strong>2. 판을 뒤집는 특수 효과:</strong> 상대의 핵심 자원 카드 파괴, 버려진 카드 더미에서 무료 부활, 코인 +12, 방패 +2, 승점 +9 등 일반 카드보다 훨씬 강력합니다.
                  </li>
                  <li>
                    <strong>3. 총 7개 제한 선점 경쟁:</strong> 양 플레이어가 각자 4개씩(총 8개) 들고 시작하지만, <strong>둘 합쳐 7개가 완공되면 마지막 8번째 불가사의는 지을 수 없습니다!</strong> 상대가 4개를 다 짓기 전에 내가 먼저 4개를 완공하는 것이 유리합니다.
                  </li>
                </ul>
              </div>

              <div className="guide-item-grid wonders-guide-grid">
                {Object.values(WONDERS).map((w) => (
                  <div key={w.id} className="guide-item-card wonder-guide-card">
                    <div className="wg-art">
                      <WonderArtwork wonderId={w.id} compact />
                    </div>
                    <div className="wg-body">
                      <div className="gi-title">{w.nameKo}</div>
                      <div className="gi-en">{w.name}</div>
                      <div className="gi-desc">{w.descriptionKo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'tips' && (
            <>
              <div className="rule-section-card">
                <h4>💡 실전 고수가 되는 5가지 핵심 팁</h4>
                <ul>
                  <li>
                    <strong>1. 뒷면 카드를 내가 먼저 열지 마세요 (턴 패리티):</strong> 내가 카드를 가져갔을 때 가려져 있던 뒷면 카드가 앞면으로 뒤집히면, <strong>그 새 카드를 먼저 고르는 건 상대</strong>입니다! 가능하면 <strong>추가 턴 불가사의</strong>를 써서 내가 뒤집고 내가 바로 먹거나, 상대가 어쩔 수 없이 뒤집게 유도하세요.
                  </li>
                  <li>
                    <strong>2. 유리·파피루스(회색 자원)를 선점하세요:</strong> 제1·2시대에서 회색 자원은 장수가 적습니다. 내가 독점하면 상대는 무역할 때마다 3~4코인씩 뜯기게 됩니다.
                  </li>
                  <li>
                    <strong>3. 상대의 과학·군사 1순위 카드는 버려서라도 막으세요:</strong> 상대가 과학 상징 5종류이거나 방패 1~2개로 군사 승리가 보일 때는, 내가 쓸모없더라도 카드를 버려 코인으로 바꾸면서 원천 봉쇄해야 합니다.
                  </li>
                  <li>
                    <strong>4. 연쇄 상징(🔗)을 미리 깔아두세요:</strong> 제1시대의 싼 카드에 붙은 연쇄 상징은 제2·3시대의 비싼 건물을 <strong>자원 0개로 공짜 건설</strong>하게 해줍니다.
                  </li>
                  <li>
                    <strong>5. 불가사의는 타이밍이 생명입니다:</strong> <code>추가 턴</code> 불가사의는 아껴두었다가 내가 원하는 고가치 카드가 열렸을 때나 턴 순서를 바꾸고 싶을 때 터뜨리는 것이 가장 강력합니다.
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
