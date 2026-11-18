import React from 'react';
import { ChainSymbol, ResourceType, ScienceSymbol } from '../engine/types';

export const RESOURCE_META: Record<
  ResourceType,
  { labelKo: string; color: string; bg: string }
> = {
  wood: { labelKo: '목재', color: '#4ade80', bg: '#14532d' },
  clay: { labelKo: '진흙', color: '#fb923c', bg: '#7c2d12' },
  stone: { labelKo: '석재', color: '#e2e8f0', bg: '#334155' },
  glass: { labelKo: '유리', color: '#38bdf8', bg: '#0c4a6e' },
  papyrus: { labelKo: '파피루스', color: '#fde047', bg: '#713f12' },
};

export const SCIENCE_META: Record<ScienceSymbol, { labelKo: string; emoji: string }> = {
  wheel: { labelKo: '바퀴', emoji: '☸️' },
  mortar: { labelKo: '절구', emoji: '⚗️' },
  compass: { labelKo: '컴퍼스', emoji: '🧭' },
  sundial: { labelKo: '해시계', emoji: '☀️' },
  globe: { labelKo: '혼천의', emoji: '🌐' },
  quill: { labelKo: '깃펜', emoji: '🪶' },
  scales: { labelKo: '천칭(법학)', emoji: '⚖️' },
};

export const CHAIN_LABELS: Record<ChainSymbol, string> = {
  horseshoe: '편자',
  sword: '검',
  tower: '탑',
  target: '과녁',
  helmet: '투구',
  book: '책',
  gear: '톱니',
  harp: '하프',
  lamp: '램프',
  mask: '가면',
  pillar: '기둥',
  moon: '달',
  sun: '태양',
  drop: '물방울',
  temple: '신전',
  vase: '항아리',
  barrel: '오크통',
};

export const CoinIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#facc15" stroke="#a16207" strokeWidth="2" />
    <circle cx="12" cy="12" r="6.5" fill="none" stroke="#fef08a" strokeWidth="1.2" opacity="0.8" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#713f12">
      G
    </text>
  </svg>
);

export const VPIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg" aria-hidden="true">
    <path
      d="M12 2L14.9 8.2L21.6 9.1L16.7 13.8L17.9 20.5L12 17.3L6.1 20.5L7.3 13.8L2.4 9.1L9.1 8.2L12 2Z"
      fill="#60a5fa"
      stroke="#eff6ff"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const ShieldIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg" aria-hidden="true">
    <path
      d="M12 2L4 5.5V11.5C4 16.8 7.4 21.4 12 22.8C16.6 21.4 20 16.8 20 11.5V5.5L12 2Z"
      fill="#ef4444"
      stroke="#fecaca"
      strokeWidth="1.6"
    />
    <path d="M12 5V19.5M7.5 10.5H16.5" stroke="#fee2e2" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const ResourceIcon: React.FC<{ type: ResourceType; size?: number }> = ({
  type,
  size = 13,
}) => {
  if (type === 'wood') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg">
        <path d="M12 2L5 11H9L4 18H20L15 11H19L12 2Z" fill="#4ade80" stroke="#14532d" strokeWidth="1.5" />
        <rect x="10.5" y="18" width="3" height="4" fill="#a16207" />
      </svg>
    );
  }
  if (type === 'clay') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg">
        <rect x="3" y="6" width="18" height="5" rx="1.5" fill="#fb923c" stroke="#7c2d12" strokeWidth="1.4" />
        <rect x="2" y="13" width="9" height="5" rx="1.5" fill="#f97316" stroke="#7c2d12" strokeWidth="1.4" />
        <rect x="13" y="13" width="9" height="5" rx="1.5" fill="#fb923c" stroke="#7c2d12" strokeWidth="1.4" />
      </svg>
    );
  }
  if (type === 'stone') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg">
        <polygon
          points="5,18 3,10 9,5 17,6 21,13 18,19"
          fill="#cbd5e1"
          stroke="#475569"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polyline points="9,5 12,12 18,19" fill="none" stroke="#94a3b8" strokeWidth="1.4" />
      </svg>
    );
  }
  if (type === 'glass') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg">
        <polygon
          points="12,2 20,9 12,22 4,9"
          fill="#38bdf8"
          stroke="#e0f2fe"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polyline points="4,9 12,12 20,9" fill="none" stroke="#bae6fd" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-svg">
      <path
        d="M6 4H17C18.7 4 20 5.3 20 7V18C20 19.1 19.1 20 18 20H7C5.3 20 4 18.7 4 17V6C4 4.9 4.9 4 6 4Z"
        fill="#fde047"
        stroke="#854d0e"
        strokeWidth="1.5"
      />
      <line x1="8" y1="9" x2="16" y2="9" stroke="#a16207" strokeWidth="1.5" />
      <line x1="8" y1="13" x2="15" y2="13" stroke="#a16207" strokeWidth="1.5" />
    </svg>
  );
};

export const ResourceBadge: React.FC<{
  type: ResourceType;
  count?: number;
  size?: 'sm' | 'md';
}> = ({ type, count = 1, size = 'sm' }) => {
  const meta = RESOURCE_META[type];
  return (
    <span
      title={meta.labelKo}
      className={`res-badge res-${type} ${size === 'md' ? 'res-md' : 'res-sm'}`}
      style={{ backgroundColor: meta.bg, borderColor: meta.color, color: meta.color }}
    >
      <ResourceIcon type={type} size={size === 'md' ? 14 : 11} />
      {count > 1 && <span className="res-count">×{count}</span>}
    </span>
  );
};
