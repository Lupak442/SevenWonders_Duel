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
import { ResourceBadge } from './Icons';
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
  const s0 = calculateScore(state, 0);
  const s1 = calculateScore(state, 1);

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
            <tr className="total-row">
              <td>총점</td>
              <td className={state.winner === 0 ? 'winner-col' : ''}>{s0.total}</td>
              <td className={state.winner === 1 ? 'winner-col' : ''}>{s1.total}</td>
            </tr>
          </tbody>
        </table>

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

export const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-card wide-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3 className="ab-title-icon">
          <BookOpen size={18} />
          세븐 원더스 듀얼 핵심 규칙
        </h3>
        <button type="button" className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="rules-body">
        <p>
          <strong>1. 3가지 승리 조건:</strong>
        </p>
        <ul>
          <li>
            <strong>⚔️ 군사적 패권:</strong> 분쟁 말을 상대 끝(±9)까지 밀면 즉시 승리!
          </li>
          <li>
            <strong>🔬 과학적 패권:</strong> 서로 다른 과학 상징 <strong>6개</strong>를 모으면 즉시 승리!
          </li>
          <li>
            <strong>🏛️ 시민 승리:</strong> 제3시대 종료 시 총 승점이 높은 플레이어가 승리!
          </li>
        </ul>
        <p>
          <strong>2. 매 턴 행동 (가려지지 않은 앞면 카드 1장 선택):</strong>
        </p>
        <ul>
          <li>
            <strong>건물 건설:</strong> 필요한 자원(부족한 자원은{' '}
            <code>2 + 상대 생산량</code> 코인으로 무역) 또는 <strong>연쇄 상징</strong>으로 무료 건설!
          </li>
          <li>
            <strong>버리고 코인 획득:</strong> <code>2 + 보유한 노란색 카드 수</code>만큼 코인 획득.
          </li>
          <li>
            <strong>불가사의 건설:</strong> 카드를 불가사의 아래에 꽂고 비용을 지불해 특수 효과 발동! (양 플레이어 합산 최대 <strong>7개</strong>까지 건설 가능)
          </li>
        </ul>
        <p>
          <strong>3. 진보 토큰:</strong> 같은 과학 상징을 <strong>2개(한 쌍)</strong> 모을 때마다 보드의 진보 토큰 1개를 획득합니다.
        </p>
      </div>
    </div>
  </div>
);
