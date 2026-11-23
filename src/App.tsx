import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Home,
  Hourglass,
  Landmark,
  ScrollText,
  Swords,
  X,
} from 'lucide-react';
import { ComparisonBar } from './components/ComparisonBar';
import { ConflictTrack } from './components/ConflictTrack';
import { Lobby } from './components/Lobby';
import {
  AgeStarterModal,
  BuildDiscardModal,
  CardActionModal,
  DestroyCardModal,
  GameOverModal,
  OnlineWaitingModal,
  ProgressTokenModal,
  RulesModal,
  WonderDraftModal,
} from './components/Modals';
import { PlayerPanel } from './components/PlayerPanel';
import { PyramidBoard } from './components/PyramidBoard';
import { WallGoApp } from './wallgo/WallGoApp';
import { performAITurn } from './engine/ai';
import {
  buildCardFromDiscard,
  buildCardFromPyramid,
  buildWonderFromPyramid,
  chooseAgeStarter,
  chooseDiscardedProgressToken,
  chooseProgressToken,
  createInitialGameState,
  destroyOpponentCard,
  discardCardFromPyramid,
  pickWonder,
} from './engine/game';
import { AIDifficulty, GameState } from './engine/types';

export function App() {
  const initialHasWg =
    typeof window !== 'undefined' &&
    Boolean(new URLSearchParams(window.location.search).get('wg'));
  const [activeGame, setActiveGame] = useState<'seven' | 'wallgo'>(
    initialHasWg ? 'wallgo' : 'seven'
  );
  const [state, setState] = useState<GameState | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Online state
  const wsRef = useRef<WebSocket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [myOnlineIdx, setMyOnlineIdx] = useState<0 | 1 | null>(null);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<string | null>(null);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setRoomCode(null);
    setMyOnlineIdx(null);
    setOpponentJoined(false);
  }, []);

  const applyAndSync = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        if (next.mode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'sync_state', state: next }));
        }
        return next;
      });
    },
    []
  );

  // AI Turn Loop
  useEffect(() => {
    if (!state) return;
    if (state.phase === 'game_over') return;
    const current = state.players[state.currentPlayer];
    if (!current.isAI) return;

    const timer = window.setTimeout(() => {
      setState((prev) => (prev ? performAITurn(prev) : prev));
    }, 550);

    return () => window.clearTimeout(timer);
  }, [state]);

  // Per-player Elapsed Time Counter (1s tick)
  const isOnlineWaiting =
    state?.mode === 'online' && myOnlineIdx === 0 && !opponentJoined;
  const activePhase = state?.phase;
  useEffect(() => {
    if (!activePhase || activePhase === 'game_over' || isOnlineWaiting) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev || prev.phase === 'game_over') return prev;
        const times: [number, number] = [...prev.playerTimesSec] as [number, number];
        times[prev.currentPlayer] += 1;
        return { ...prev, playerTimesSec: times };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activePhase, isOnlineWaiting]);

  const handleStartAI = (
    difficulty: AIDifficulty,
    playerName: string,
    firstPlayer: 0 | 1 | 'random'
  ) => {
    closeSocket();
    setSelectedSlot(null);
    setState(
      createInitialGameState({
        mode: 'ai',
        aiDifficulty: difficulty,
        p0Name: playerName,
        p1Name: '아테나 봇',
        firstPlayer,
      })
    );
  };

  const handleStartLocal = (
    p0Name: string,
    p1Name: string,
    firstPlayer: 0 | 1 | 'random'
  ) => {
    closeSocket();
    setSelectedSlot(null);
    setState(
      createInitialGameState({
        mode: 'local',
        p0Name,
        p1Name,
        firstPlayer,
      })
    );
  };

  const connectOnline = (
    serverUrl: string,
    onOpen: (ws: WebSocket) => void
  ) => {
    closeSocket();
    setOnlineStatus('서버에 연결 중...');
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onopen = () => onOpen(ws);
    ws.onerror = () => {
      setOnlineStatus('서버 연결 실패. `npm run server`가 실행 중인지 확인하세요.');
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'room_created') {
        setRoomCode(msg.code);
        setMyOnlineIdx(0);
        setOpponentJoined(false);
        setOnlineStatus(`방 생성 완료! 친구에게 코드 [${msg.code}]를 공유하세요.`);
      } else if (msg.type === 'opponent_joined') {
        setOpponentJoined(true);
        setOnlineStatus(null);
        setState((prev) => {
          if (!prev) return prev;
          const oppName = msg.playerName || prev.players[1].name;
          const next: GameState = {
            ...prev,
            players: [
              prev.players[0],
              { ...prev.players[1], name: oppName },
            ],
          };
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'sync_state', state: next }));
          }
          return next;
        });
      } else if (msg.type === 'room_joined') {
        setRoomCode(msg.code);
        setMyOnlineIdx(msg.playerIndex === 0 ? 0 : 1);
        setOpponentJoined(true);
        setState(msg.state);
        setOnlineStatus(null);
      } else if (msg.type === 'state_update') {
        setState(msg.state);
      } else if (msg.type === 'opponent_left') {
        setOnlineStatus('상대방이 나갔습니다.');
      } else if (msg.type === 'error') {
        setOnlineStatus(msg.message);
      }
    };
  };

  const handleCreateOnline = (serverUrl: string, playerName: string) => {
    const initial = createInitialGameState({
      mode: 'online',
      p0Name: playerName,
      p1Name: '상대 플레이어',
      firstPlayer: 'random',
    });
    connectOnline(serverUrl, (ws) => {
      ws.send(JSON.stringify({ type: 'create_room', state: initial }));
      setState(initial);
    });
  };

  const handleJoinOnline = (
    serverUrl: string,
    code: string,
    playerName: string
  ) => {
    connectOnline(serverUrl, (ws) => {
      ws.send(JSON.stringify({ type: 'join_room', code, playerName }));
    });
  };

  if (activeGame === 'wallgo') {
    return <WallGoApp onBackToSevenWonders={() => setActiveGame('seven')} />;
  }

  if (!state) {
    return (
      <>
        <Lobby
          onStartAI={handleStartAI}
          onStartLocal={handleStartLocal}
          onCreateOnline={handleCreateOnline}
          onJoinOnline={handleJoinOnline}
          onOpenRules={() => setShowRules(true)}
          onSwitchToWallGo={() => setActiveGame('wallgo')}
          onlineStatus={onlineStatus}
        />
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </>
    );
  }

  const canInteract =
    state.mode === 'local'
      ? true
      : state.mode === 'ai'
        ? !state.players[state.currentPlayer].isAI
        : state.currentPlayer === myOnlineIdx;

  // In online mode as Player 1, show self on the right/bottom and Player 0 on left/top
  const selfIdx: 0 | 1 = state.mode === 'online' && myOnlineIdx === 1 ? 1 : 0;
  const oppIdx: 0 | 1 = selfIdx === 0 ? 1 : 0;

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="tb-left">
          <span className="tb-logo">
            <Landmark size={18} className="tb-logo-icon" />
            <span>7 WONDERS DUEL</span>
          </span>
          <span className={`age-badge age-badge-${state.age}`}>
            AGE {state.age === 1 ? 'I' : state.age === 2 ? 'II' : 'III'} · 제{state.age}시대
          </span>
          {roomCode && <span className="room-badge">방 코드: {roomCode}</span>}
        </div>

        <div className="tb-center">
          <span className={`turn-banner ${canInteract ? 'your-turn' : 'wait-turn'}`}>
            {state.phase === 'game_over' ? (
              '게임 종료'
            ) : canInteract ? (
              <>
                <Swords size={14} />
                <span>{state.players[state.currentPlayer].name} 차례</span>
              </>
            ) : (
              <>
                <Hourglass size={14} className="spin-slow" />
                <span>{state.players[state.currentPlayer].name} 진행 중...</span>
              </>
            )}
          </span>
        </div>

        <div className="tb-right">
          <button
            type="button"
            className={`tb-btn ${showLogs ? 'is-open' : ''}`}
            onClick={() => setShowLogs((v) => !v)}
          >
            <ScrollText size={14} />
            <span>기록</span>
            <span className="tb-count">{state.logs.length}</span>
          </button>
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

      {/* Sticky Recent 3 Actions Feed (always visible at top while scrolling) */}
      {state.logs.length > 0 && (
        <div className="sticky-action-feed" aria-live="polite">
          {state.logs.slice(0, 3).map((log, idx) => {
            const tag =
              log.text.includes('불가사의')
                ? { label: '불가사의', cls: 'tag-wonder' }
                : log.text.includes('버리고') || log.text.includes('판매')
                  ? { label: '판매', cls: 'tag-sell' }
                  : log.text.includes('건설')
                    ? { label: '건설', cls: 'tag-build' }
                    : log.text.includes('군사') || log.text.includes('패권')
                      ? { label: '군사', cls: 'tag-mil' }
                      : { label: '진행', cls: 'tag-info' };
            const isSelfLog = log.player === selfIdx;
            const isOppLog = log.player === oppIdx;
            return (
              <div
                key={log.id}
                className={`saf-item ${idx === 0 ? 'is-newest' : ''} ${
                  isSelfLog ? 'by-self' : isOppLog ? 'by-opp' : ''
                }`}
              >
                <span className={`saf-badge ${tag.cls}`}>{tag.label}</span>
                <span className="saf-text">{log.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict Track & Progress Tokens */}
      <ConflictTrack state={state} />

      {/* Main 3-Column Arena */}
      <main className="arena-grid">
        <PlayerPanel
          state={state}
          player={state.players[oppIdx]}
          isCurrentTurn={state.currentPlayer === oppIdx}
          isOpponent
        />

        <section className="center-board">
          <ComparisonBar state={state} selfIdx={selfIdx} oppIdx={oppIdx} />

          <PyramidBoard
            state={state}
            canInteract={canInteract && state.phase === 'playing'}
            onSelectSlot={(idx) => setSelectedSlot(idx)}
          />

          <div className="board-footer-info">
            <span className="bf-chip">버려진 카드 {state.discardPile.length}장</span>
            <span className="bf-chip">완공 불가사의 {state.totalWondersBuilt}/7</span>
            <span className="bf-chip">턴 {state.turnCount}</span>
          </div>
        </section>

        <PlayerPanel
          state={state}
          player={state.players[selfIdx]}
          isCurrentTurn={state.currentPlayer === selfIdx}
        />
      </main>

      {/* Collapsible Log Drawer */}
      {showLogs && (
        <div className="log-drawer">
          <div className="log-header">
            <strong>진행 기록</strong>
            <button type="button" className="close-btn" onClick={() => setShowLogs(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="log-list">
            {state.logs.map((l) => (
              <div key={l.id} className="log-item">
                {l.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {state.mode === 'online' && myOnlineIdx === 0 && !opponentJoined && (
        <OnlineWaitingModal
          roomCode={roomCode}
          statusText={onlineStatus}
          onCancel={() => {
            closeSocket();
            setState(null);
          }}
        />
      )}

      {state.phase === 'wonder_draft' &&
        !(state.mode === 'online' && myOnlineIdx === 0 && !opponentJoined) && (
          <WonderDraftModal
            state={state}
            canInteract={canInteract}
            onPickWonder={(wId) => applyAndSync((s) => pickWonder(s, wId))}
          />
        )}

      {selectedSlot !== null && state.phase === 'playing' && canInteract && (
        <CardActionModal
          state={state}
          slotIndex={selectedSlot}
          onBuildCard={() => {
            const idx = selectedSlot;
            setSelectedSlot(null);
            applyAndSync((s) => buildCardFromPyramid(s, idx));
          }}
          onDiscardCard={() => {
            const idx = selectedSlot;
            setSelectedSlot(null);
            applyAndSync((s) => discardCardFromPyramid(s, idx));
          }}
          onBuildWonder={(wId) => {
            const idx = selectedSlot;
            setSelectedSlot(null);
            applyAndSync((s) => buildWonderFromPyramid(s, idx, wId));
          }}
          onClose={() => setSelectedSlot(null)}
        />
      )}

      {state.phase === 'choose_progress' && (
        <ProgressTokenModal
          title="🔬 과학 쌍 완성 — 진보 토큰 선택"
          subtitle={`${state.players[state.currentPlayer].name}이(가) 획득할 진보 토큰을 선택하세요.`}
          tokenIds={state.boardProgressTokens}
          canInteract={canInteract}
          onPick={(tId) => applyAndSync((s) => chooseProgressToken(s, tId))}
        />
      )}

      {state.phase === 'choose_discarded_progress' && (
        <ProgressTokenModal
          title="🏛️ 알렉산드리아 대도서관 — 진보 토큰 선택"
          subtitle="게임에서 제외되었던 진보 토큰 3개 중 1개를 선택하세요."
          tokenIds={state.discardedProgressTokens}
          canInteract={canInteract}
          onPick={(tId) => applyAndSync((s) => chooseDiscardedProgressToken(s, tId))}
        />
      )}

      {state.phase === 'destroy_card' && (
        <DestroyCardModal
          state={state}
          canInteract={canInteract}
          onDestroy={(cid) => applyAndSync((s) => destroyOpponentCard(s, cid))}
        />
      )}

      {state.phase === 'build_discard' && (
        <BuildDiscardModal
          state={state}
          canInteract={canInteract}
          onBuild={(cid) => applyAndSync((s) => buildCardFromDiscard(s, cid))}
        />
      )}

      {state.phase === 'choose_age_starter' && (
        <AgeStarterModal
          state={state}
          canInteract={canInteract}
          onChoose={(starter) => applyAndSync((s) => chooseAgeStarter(s, starter))}
        />
      )}

      {state.phase === 'game_over' && (
        <GameOverModal
          state={state}
          onRestart={() => {
            setSelectedSlot(null);
            applyAndSync((s) =>
              createInitialGameState({
                mode: s.mode,
                aiDifficulty: s.aiDifficulty,
                p0Name: s.players[0].name,
                p1Name: s.players[1].name,
                firstPlayer: s.winner === null ? 'random' : s.winner === 0 ? 1 : 0,
              })
            );
          }}
          onBackToLobby={() => {
            closeSocket();
            setState(null);
          }}
        />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

export default App;
