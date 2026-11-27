import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Coins,
  Copy,
  Dices,
  Eye,
  EyeOff,
  Globe,
  Home,
  Layers,
  Link2,
  RotateCcw,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { performHitStayAITurn } from './ai';
import {
  createInitialHitStayState,
  DECK_COMPOSITION,
  getHandSum,
  performBetAction,
  performHitOrStay,
  revealInitialCard,
  startNextRound,
  toggleShowHandOnEnd,
} from './engine';
import { HitStayDifficulty, HitStayState, SeatConfig } from './types';
import './hitstay.css';

interface HitStayAppProps {
  onBackToSevenWonders: () => void;
}

function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8080';
  const { protocol, hostname, port, host } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  if (port === '5173') return `ws://${hostname || 'localhost'}:8080`;
  return `${wsProto}//${host}`;
}

export const HitStayApp: React.FC<HitStayAppProps> = ({ onBackToSevenWonders }) => {
  const [state, setState] = useState<HitStayState | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showDeckPanel, setShowDeckPanel] = useState(false);

  // Lobby state
  const initialRoomParam =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('hs') || '').toUpperCase().trim()
      : '';
  const [tab, setTab] = useState<'ai' | 'local' | 'online'>(
    initialRoomParam ? 'online' : 'ai'
  );
  const [seatCount, setSeatCount] = useState<2 | 3 | 4>(4);
  const [difficulty, setDifficulty] = useState<HitStayDifficulty>('normal');
  const [seats, setSeats] = useState<SeatConfig[]>([
    { name: '플레이어 1', isAI: false },
    { name: '포커 봇 1', isAI: true },
    { name: '포커 봇 2', isAI: true },
    { name: '포커 봇 3', isAI: true },
  ]);
  const [showDeckCounter, setShowDeckCounter] = useState(true);
  const [serverUrl, setServerUrl] = useState(getDefaultWsUrl);
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomParam);

  // Online state
  const wsRef = useRef<WebSocket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [myOnlineSeat, setMyOnlineSeat] = useState<number | null>(null);
  const [humanNeeded, setHumanNeeded] = useState(2);
  const [joinedCount, setJoinedCount] = useState(1);
  const [onlineStatus, setOnlineStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRoomCode(null);
    setMyOnlineSeat(null);
    setJoinedCount(1);
  }, []);

  const applyAndSync = useCallback((updater: (prev: HitStayState) => HitStayState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      if (next.mode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'sync_state', state: next }));
      }
      return next;
    });
  }, []);

  // AI turn loop (in online mode, only Host (seat 0) runs AI turns and syncs!)
  const isOnlineWaiting = Boolean(
    state && state.mode === 'online' && joinedCount < humanNeeded
  );
  useEffect(() => {
    if (!state || isOnlineWaiting) return;
    if (state.phase === 'round_end' || state.phase === 'game_over') return;
    const cur = state.players[state.currentPlayer];
    if (!cur?.isAI) return;
    if (state.mode === 'online' && myOnlineSeat !== 0) return;

    const timer = window.setTimeout(() => {
      applyAndSync((prev) => performHitStayAITurn(prev));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [state, isOnlineWaiting, myOnlineSeat, applyAndSync]);

  const activeSeats = seats.slice(0, seatCount);

  const toggleSeatType = (idx: number) => {
    if (idx === 0) return;
    setSeats((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              isAI: !s.isAI,
              name: !s.isAI ? `포커 봇 ${i}` : `플레이어 ${i + 1}`,
            }
          : s
      )
    );
  };

  const updateSeatName = (idx: number, name: string) => {
    setSeats((prev) => prev.map((s, i) => (i === idx ? { ...s, name } : s)));
  };

  const startOfflineGame = (mode: 'ai' | 'local') => {
    closeSocket();
    const configured = activeSeats.map((s, idx) =>
      mode === 'ai' && idx > 0 ? { ...s, isAI: true } : s
    );
    setState(
      createInitialHitStayState({
        mode,
        seats: configured,
        difficulty,
        showDeckCounter,
      })
    );
  };

  const connectOnline = (onOpen: (ws: WebSocket) => void) => {
    closeSocket();
    setOnlineStatus('서버에 연결 중...');
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;
    ws.onopen = () => onOpen(ws);
    ws.onerror = () => setOnlineStatus('서버 연결 실패. 서버가 실행 중인지 확인하세요.');
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'room_created') {
        setRoomCode(msg.code);
        setMyOnlineSeat(0);
        setJoinedCount(1);
        setOnlineStatus(`방 생성 완료! 코드: ${msg.code}`);
      } else if (msg.type === 'opponent_joined') {
        setJoinedCount(msg.joinedCount ?? 2);
        setState((prev) => {
          if (!prev) return prev;
          // Assign incoming human to the N-th human seat
          const humanIndices = prev.players
            .map((p, i) => (!p.isAI ? i : -1))
            .filter((i) => i >= 0);
          const seatIdx = humanIndices[msg.playerIndex] ?? msg.playerIndex;
          const players = prev.players.map((p, i) =>
            i === seatIdx ? { ...p, name: msg.playerName || p.name } : p
          );
          const next = { ...prev, players };
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'sync_state', state: next }));
          }
          return next;
        });
      } else if (msg.type === 'room_joined') {
        setRoomCode(msg.code);
        const st: HitStayState | null = msg.state;
        const humanIndices = st
          ? st.players.map((p, i) => (!p.isAI ? i : -1)).filter((i) => i >= 0)
          : [0, 1];
        setMyOnlineSeat(humanIndices[msg.playerIndex] ?? msg.playerIndex);
        setHumanNeeded(msg.maxPlayers ?? humanIndices.length);
        setJoinedCount(msg.joinedCount ?? 2);
        setState(st);
        setOnlineStatus(null);
      } else if (msg.type === 'state_update') {
        setState(msg.state);
      } else if (msg.type === 'opponent_left') {
        setOnlineStatus('참가자 중 한 명이 연결이 끊어졌습니다. 같은 방 코드로 재접속 가능합니다.');
      } else if (msg.type === 'error') {
        setOnlineStatus(msg.message);
      }
    };
  };

  const createOnlineRoom = () => {
    // Ensure at least 2 human seats for online
    const configured = activeSeats.map((s, idx) =>
      idx === 0 ? { ...s, isAI: false } : s
    );
    const humans = configured.filter((s) => !s.isAI).length;
    if (humans < 2) {
      configured[1] = { name: '상대 플레이어', isAI: false };
    }
    const needed = configured.filter((s) => !s.isAI).length;
    setHumanNeeded(needed);

    const initial = createInitialHitStayState({
      mode: 'online',
      seats: configured,
      difficulty,
      showDeckCounter,
    });
    connectOnline((ws) => {
      ws.send(
        JSON.stringify({
          type: 'create_room',
          maxPlayers: needed,
          state: initial,
        })
      );
      setState(initial);
    });
  };

  const joinOnlineRoom = () => {
    connectOnline((ws) => {
      ws.send(
        JSON.stringify({
          type: 'join_room',
          code: roomCodeInput.trim(),
          playerName: seats[0].name.trim() || '게스트',
        })
      );
    });
  };

  const copyInvite = (text: string, kind: 'code' | 'link') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  // ======================== LOBBY VIEW ========================
  if (!state) {
    return (
      <div className="hs-lobby-screen">
        <button
          type="button"
          className="wg-top-switch-btn"
          onClick={onBackToSevenWonders}
        >
          <ArrowLeft size={15} />
          <span>7 Wonders로 돌아가기</span>
        </button>

        <div className="lobby-card hs-lobby-card">
          <div className="lobby-badge-row">
            <span className="lobby-season-pill">
              <Sparkles size={12} />
              BLACKJACK × HOLD&apos;EM
            </span>
          </div>

          <h1 className="lobby-title">HIT &amp; STAY</h1>
          <p className="lobby-subtitle">
            2~4인 생존 포커 — 한계 숫자를 넘지 말고 칩을 모두 차지하세요
          </p>

          <div className="lobby-tabs" role="tablist">
            <button
              type="button"
              className={`ltab ${tab === 'ai' ? 'active' : ''}`}
              onClick={() => setTab('ai')}
            >
              <Bot size={15} />
              <span>봇전</span>
            </button>
            <button
              type="button"
              className={`ltab ${tab === 'local' ? 'active' : ''}`}
              onClick={() => setTab('local')}
            >
              <Users size={15} />
              <span>로컬 매치</span>
            </button>
            <button
              type="button"
              className={`ltab ${tab === 'online' ? 'active' : ''}`}
              onClick={() => setTab('online')}
            >
              <Globe size={15} />
              <span>온라인 매치</span>
            </button>
          </div>

          <div className="lobby-panel">
            <div className="field-label">
              참가 인원 (2~4명)
              <div className="diff-row">
                {([2, 3, 4] as const).map((cnt) => (
                  <button
                    type="button"
                    key={cnt}
                    className={`diff-btn ${seatCount === cnt ? 'active' : ''}`}
                    onClick={() => setSeatCount(cnt)}
                  >
                    <span className="diff-title">{cnt}인전</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seat Configuration: Human / Bot mixing! */}
            <div className="field-label">
              좌석 설정 (방장이 사람/봇 자유 조합 가능)
              <div className="hs-seats-list">
                {activeSeats.map((s, idx) => (
                  <div key={idx} className="hs-seat-row">
                    <span className="hs-seat-num">#{idx + 1}</span>
                    <input
                      className="text-input hs-seat-input"
                      value={s.name}
                      onChange={(e) => updateSeatName(idx, e.target.value)}
                      maxLength={12}
                    />
                    {idx === 0 ? (
                      <span className="hs-seat-tag is-host">방장(나)</span>
                    ) : tab === 'ai' ? (
                      <span className="hs-seat-tag is-bot">봇</span>
                    ) : (
                      <button
                        type="button"
                        className={`hs-seat-toggle ${s.isAI ? 'is-bot' : 'is-human'}`}
                        onClick={() => toggleSeatType(idx)}
                      >
                        {s.isAI ? <Bot size={13} /> : <User size={13} />}
                        <span>{s.isAI ? '봇' : '사람'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="field-label">
              봇 난이도 설정
              <div className="diff-row">
                {(['easy', 'normal', 'hard'] as HitStayDifficulty[]).map((d) => (
                  <button
                    type="button"
                    key={d}
                    className={`diff-btn ${difficulty === d ? 'active' : ''}`}
                    onClick={() => setDifficulty(d)}
                  >
                    <span className="diff-title">
                      {d === 'easy' ? '입문' : d === 'normal' ? '숙련' : '전설'}
                    </span>
                    <span className="diff-sub">
                      {d === 'easy' ? 'Easy' : d === 'normal' ? 'Normal' : 'Hard'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="hs-option-check">
              <input
                type="checkbox"
                checked={showDeckCounter}
                onChange={(e) => setShowDeckCounter(e.target.checked)}
              />
              <span>남은 덱 카드 카운팅 표 공개 (초보자 도우미)</span>
            </label>

            {tab === 'ai' && (
              <button
                type="button"
                className="start-main-btn"
                onClick={() => startOfflineGame('ai')}
              >
                <Bot size={18} />
                <span>{seatCount}인 봇전 시작 (칩 40개)</span>
              </button>
            )}

            {tab === 'local' && (
              <button
                type="button"
                className="start-main-btn"
                onClick={() => startOfflineGame('local')}
              >
                <Users size={18} />
                <span>{seatCount}인 로컬 매치 시작</span>
              </button>
            )}

            {tab === 'online' && (
              <div className="online-actions">
                <label className="field-label">
                  서버 주소 (WebSocket)
                  <input
                    className="text-input"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="start-main-btn"
                  onClick={createOnlineRoom}
                >
                  <span>➕ 온라인 방 만들기 (사람 + 봇 혼합 가능)</span>
                </button>
                <div className="join-row">
                  <input
                    className="text-input code-input"
                    placeholder="방 코드 입력"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <button
                    type="button"
                    className="join-btn"
                    disabled={!roomCodeInput.trim()}
                    onClick={joinOnlineRoom}
                  >
                    입장
                  </button>
                </div>
                {onlineStatus && <div className="online-status">{onlineStatus}</div>}
              </div>
            )}

            <button
              type="button"
              className="lobby-rules-btn"
              onClick={() => setShowRules(true)}
            >
              <BookOpen size={15} />
              <span>힛 &amp; 스테이 규칙 보기 (35장 덱 · 8면체 주사위 · 베팅)</span>
            </button>
          </div>
        </div>

        {showRules && <HitStayRulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  // ======================== GAME TABLE VIEW ========================
  const viewerIdx =
    state.mode === 'online'
      ? (myOnlineSeat ?? 0)
      : state.mode === 'ai'
        ? 0
        : state.currentPlayer;

  const canInteract =
    !isOnlineWaiting &&
    state.phase !== 'game_over' &&
    state.phase !== 'round_end' &&
    (state.mode === 'local'
      ? !state.players[state.currentPlayer]?.isAI
      : state.mode === 'ai'
        ? state.currentPlayer === 0
        : state.currentPlayer === myOnlineSeat);

  const curPlayer = state.players[state.currentPlayer];
  const toCall = curPlayer ? Math.max(0, state.currentHighBet - curPlayer.roundBet) : 0;
  const maxRaiseAdd = curPlayer
    ? Math.max(0, Math.min(curPlayer.chips - toCall, state.roundBetCap - state.currentHighBet))
    : 0;

  const inviteLink =
    typeof window !== 'undefined' && roomCode
      ? `${window.location.origin}/?hs=${roomCode}`
      : '';

  return (
    <div className="hs-game-bg">
      <div className="app-shell hs-shell">
        {/* Top HUD */}
        <header className="top-bar">
          <div className="tb-left">
            <span className="tb-logo">
              <Dices size={17} className="tb-logo-icon" />
              <span>HIT &amp; STAY</span>
            </span>
            <span className="age-badge age-badge-3">R{state.roundNumber}</span>
            <span className="room-badge">기본 베팅 {state.ante}칩</span>
            {roomCode && <span className="room-badge">방: {roomCode}</span>}
          </div>

          <div className="tb-center">
            <span className={`turn-banner ${canInteract ? 'your-turn' : 'wait-turn'}`}>
              {state.phase === 'game_over'
                ? '게임 종료'
                : state.phase === 'round_end'
                  ? '라운드 종료 — 결과 확인'
                  : state.phase === 'reveal_one'
                    ? `${curPlayer.name}: 공개할 카드 1장 선택`
                    : state.phase === 'bet1'
                      ? `${curPlayer.name}: 1차 베팅`
                      : state.phase === 'hit_stay'
                        ? `${curPlayer.name}: HIT / STAY 선택`
                        : `${curPlayer.name}: 2차 베팅`}
            </span>
          </div>

          <div className="tb-right">
            {state.showDeckCounter && (
              <button
                type="button"
                className={`tb-btn ${showDeckPanel ? 'is-open' : ''}`}
                onClick={() => setShowDeckPanel((v) => !v)}
              >
                <Layers size={14} />
                <span>덱 {state.deck.length}/35</span>
              </button>
            )}
            <button type="button" className="tb-btn" onClick={() => setShowRules(true)}>
              <BookOpen size={14} />
              <span>규칙</span>
            </button>
            <button
              type="button"
              className="tb-btn btn-danger"
              onClick={() => {
                closeSocket();
                setState(null);
              }}
            >
              <Home size={14} />
              <span>로비</span>
            </button>
          </div>
        </header>

        {/* Center Info Strip: Target Limit Die, Pot, Deck Remaining */}
        <div className="hs-table-hud">
          <div className="hs-hud-box target-box">
            <span className="hs-hud-label">🎲 8면체 한계 숫자</span>
            <strong className="hs-hud-val">{state.targetLimit}</strong>
          </div>
          <div className="hs-hud-box pot-box">
            <span className="hs-hud-label">🪙 현재 팟 (Pot)</span>
            <strong className="hs-hud-val">{state.pot}</strong>
          </div>
          <div className="hs-hud-box deck-box">
            <span className="hs-hud-label">🃏 남은 덱</span>
            <strong className="hs-hud-val">{state.deck.length}장</strong>
          </div>
          <div className="hs-hud-box cap-box">
            <span className="hs-hud-label">베팅 상한</span>
            <strong className="hs-hud-val">{state.roundBetCap}칩</strong>
          </div>
        </div>

        {/* Optional Deck Counter Drawer */}
        {state.showDeckCounter && showDeckPanel && (
          <div className="hs-deck-counter">
            {DECK_COMPOSITION.map(({ value, count }) => {
              const rem = state.deck.filter((c) => c.value === value).length;
              return (
                <div key={value} className={`hs-dc-chip ${rem === 0 ? 'is-empty' : ''}`}>
                  <span className="hs-dc-val">{value}</span>
                  <span className="hs-dc-rem">
                    {rem}/{count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Players Grid */}
        <div className="hs-players-grid">
          {state.players.map((p) => {
            const isViewer = p.id === viewerIdx;
            const isTurn =
              state.currentPlayer === p.id &&
              state.phase !== 'round_end' &&
              state.phase !== 'game_over';
            const isWinner = state.lastWinners.includes(p.id);
            const showPrivate = isViewer || p.revealedHandOnEnd;
            const visibleSum = showPrivate ? getHandSum(p.hand) : null;
            const isBusted = visibleSum !== null && visibleSum > state.targetLimit;

            return (
              <div
                key={p.id}
                className={`hs-player-card ${isTurn ? 'is-turn' : ''} ${
                  p.folded ? 'is-folded' : ''
                } ${p.eliminated ? 'is-eliminated' : ''} ${
                  isWinner ? 'is-winner' : ''
                }`}
              >
                <div className="hs-p-head">
                  <div className="hs-p-name">
                    {p.isAI ? <Bot size={14} /> : <User size={14} />}
                    <span>{p.name}</span>
                    {state.dealerIndex === p.id && (
                      <span className="hs-dealer-badge">선</span>
                    )}
                    {isViewer && <span className="hs-me-badge">나</span>}
                  </div>
                  <div className="hs-p-chips">
                    <Coins size={13} />
                    <strong>{p.chips}</strong>
                  </div>
                </div>

                <div className="hs-p-meta">
                  <span>라운드 베팅: {p.roundBet}칩</span>
                  {p.eliminated ? (
                    <span className="hs-status-tag tag-out">탈락</span>
                  ) : p.folded ? (
                    <span className="hs-status-tag tag-fold">FOLD</span>
                  ) : p.stayed && state.phase === 'hit_stay' ? (
                    <span className="hs-status-tag tag-stay">STAY</span>
                  ) : null}
                  {visibleSum !== null && !p.eliminated && (
                    <span className={`hs-sum-badge ${isBusted ? 'is-bust' : ''}`}>
                      합 {visibleSum} ({p.hand.length}장)
                      {isBusted ? ' 버스트!' : ''}
                    </span>
                  )}
                </div>

                {/* Hand Cards */}
                <div className="hs-hand-row">
                  {p.hand.map((c) => {
                    const visible = c.faceUp || showPrivate;
                    const clickableReveal =
                      canInteract &&
                      state.phase === 'reveal_one' &&
                      p.id === state.currentPlayer &&
                      !p.hasRevealedInitial;

                    return (
                      <button
                        type="button"
                        key={c.id}
                        disabled={!clickableReveal}
                        onClick={() =>
                          clickableReveal &&
                          applyAndSync((s) => revealInitialCard(s, p.id, c.id))
                        }
                        className={`hs-card ${visible ? 'is-faceup' : 'is-facedown'} ${
                          c.faceUp ? 'is-public' : ''
                        } ${c.value === -1 && visible ? 'is-neg' : ''} ${
                          clickableReveal ? 'is-pickable' : ''
                        }`}
                      >
                        {visible ? (
                          <>
                            <span className="hs-card-val">
                              {c.value > 0 ? `+${c.value}` : c.value}
                            </span>
                            <span className="hs-card-tag">
                              {c.faceUp ? '공개' : '비공개'}
                            </span>
                          </>
                        ) : (
                          <span className="hs-card-back">?</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Show / Muck toggle on round_end for this player */}
                {state.phase === 'round_end' && isViewer && !p.eliminated && (
                  <button
                    type="button"
                    className="hs-show-toggle"
                    onClick={() => applyAndSync((s) => toggleShowHandOnEnd(s, p.id))}
                  >
                    {p.revealedHandOnEnd ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>
                      {p.revealedHandOnEnd ? '내 패 숨기기 (Muck)' : '내 패 공개하기 (Show)'}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Bar */}
        <div className="hs-action-bar">
          {state.phase === 'reveal_one' && canInteract && (
            <div className="hs-action-hint">
              위 내 패 3장 중 모두에게 공개할 카드 1장을 클릭하세요.
            </div>
          )}

          {(state.phase === 'bet1' || state.phase === 'bet2') && canInteract && (
            <div className="hs-bet-buttons">
              <button
                type="button"
                className="hs-act-btn btn-call"
                onClick={() => applyAndSync((s) => performBetAction(s, 'call'))}
              >
                {toCall === 0 ? '체크 (Check)' : `콜 (Call +${toCall}칩)`}
              </button>
              {[1, 2, 5].map((inc) =>
                maxRaiseAdd >= inc ? (
                  <button
                    key={inc}
                    type="button"
                    className="hs-act-btn btn-raise"
                    onClick={() =>
                      applyAndSync((s) => performBetAction(s, 'raise', inc))
                    }
                  >
                    레이즈 +{inc}
                  </button>
                ) : null
              )}
              <button
                type="button"
                className="hs-act-btn btn-fold"
                onClick={() => applyAndSync((s) => performBetAction(s, 'fold'))}
              >
                포기 (Fold)
              </button>
            </div>
          )}

          {state.phase === 'hit_stay' && canInteract && (
            <div className="hs-bet-buttons">
              <button
                type="button"
                className="hs-act-btn btn-hit"
                disabled={state.deck.length === 0}
                onClick={() => applyAndSync((s) => performHitOrStay(s, 'hit'))}
              >
                HIT (카드 1장 더 받기)
              </button>
              <button
                type="button"
                className="hs-act-btn btn-stay"
                onClick={() => applyAndSync((s) => performHitOrStay(s, 'stay'))}
              >
                STAY (멈추기)
              </button>
            </div>
          )}

          {state.phase === 'round_end' && (
            <div className="hs-round-end-bar">
              <div className="hs-re-summary">{state.lastRoundSummary}</div>
              {(state.mode !== 'online' || myOnlineSeat === 0) && (
                <button
                  type="button"
                  className="start-main-btn"
                  onClick={() => applyAndSync((s) => startNextRound(s))}
                >
                  다음 라운드 시작 (R{state.roundNumber + 1})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent 3 Logs */}
        <div className="wg-logs-strip">
          {state.logs.slice(0, 3).map((l) => (
            <div key={l.id} className="wg-log-line">
              {l.text}
            </div>
          ))}
        </div>

        {/* Online Waiting Modal */}
        {isOnlineWaiting && (
          <div className="modal-backdrop">
            <div className="modal-card online-wait-modal">
              <div className="modal-header">
                <div>
                  <h3>
                    참가자 대기 중 ({joinedCount}/{humanNeeded})
                  </h3>
                  <p className="modal-sub">
                    친구들에게 방 코드 또는 초대 링크를 공유하세요.
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
                  onClick={() => roomCode && copyInvite(roomCode, 'code')}
                >
                  <span className="ab-title-icon">
                    {copied === 'code' ? <Check size={15} /> : <Copy size={15} />}
                    {copied === 'code' ? '복사됨!' : '코드 복사'}
                  </span>
                </button>
                <button
                  type="button"
                  className="action-btn btn-discard"
                  onClick={() => inviteLink && copyInvite(inviteLink, 'link')}
                >
                  <span className="ab-title-icon">
                    {copied === 'link' ? <Check size={15} /> : <Link2 size={15} />}
                    {copied === 'link' ? '복사됨!' : '초대 링크 복사'}
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="wait-cancel-btn"
                onClick={() => {
                  closeSocket();
                  setState(null);
                }}
              >
                취소하고 로비로
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {state.phase === 'game_over' && (
          <div className="modal-backdrop">
            <div className="modal-card">
              <div className="victory-banner">
                <div className="victory-trophy-ring">
                  <Trophy size={28} />
                </div>
                <div className="vb-type">최후의 생존자!</div>
                <h2>
                  {state.winner !== null
                    ? `${state.players[state.winner].name} 우승!`
                    : '게임 종료'}
                </h2>
              </div>
              <div className="gameover-actions">
                <button
                  type="button"
                  className="action-btn btn-build"
                  onClick={() =>
                    applyAndSync((s) =>
                      createInitialHitStayState({
                        mode: s.mode,
                        seats: s.players.map((p) => ({ name: p.name, isAI: p.isAI })),
                        showDeckCounter: s.showDeckCounter,
                      })
                    )
                  }
                >
                  <span className="ab-title-icon">
                    <RotateCcw size={15} />
                    다시 하기
                  </span>
                </button>
                <button
                  type="button"
                  className="action-btn btn-discard"
                  onClick={() => {
                    closeSocket();
                    setState(null);
                  }}
                >
                  <span className="ab-title-icon">
                    <Home size={15} />
                    로비로
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showRules && <HitStayRulesModal onClose={() => setShowRules(false)} />}
      </div>
    </div>
  );
};

const HitStayRulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-card wide-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3 className="ab-title-icon">
          <BookOpen size={18} />
          힛 &amp; 스테이 (Hit &amp; Stay) 규칙
        </h3>
        <button type="button" className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="rules-body">
        <p>
          <strong>1. 기본 세팅:</strong> 2~4인 생존 포커 (초기 칩 <strong>40개</strong>). 덱은 총{' '}
          <strong>35장</strong> (<code>-1×7, 1×7, 2×6, 3×5, 4×4, 5×3, 6×2, 7×1</code>)이며 쓴 카드는 덱에 다시 넣지 않고 돌립니다.
        </p>
        <p>
          <strong>2. 라운드 진행 (5단계):</strong>
        </p>
        <ul>
          <li>
            <strong>기본 베팅(Ante):</strong> 전원 1칩 투입 (10라운드마다 +1칩 증가)
          </li>
          <li>
            <strong>한계 숫자 &amp; 배분:</strong> 8면체 주사위(<strong>5~12</strong>)로 목표 상한을 정하고, 각자 3장 받은 뒤 <strong>1장 공개</strong>
          </li>
          <li>
            <strong>1차 베팅:</strong> 콜/레이즈/포기. 라운드 총 베팅 상한은 <strong>현재 생존자 중 최소 칩 보유자</strong> 기준!
          </li>
          <li>
            <strong>HIT / STAY:</strong> HIT 시 1장 추가(즉시 공개, 버스트해도 블러핑 가능!), 전원 STAY 또는 덱 소진까지 진행
          </li>
          <li>
            <strong>2차 베팅 &amp; 쇼다운:</strong> 비공개 2장을 모두 열어 승부!
          </li>
        </ul>
        <p>
          <strong>3. 승패 &amp; 동점 판정:</strong> 한계 숫자를 넘지 않으면서 가장 가까운 합이 승리! 동점이면{' '}
          <strong>카드 장수가 더 많은 쪽</strong>이 승리하며, 장수까지 같으면 팟을 균등 분배(자투리 칩은 선에 가까운 쪽)합니다. 전원 버스트 시에도 팟 균등 분배!
        </p>
      </div>
    </div>
  </div>
);
