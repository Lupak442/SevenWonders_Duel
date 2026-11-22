import React from 'react';
import { Clock, Coins, FlaskConical, Landmark, Sparkles } from 'lucide-react';
import { ALL_RESOURCES, getFixedProduction } from '../engine/cost';
import {
  calculateScore,
  getDistinctScienceCount,
  getScienceSymbolCounts,
} from '../engine/scoring';
import { GameState, ScienceSymbol } from '../engine/types';
import { RESOURCE_META } from './Icons';
import { ScienceIcon } from './Illustrations';

interface ComparisonBarProps {
  state: GameState;
  selfIdx: 0 | 1;
  oppIdx: 0 | 1;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const ComparisonBar: React.FC<ComparisonBarProps> = ({
  state,
  selfIdx,
  oppIdx,
}) => {
  const self = state.players[selfIdx];
  const opp = state.players[oppIdx];

  const selfScore = calculateScore(state, selfIdx).total;
  const oppScore = calculateScore(state, oppIdx).total;

  const selfProd = getFixedProduction(self);
  const oppProd = getFixedProduction(opp);

  const selfSciMap = getScienceSymbolCounts(self);
  const oppSciMap = getScienceSymbolCounts(opp);
  const selfSciDistinct = getDistinctScienceCount(self);
  const oppSciDistinct = getDistinctScienceCount(opp);

  const selfSciList = (Object.entries(selfSciMap) as [ScienceSymbol, number][]).filter(
    ([, c]) => c > 0
  );
  const oppSciList = (Object.entries(oppSciMap) as [ScienceSymbol, number][]).filter(
    ([, c]) => c > 0
  );

  const selfUnbuilt = self.wonders.filter((w) => !w.built).length;
  const oppUnbuilt = opp.wonders.filter((w) => !w.built).length;

  return (
    <div className="comparison-bar">
      {/* Self Summary */}
      <div className="cmp-side cmp-self">
        <div className="cmp-top-row">
          <span className="cmp-name self-tag">{self.name} (나)</span>
          <span className="cmp-stat">
            <Sparkles size={11} /> {selfScore}점
          </span>
          <span className="cmp-stat gold">
            <Coins size={11} /> {self.coins}
          </span>
          <span className="cmp-stat" title="미완공 불가사의">
            <Landmark size={11} /> {selfUnbuilt}
          </span>
          <span className="cmp-stat time" title="누적 사용 시간 (동점 시 짧은 쪽 승리)">
            <Clock size={11} /> {formatTime(state.playerTimesSec?.[selfIdx] ?? 0)}
          </span>
        </div>

        <div className="cmp-mid-row">
          <div className="cmp-res-strip" title="내 자원 생산량">
            {ALL_RESOURCES.map((r) => (
              <span
                key={r}
                className={`cmp-res-pill ${selfProd[r] === 0 ? 'is-zero' : ''}`}
                style={{
                  borderColor: RESOURCE_META[r].color,
                  color: RESOURCE_META[r].color,
                }}
              >
                {RESOURCE_META[r].labelKo[0]}
                <b>{selfProd[r]}</b>
              </span>
            ))}
          </div>
          <div className="cmp-sci-strip" title={`과학 ${selfSciDistinct}/6`}>
            <FlaskConical size={11} className="cmp-sci-ic" />
            <span className="cmp-sci-cnt">{selfSciDistinct}/6</span>
            {selfSciList.map(([sym, c]) => (
              <span key={sym} className="cmp-sci-mini">
                <ScienceIcon symbol={sym} size={14} />
                {c > 1 && <em>{c}</em>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="cmp-vs">VS</div>

      {/* Opponent Summary */}
      <div className={`cmp-side cmp-opp ${oppSciDistinct >= 4 ? 'sci-danger' : ''}`}>
        <div className="cmp-top-row">
          <span className="cmp-name opp-tag">{opp.name} (상대)</span>
          <span className="cmp-stat">
            <Sparkles size={11} /> {oppScore}점
          </span>
          <span className="cmp-stat gold">
            <Coins size={11} /> {opp.coins}
          </span>
          <span className="cmp-stat" title="상대 미완공 불가사의">
            <Landmark size={11} /> {oppUnbuilt}
          </span>
          <span className="cmp-stat time" title="상대 누적 사용 시간">
            <Clock size={11} /> {formatTime(state.playerTimesSec?.[oppIdx] ?? 0)}
          </span>
        </div>

        <div className="cmp-mid-row">
          <div className="cmp-res-strip" title="상대 자원 생산량 (많을수록 내 무역비 상승)">
            {ALL_RESOURCES.map((r) => (
              <span
                key={r}
                className={`cmp-res-pill ${oppProd[r] === 0 ? 'is-zero' : ''}`}
                style={{
                  borderColor: RESOURCE_META[r].color,
                  color: RESOURCE_META[r].color,
                }}
              >
                {RESOURCE_META[r].labelKo[0]}
                <b>{oppProd[r]}</b>
              </span>
            ))}
          </div>
          <div className="cmp-sci-strip" title={`상대 과학 ${oppSciDistinct}/6`}>
            <FlaskConical size={11} className="cmp-sci-ic" />
            <span className={`cmp-sci-cnt ${oppSciDistinct >= 4 ? 'danger' : ''}`}>
              {oppSciDistinct}/6
            </span>
            {oppSciList.map(([sym, c]) => (
              <span key={sym} className="cmp-sci-mini">
                <ScienceIcon symbol={sym} size={14} />
                {c > 1 && <em>{c}</em>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
