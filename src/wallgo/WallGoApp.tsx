import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Copy,
  Globe,
  Hammer,
  Home,
  Link2,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { performWallGoAITurn } from './ai';
import {
  computeTerritories,
  createInitialWallGoState,
  getNextPlacementShape,
  getValidMoves,
  getValidWallEdgesForPiece,
  GRID_SIZE,
  isCellOccupied,
  movePiece,
  placeInitialPiece,
  placeWall,
} from './engine';
import { WallEdge, WallGoDifficulty, WallGoState } from './types';
import './wallgo.css';

interface WallGoAppProps {
  onBackToSevenWonders: () => void;
}

function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8080';
  const { protocol, hostname, port, host } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  if (port === '5173') return `ws://${hostname || 'localhost'}:8080`;
  return `${wsProto}//${host}`;
}

const PLAYER_COLORS = ['#38bdf8', '#fb7185', '#facc15'];

export const WallGoApp: React.FC<WallGoAppProps> = ({ onBackToSevenWonders }) => {
  const [state, setState] = useState<WallGoState | null>(null);
  const [showRules, setShowRules] = useState(false);

  // Lobby form state
  const initialRoomParam =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('wg') || '').toUpperCase().trim()
      : '';
  const [tab, setTab] = useState<'ai' | 'local' | 'online'>(
    initialRoomParam ? 'online' : 'ai'
  );
  const [playerCount, setPlayerCount] = useState<2 | 3>(2);
  const [difficulty, setDifficulty] = useState<WallGoDifficulty>('normal');
  const [p1Name, setP1Name] = useState('플레이어 1');
  const [p2Name, setP2Name] = useState('플레이어 2');
  const [p3Name, setP3Name] = useState('플레이어 3');
  const [serverUrl, setServerUrl] = useState(getDefaultWsUrl);
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomParam);

  // Online state
  const wsRef = useRef<WebSocket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [myOnlineIdx, setMyOnlineIdx] = useState<number | null>(null);
  const [joinedCount, setJoinedCount] = useState(1);
  const [onlineStatus, setOnlineStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRoomCode(null);
    setMyOnlineIdx(null);
    setJoinedCount(1);
  }, []);

  const applyAndSync = useCallback((updater: (prev: WallGoState) => WallGoState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      if (next.mode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'sync_state', state: next }));
      }
      return next;
    });
  }, []);

  // AI turn loop
  useEffect(() => {
    if (!state || state.phase === 'game_over') return;
    if (!state.players[state.currentPlayer]?.isAI) return;

    const timer = window.setTimeout(() => {
      setState((prev) => (prev ? performWallGoAITurn(prev) : prev));
    }, 480);
    return () => window.clearTimeout(timer);
  }, [state]);

  const startBotGame = () => {
    closeSocket();
    setState(
      createInitialWallGoState({
        mode: 'ai',
        playerCount,
        difficulty,
        playerNames: [p1Name.trim() || '플레이어 1'],
      })
    );
  };

  const startLocalGame = () => {
    closeSocket();
    setState(
      createInitialWallGoState({
        mode: 'local',
        playerCount,
        playerNames: [
          p1Name.trim() || '플레이어 1',
          p2Name.trim() || '플레이어 2',
          p3Name.trim() || '플레이어 3',
        ],
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
        setMyOnlineIdx(0);
        setJoinedCount(1);
        setOnlineStatus(`방 생성 완료! 코드: ${msg.code}`);
      } else if (msg.type === 'opponent_joined') {
        setJoinedCount(msg.joinedCount ?? 2);
        setState((prev) => {
          if (!prev) return prev;
          const players = prev.players.map((p, i) =>
            i === msg.playerIndex
              ? { ...p, name: msg.playerName || p.name }
              : p
          );
          const next = { ...prev, players };
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'sync_state', state: next }));
          }
          return next;
        });
      } else if (msg.type === 'room_joined') {
        setRoomCode(msg.code);
        setMyOnlineIdx(msg.playerIndex);
        setJoinedCount(msg.joinedCount ?? 2);
        setState(msg.state);
        setOnlineStatus(null);
      } else if (msg.type === 'state_update') {
        setState(msg.state);
      } else if (msg.type === 'opponent_left') {
        setOnlineStatus('참가자 중 한 명이 나갔습니다.');
      } else if (msg.type === 'error') {
        setOnlineStatus(msg.message);
      }
    };
  };

  const createOnlineRoom = () => {
    const initial = createInitialWallGoState({
      mode: 'online',
      playerCount,
      playerNames: [p1Name.trim() || '호스트', '대기 중 2', '대기 중 3'],
      firstPlayer: 'random',
    });
    connectOnline((ws) => {
      ws.send(
        JSON.stringify({
          type: 'create_room',
          maxPlayers: playerCount,
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
          playerName: p1Name.trim() || '게스트',
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
      <div className="wg-lobby-screen">
        <button
          type="button"
          className="wg-top-switch-btn"
          onClick={onBackToSevenWonders}
        >
          <ArrowLeft size={15} />
          <span>7 Wonders로 돌아가기</span>
        </button>

        <div className="lobby-card wg-lobby-card">
          <div className="wg-hero-banner">
            <img
              src="/assets/wallgo/wg-lobby-hero.jpg"
              alt="Wall Go 2"
              className="wg-hero-img"
            />
            <div className="wg-hero-overlay">
              <span className="lobby-season-pill">
                <Sparkles size={12} />
                DEVIL&apos;S PLAN EDITION
              </span>
            </div>
          </div>

          <h1 className="lobby-title">WALL GO 2</h1>
          <p className="lobby-subtitle">벽바둑 2 — 7×7 영토 차단 전략 보드게임</p>

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
              인원 선택
              <div className="diff-row wg-count-row">
                <button
                  type="button"
                  className={`diff-btn ${playerCount === 2 ? 'active' : ''}`}
                  onClick={() => setPlayerCount(2)}
                >
                  <span className="diff-title">2인전</span>
                  <span className="diff-sub">각 4말 (■2 ●2)</span>
                </button>
                <button
                  type="button"
                  className={`diff-btn ${playerCount === 3 ? 'active' : ''}`}
                  onClick={() => setPlayerCount(3)}
                >
                  <span className="diff-title">3인전</span>
                  <span className="diff-sub">각 2말 + 벽 부수기 1회</span>
                </button>
              </div>
            </div>

            <label className="field-label">
              {tab === 'local' ? '플레이어 1 이름' : '내 이름'}
              <input
                className="text-input"
                value={p1Name}
                onChange={(e) => setP1Name(e.target.value)}
                maxLength={12}
              />
            </label>

            {tab === 'ai' && (
              <>
                <div className="field-label">
                  AI 난이도
                  <div className="diff-row">
                    {(['easy', 'normal', 'hard'] as WallGoDifficulty[]).map((d) => (
                      <button
                        type="button"
                        key={d}
                        className={`diff-btn ${difficulty === d ? 'active' : ''}`}
                        onClick={() => setDifficulty(d)}
                      >
                        <span className="diff-title">
                          {d === 'easy' ? '입문' : d === 'normal' ? '숙련' : '전설'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="start-main-btn" onClick={startBotGame}>
                  <Bot size={18} />
                  <span>{playerCount}인 봇전 시작</span>
                </button>
              </>
            )}

            {tab === 'local' && (
              <>
                <label className="field-label">
                  플레이어 2 이름
                  <input
                    className="text-input"
                    value={p2Name}
                    onChange={(e) => setP2Name(e.target.value)}
                    maxLength={12}
                  />
                </label>
                {playerCount === 3 && (
                  <label className="field-label">
                    플레이어 3 이름
                    <input
                      className="text-input"
                      value={p3Name}
                      onChange={(e) => setP3Name(e.target.value)}
                      maxLength={12}
                    />
                  </label>
                )}
                <button type="button" className="start-main-btn" onClick={startLocalGame}>
                  <Users size={18} />
                  <span>{playerCount}인 로컬 매치 시작</span>
                </button>
              </>
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
                <button type="button" className="start-main-btn" onClick={createOnlineRoom}>
                  <span>➕ {playerCount}인 온라인 방 만들기</span>
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
              <span>벽바둑 2 규칙 보기 (사각말 · 원형말 · 벽 부수기)</span>
            </button>
          </div>
        </div>

        {showRules && <WallGoRulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  // ======================== GAME ARENA VIEW ========================
  const isOnlineWaiting =
    state.mode === 'online' && joinedCount < state.playerCount;
  const canInteract =
    !isOnlineWaiting &&
    state.phase !== 'game_over' &&
    (state.mode === 'local'
      ? true
      : state.mode === 'ai'
        ? !state.players[state.currentPlayer]?.isAI
        : state.currentPlayer === myOnlineIdx);

  const terr = computeTerritories(state);
  const currentP = state.players[state.currentPlayer];

  const validMoveTargets =
    canInteract && state.phase === 'move' && state.selectedPieceId
      ? getValidMoves(
          state,
          state.selectedPieceId,
          state.useWallBreak && currentP.wallBreakLeft > 0
        )
      : [];

  const validWallEdges =
    canInteract && state.phase === 'wall' && state.movedPieceId
      ? getValidWallEdgesForPiece(
          state.pieces,
          state.hWalls,
          state.vWalls,
          state.movedPieceId
        )
      : [];

  const isWallValid = (type: 'h' | 'v', r: number, c: number) =>
    validWallEdges.some((e) => e.type === type && e.r === r && e.c === c);

  const handleCellClick = (r: number, c: number) => {
    if (!canInteract) return;
    if (state.phase === 'setup') {
      if (!isCellOccupied(state.pieces, r, c)) {
        applyAndSync((s) => placeInitialPiece(s, r, c));
      }
      return;
    }

    if (state.phase === 'move') {
      const clickedOwn = state.pieces.find(
        (p) => p.row === r && p.col === c && p.owner === state.currentPlayer
      );
      // If clicking a valid destination (including same cell for 0-step stay when already selected)
      if (state.selectedPieceId) {
        const isDest = validMoveTargets.some((t) => t.row === r && t.col === c);
        if (isDest) {
          const pid = state.selectedPieceId;
          applyAndSync((s) => movePiece(s, pid, r, c));
          return;
        }
      }
      if (clickedOwn) {
        const allowBreak = state.useWallBreak && currentP.wallBreakLeft > 0;
        const canMoveThis = getValidMoves(state, clickedOwn.id, allowBreak).length > 0;
        if (!canMoveThis) return;
        setState((prev) =>
          prev
            ? {
                ...prev,
                selectedPieceId:
                  prev.selectedPieceId === clickedOwn.id ? null : clickedOwn.id,
              }
            : prev
        );
      }
    }
  };

  const handleWallClick = (edge: WallEdge) => {
    if (!canInteract || state.phase !== 'wall') return;
    if (!isWallValid(edge.type, edge.r, edge.c)) return;
    applyAndSync((s) => placeWall(s, edge));
  };

  const inviteLink =
    typeof window !== 'undefined' && roomCode
      ? `${window.location.origin}/?wg=${roomCode}`
      : '';

  return (
    <div className="wg-game-bg">
      <div className="app-shell wg-shell">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="tb-left">
          <span className="tb-logo">
            <Shield size={17} className="tb-logo-icon" />
            <span>WALL GO 2</span>
          </span>
          <span className="age-badge age-badge-2">{state.playerCount}인전</span>
          {roomCode && <span className="room-badge">방: {roomCode}</span>}
        </div>

        <div className="tb-center">
          <span className={`turn-banner ${canInteract ? 'your-turn' : 'wait-turn'}`}>
            {state.phase === 'game_over'
              ? '게임 종료'
              : state.phase === 'setup'
                ? `${currentP.name} 말 배치 (${
                    getNextPlacementShape(state, state.currentPlayer) === 'square'
                      ? '사각 ■'
                      : '원형 ●'
                  })`
                : state.phase === 'move'
                  ? `${currentP.name}: 말 이동 (0~2칸)`
                  : `${currentP.name}: 벽 1개 설치`}
          </span>
        </div>

        <div className="tb-right">
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

      {/* Player Score & Wall-Break Bar */}
      <div className="wg-players-bar">
        {state.players.map((p, idx) => {
          const active = state.currentPlayer === idx && state.phase !== 'game_over';
          return (
            <div
              key={p.id}
              className={`wg-player-chip ${active ? 'is-active' : ''}`}
              style={{ borderColor: active ? PLAYER_COLORS[idx] : undefined }}
            >
              <span
                className="wg-color-dot"
                style={{ background: PLAYER_COLORS[idx] }}
              />
              <div className="wg-p-info">
                <strong>
                  {p.name}
                  {myOnlineIdx === idx ? ' (나)' : ''}
                </strong>
                <span>
                  확보 영토 <b>{terr.areas[idx]}</b>칸 (최대 {terr.maxSingle[idx]})
                </span>
              </div>
              {state.playerCount === 3 && (
                <span className={`wg-wb-badge ${p.wallBreakLeft === 0 ? 'used' : ''}`}>
                  <Hammer size={11} />
                  {p.wallBreakLeft > 0 ? '벽부수기 1' : '사용함'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Controls (Wall Break toggle in 3P move phase) */}
      <div className="wg-controls-row">
        {state.playerCount === 3 &&
          state.phase === 'move' &&
          canInteract &&
          currentP.wallBreakLeft > 0 && (
            <button
              type="button"
              className={`wg-wb-toggle ${state.useWallBreak ? 'active' : ''}`}
              onClick={() =>
                setState((prev) =>
                  prev ? { ...prev, useWallBreak: !prev.useWallBreak } : prev
                )
              }
            >
              <Hammer size={14} />
              <span>
                {state.useWallBreak
                  ? '벽 부수기 ON (경로의 벽 1개 파괴 가능)'
                  : '벽 부수기 사용 (1회 남음)'}
              </span>
            </button>
          )}
        <div className="wg-hint-pill">
          {state.phase === 'setup' && '빈 칸을 클릭해 말을 배치하세요.'}
          {state.phase === 'move' &&
            (state.selectedPieceId
              ? '초록색 칸으로 이동하세요. (제자리 불가)'
              : '이동할 내 말(■ +자 2칸 / ● 8방향 1칸)을 클릭하세요.')}
          {state.phase === 'wall' && '반짝이는 경계선을 클릭해 벽 1개를 설치하세요.'}
        </div>
      </div>

      {/* 7x7 Board */}
      <div className="wg-board-wrap">
        <div className="wg-board">
          {Array.from({ length: GRID_SIZE }).map((_, r) => (
            <React.Fragment key={`row-${r}`}>
              <div className="wg-cell-row">
                {Array.from({ length: GRID_SIZE }).map((__, c) => {
                  const piece = state.pieces.find((p) => p.row === r && p.col === c);
                  const ownerTerritory = terr.cellOwner[r][c];
                  const dest = validMoveTargets.find(
                    (t) => t.row === r && t.col === c
                  );
                  const isSelected = piece && piece.id === state.selectedPieceId;
                  const canPlaceHere =
                    canInteract &&
                    state.phase === 'setup' &&
                    !isCellOccupied(state.pieces, r, c);

                  return (
                    <React.Fragment key={`cell-${r}-${c}`}>
                      <button
                        type="button"
                        className={`wg-cell ${
                          ownerTerritory !== null ? `terr-p${ownerTerritory}` : ''
                        } ${dest ? (dest.brokenWall ? 'valid-break' : 'valid-dest') : ''} ${
                          isSelected ? 'is-selected' : ''
                        } ${canPlaceHere ? 'can-place' : ''}`}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {piece && (
                          <span
                            className={`wg-piece shape-${piece.shape} owner-${piece.owner}`}
                            style={{
                              backgroundColor: PLAYER_COLORS[piece.owner],
                            }}
                            title={
                              piece.shape === 'square'
                                ? '사각 말 (직선 이동)'
                                : '원형 말 (꺾기 가능)'
                            }
                          />
                        )}
                      </button>

                      {/* Vertical wall slot between (r, c) and (r, c+1) */}
                      {c < GRID_SIZE - 1 && (
                        <button
                          type="button"
                          aria-label={`세로 벽 ${r}-${c}`}
                          className={`wg-vwall ${
                            state.vWalls[r][c] !== null
                              ? `is-walled wall-p${state.vWalls[r][c]}`
                              : ''
                          } ${isWallValid('v', r, c) ? 'valid-wall' : ''}`}
                          onClick={() => handleWallClick({ type: 'v', r, c })}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Horizontal wall row between r and r+1 */}
              {r < GRID_SIZE - 1 && (
                <div className="wg-hwall-row">
                  {Array.from({ length: GRID_SIZE }).map((__, c) => (
                    <React.Fragment key={`hw-${r}-${c}`}>
                      <button
                        type="button"
                        aria-label={`가로 벽 ${r}-${c}`}
                        className={`wg-hwall ${
                          state.hWalls[r][c] !== null
                            ? `is-walled wall-p${state.hWalls[r][c]}`
                            : ''
                        } ${isWallValid('h', r, c) ? 'valid-wall' : ''}`}
                        onClick={() => handleWallClick({ type: 'h', r, c })}
                      />
                      {c < GRID_SIZE - 1 && <span className="wg-corner" />}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Recent Logs */}
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
                  참가자 대기 중 ({joinedCount}/{state.playerCount})
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
              <div className="vb-type">모든 영토 분리 완료!</div>
              <h2>
                {state.winner !== null
                  ? `${state.players[state.winner].name} 승리!`
                  : '무승부!'}
              </h2>
            </div>

            <table className="score-table">
              <thead>
                <tr>
                  <th>플레이어</th>
                  <th>총 영토</th>
                  <th>최대 단일 영토</th>
                </tr>
              </thead>
              <tbody>
                {state.players.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={state.winner === idx ? 'winner-col' : ''}
                  >
                    <td>{p.name}</td>
                    <td>{terr.areas[idx]}칸</td>
                    <td>{terr.maxSingle[idx]}칸</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="gameover-actions">
              <button
                type="button"
                className="action-btn btn-build"
                onClick={() =>
                  applyAndSync((s) => {
                    const t = computeTerritories(s);
                    let loser: number | 'random' = 'random';
                    if (s.winner !== null) {
                      let minArea = Infinity;
                      let minIdx = 0;
                      for (let i = 0; i < s.playerCount; i++) {
                        if (t.areas[i] < minArea) {
                          minArea = t.areas[i];
                          minIdx = i;
                        }
                      }
                      loser = minIdx;
                    }
                    return createInitialWallGoState({
                      mode: s.mode,
                      playerCount: s.playerCount,
                      difficulty: s.difficulty,
                      playerNames: s.players.map((p) => p.name),
                      firstPlayer: loser,
                    });
                  })
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

      {showRules && <WallGoRulesModal onClose={() => setShowRules(false)} />}
      </div>
    </div>
  );
};

const WallGoRulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-card wide-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3 className="ab-title-icon">
          <BookOpen size={18} />
          벽바둑 2 (Wall Go 2) 규칙
        </h3>
        <button type="button" className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="rules-body">
        <p>
          <strong>1. 목표:</strong> 7×7 격자판에서 말을 이동하고 벽을 세워,{' '}
          <strong>내 말만 포함된 독립 영토(칸 수)</strong>를 가장 넓게 만드는 플레이어가 승리합니다! (동률 시 가장 큰 단일 영토 크기로 판정)
        </p>
        <p>
          <strong>2. 말의 종류 (벽바둑 2 핵심):</strong>
        </p>
        <ul>
          <li>
            <strong>■ 사각 말:</strong> 상·하·좌·우(+자) 직선으로 최대 <strong>2칸</strong> 이동 가능
          </li>
          <li>
            <strong>● 원형 말:</strong> 대각선 포함 <strong>8방향(모든 방향)</strong>으로 최대 <strong>1칸</strong> 이동 가능
          </li>
        </ul>
        <p>
          <strong>3. 턴 진행:</strong> 매 턴 <strong>① 말 1개 이동(0~2칸)</strong> 후{' '}
          <strong>② 이동한 말의 상하좌우 중 빈 변에 벽 1개 설치</strong>를 반드시 수행합니다.
        </p>
        <p>
          <strong>4. 2인전 vs 3인전 차이:</strong>
        </p>
        <ul>
          <li>
            <strong>2인전:</strong> 각자 4말(■2, ●2) 사용, 벽 부수기 없음
          </li>
          <li>
            <strong>3인전:</strong> 각자 2말(■1, ●1) 사용, 게임당 1회 한정{' '}
            <strong>벽 부수기(이동 경로의 벽 1개 파괴)</strong> 사용 가능!
          </li>
        </ul>
      </div>
    </div>
  </div>
);
