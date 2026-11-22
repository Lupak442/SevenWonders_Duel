import React, { useState } from 'react';
import { BookOpen, Bot, Globe, Grid3X3, Landmark, Plus, Shield, Sparkles, Swords, Users } from 'lucide-react';
import { AIDifficulty } from '../engine/types';

interface LobbyProps {
  onStartAI: (
    difficulty: AIDifficulty,
    playerName: string,
    firstPlayer: 0 | 1 | 'random'
  ) => void;
  onStartLocal: (
    p0Name: string,
    p1Name: string,
    firstPlayer: 0 | 1 | 'random'
  ) => void;
  onCreateOnline: (serverUrl: string, playerName: string) => void;
  onJoinOnline: (serverUrl: string, roomCode: string, playerName: string) => void;
  onOpenRules: () => void;
  onSwitchToWallGo: () => void;
  onlineStatus: string | null;
}

function getDefaultServerUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8080';
  const { protocol, hostname, port, host } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  // During local Vite dev (port 5173), WebSocket server runs on 8080
  if (port === '5173') {
    return `ws://${hostname || 'localhost'}:8080`;
  }
  // In production (Render / integrated server), WebSocket shares the same host & port
  return `${wsProto}//${host}`;
}

export const Lobby: React.FC<LobbyProps> = ({
  onStartAI,
  onStartLocal,
  onCreateOnline,
  onJoinOnline,
  onOpenRules,
  onSwitchToWallGo,
  onlineStatus,
}) => {
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const [firstPlayer, setFirstPlayer] = useState<0 | 1 | 'random'>('random');
  const [playerName, setPlayerName] = useState('플레이어 1');
  const [p2Name, setP2Name] = useState('플레이어 2');
  const [serverUrl, setServerUrl] = useState(getDefaultServerUrl);
  const initialRoomParam =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().trim()
      : '';
  const [roomCode, setRoomCode] = useState(initialRoomParam);
  const [tab, setTab] = useState<'ai' | 'local' | 'online'>(
    initialRoomParam ? 'online' : 'ai'
  );

  return (
    <div className="lobby-screen">
      <button
        type="button"
        className="wg-top-switch-btn"
        onClick={onSwitchToWallGo}
      >
        <Grid3X3 size={15} />
        <span>벽바둑 2 하기</span>
      </button>
      <div className="lobby-ambient-glow" aria-hidden="true" />
      <div className="lobby-card">
        <div className="lobby-badge-row">
          <span className="lobby-season-pill">
            <Sparkles size={12} />
            LIVE EDITION
          </span>
        </div>

        <div className="lobby-emblem-wrap">
          <div className="lobby-emblem-ring">
            <Landmark size={34} strokeWidth={1.8} />
          </div>
        </div>

        <h1 className="lobby-title">7 WONDERS DUEL</h1>
        <p className="lobby-subtitle">고대 문명의 패권을 건 1:1 전략 카드 듀얼</p>

        <div className="lobby-divider">
          <span />
          <Shield size={13} />
          <span />
        </div>

        <div className="lobby-tabs" role="tablist">
          <button
            type="button"
            className={`ltab ${tab === 'ai' ? 'active' : ''}`}
            onClick={() => setTab('ai')}
          >
            <Bot size={15} />
            <span>VS 아테나 봇</span>
          </button>
          <button
            type="button"
            className={`ltab ${tab === 'local' ? 'active' : ''}`}
            onClick={() => setTab('local')}
          >
            <Users size={15} />
            <span>로컬 1:1</span>
          </button>
          <button
            type="button"
            className={`ltab ${tab === 'online' ? 'active' : ''}`}
            onClick={() => setTab('online')}
          >
            <Globe size={15} />
            <span>온라인 대전</span>
          </button>
        </div>

        {tab === 'ai' && (
          <div className="lobby-panel">
            <label className="field-label">
              지휘관 이름
              <input
                className="text-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={14}
                placeholder="닉네임을 입력하세요"
              />
            </label>

            <div className="field-label">
              AI 난이도 선택
              <div className="diff-row diff-row-5">
                {(['easy', 'normal', 'hard', 'master', 'grandmaster'] as AIDifficulty[]).map(
                  (d) => (
                    <button
                      type="button"
                      key={d}
                      className={`diff-btn ${d === 'grandmaster' ? 'diff-grandmaster' : ''} ${
                        difficulty === d ? 'active' : ''
                      }`}
                      onClick={() => setDifficulty(d)}
                    >
                      <span className="diff-title">
                        {d === 'easy'
                          ? '입문'
                          : d === 'normal'
                            ? '숙련'
                            : d === 'hard'
                              ? '전설'
                              : d === 'master'
                                ? '신화'
                                : '초월'}
                      </span>
                      <span className="diff-sub">
                        {d === 'easy'
                          ? 'Easy'
                          : d === 'normal'
                            ? 'Normal'
                            : d === 'hard'
                              ? 'Hard'
                              : d === 'master'
                                ? 'Master'
                                : 'AI+'}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="field-label">
              선공 설정 (1시대)
              <div className="diff-row">
                {(['random', 0, 1] as const).map((fp) => (
                  <button
                    type="button"
                    key={String(fp)}
                    className={`diff-btn ${firstPlayer === fp ? 'active' : ''}`}
                    onClick={() => setFirstPlayer(fp)}
                  >
                    <span className="diff-title">
                      {fp === 'random' ? '랜덤' : fp === 0 ? '내가 선공' : '상대 선공'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="start-main-btn"
              onClick={() =>
                onStartAI(difficulty, playerName.trim() || '플레이어 1', firstPlayer)
              }
            >
              <Swords size={18} />
              <span>아테나 봇과 대결 시작</span>
            </button>
          </div>
        )}

        {tab === 'local' && (
          <div className="lobby-panel">
            <label className="field-label">
              플레이어 1 (선공)
              <input
                className="text-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={14}
              />
            </label>
            <label className="field-label">
              플레이어 2
              <input
                className="text-input"
                value={p2Name}
                onChange={(e) => setP2Name(e.target.value)}
                maxLength={14}
              />
            </label>
            <button
              type="button"
              className="start-main-btn"
              onClick={() =>
                onStartLocal(
                  playerName.trim() || '플레이어 1',
                  p2Name.trim() || '플레이어 2',
                  firstPlayer
                )
              }
            >
              <Users size={18} />
              <span>같은 기기에서 1:1 시작</span>
            </button>
          </div>
        )}

        {tab === 'online' && (
          <div className="lobby-panel">
            <label className="field-label">
              내 닉네임
              <input
                className="text-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={14}
              />
            </label>
            <label className="field-label">
              멀티플레이 서버 (WebSocket)
              <input
                className="text-input"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            </label>

            <div className="online-actions">
              <button
                type="button"
                className="start-main-btn"
                onClick={() => onCreateOnline(serverUrl, playerName.trim() || '호스트')}
              >
                <Plus size={18} />
                <span>새 대전방 만들기</span>
              </button>

              <div className="join-row">
                <input
                  className="text-input code-input"
                  placeholder="방 코드 (예: AB12)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button
                  type="button"
                  className="join-btn"
                  disabled={!roomCode.trim()}
                  onClick={() =>
                    onJoinOnline(serverUrl, roomCode.trim(), playerName.trim() || '게스트')
                  }
                >
                  입장
                </button>
              </div>
            </div>

            {onlineStatus && <div className="online-status">{onlineStatus}</div>}
          </div>
        )}

        <button type="button" className="lobby-rules-btn" onClick={onOpenRules}>
          <BookOpen size={15} />
          <span>처음이라면? 카드 · 진보 토큰 · 불가사의 완벽 가이드</span>
        </button>
      </div>
    </div>
  );
};
