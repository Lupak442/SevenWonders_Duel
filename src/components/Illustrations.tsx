import React from 'react';
import { CardDef, ScienceSymbol } from '../engine/types';

/**
 * Detailed multi-layered SVG artwork for each card's illustration window.
 */
export const CardArtwork: React.FC<{ card: CardDef }> = ({ card }) => {
  // 1. Brown (Raw Materials): Wood / Clay / Stone
  if (card.color === 'brown') {
    if (card.produces?.wood) {
      return (
        <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
          <defs>
            <linearGradient id="sky-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a2f" />
              <stop offset="100%" stopColor="#3b2618" />
            </linearGradient>
          </defs>
          <rect width="120" height="68" fill="url(#sky-wood)" />
          <circle cx="94" cy="18" r="10" fill="#fde68a" opacity="0.22" />
          <path d="M0 54 Q35 42 70 50 T120 46 L120 68 L0 68 Z" fill="#2d1d12" />
          {/* Pine trees */}
          <polygon points="22,16 10,46 34,46" fill="#166534" />
          <polygon points="22,10 13,34 31,34" fill="#22c55e" opacity="0.85" />
          <rect x="20" y="46" width="4" height="10" fill="#78350f" />

          <polygon points="46,20 35,48 57,48" fill="#14532d" />
          <polygon points="46,14 38,36 54,36" fill="#16a34a" />
          <rect x="44" y="48" width="4" height="8" fill="#78350f" />

          {/* Timber cabin / logs */}
          <rect x="72" y="36" width="30" height="18" rx="2" fill="#7c4a2d" stroke="#d97706" strokeWidth="1" />
          <polygon points="68,36 87,24 106,36" fill="#9a3412" />
          <circle cx="78" cy="52" r="4" fill="#b45309" stroke="#fde68a" strokeWidth="0.8" />
          <circle cx="87" cy="52" r="4" fill="#b45309" stroke="#fde68a" strokeWidth="0.8" />
        </svg>
      );
    }
    if (card.produces?.clay) {
      return (
        <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
          <defs>
            <linearGradient id="sky-clay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#431407" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
          </defs>
          <rect width="120" height="68" fill="url(#sky-clay)" />
          <circle cx="24" cy="20" r="11" fill="#fb923c" opacity="0.28" />
          {/* Riverbank & clay terraces */}
          <path d="M0 46 Q45 36 80 48 T120 42 L120 68 L0 68 Z" fill="#9a3412" />
          <path d="M0 56 Q55 50 120 58 L120 68 L0 68 Z" fill="#0ea5e9" opacity="0.35" />
          {/* Brick Kiln */}
          <path d="M62 52 C62 28, 102 28, 102 52 Z" fill="#c2410c" stroke="#fdba74" strokeWidth="1" />
          <path d="M76 52 C76 39, 88 39, 88 52 Z" fill="#fde047" opacity="0.85" />
          <rect x="20" y="42" width="14" height="6" rx="1" fill="#fb923c" />
          <rect x="24" y="35" width="14" height="6" rx="1" fill="#ea580c" />
        </svg>
      );
    }
    // Stone
    return (
      <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
        <defs>
          <linearGradient id="sky-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>
        <rect width="120" height="68" fill="url(#sky-stone)" />
        {/* Marble Quarry Cliffs */}
        <polygon points="8,58 32,16 58,34 82,12 114,58" fill="#475569" />
        <polygon points="32,16 45,38 20,54" fill="#94a3b8" opacity="0.45" />
        <polygon points="82,12 96,42 66,54" fill="#cbd5e1" opacity="0.4" />
        {/* Cut stone blocks */}
        <rect x="18" y="46" width="22" height="12" rx="1.5" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
        <rect x="44" y="48" width="20" height="10" rx="1.5" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
        <rect x="26" y="36" width="18" height="10" rx="1.5" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
      </svg>
    );
  }

  // 2. Grey (Manufactured Goods): Glass / Papyrus
  if (card.color === 'grey') {
    if (card.produces?.glass) {
      return (
        <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
          <defs>
            <linearGradient id="bg-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0c4a6e" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          <rect width="120" height="68" fill="url(#bg-glass)" />
          <circle cx="60" cy="36" r="24" fill="#38bdf8" opacity="0.16" />
          {/* Glassblower furnace & crystal amphorae */}
          <polygon points="60,12 78,32 60,56 42,32" fill="#38bdf8" opacity="0.75" stroke="#e0f2fe" strokeWidth="1.2" />
          <polygon points="60,12 69,32 60,56" fill="#bae6fd" opacity="0.4" />
          <path d="M25 52 C22 40, 32 34, 30 24 L36 24 C34 34, 44 40, 41 52 Z" fill="#7dd3fc" opacity="0.85" />
          <circle cx="92" cy="40" r="10" fill="#f97316" opacity="0.85" />
          <circle cx="92" cy="40" r="6" fill="#fde047" opacity="0.9" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
        <defs>
          <linearGradient id="bg-pap" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#422006" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <rect width="120" height="68" fill="url(#bg-pap)" />
        {/* Papyrus reeds */}
        <path d="M22 60 Q24 34 20 18 M20 18 L13 24 M20 18 L27 23 M20 18 L20 11" stroke="#4ade80" strokeWidth="1.8" fill="none" />
        <path d="M34 60 Q36 38 33 24 M33 24 L27 29 M33 24 L39 29" stroke="#22c55e" strokeWidth="1.5" fill="none" />
        {/* Illuminated Scroll */}
        <rect x="52" y="16" width="46" height="36" rx="4" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.4" />
        <rect x="48" y="14" width="8" height="40" rx="4" fill="#eab308" stroke="#854d0e" strokeWidth="1" />
        <line x1="62" y1="25" x2="90" y2="25" stroke="#854d0e" strokeWidth="1.6" />
        <line x1="62" y1="32" x2="88" y2="32" stroke="#a16207" strokeWidth="1.4" />
        <line x1="62" y1="39" x2="82" y2="39" stroke="#a16207" strokeWidth="1.4" />
      </svg>
    );
  }

  // 3. Red (Military)
  if (card.color === 'red') {
    return (
      <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
        <defs>
          <linearGradient id="sky-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#450a0a" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
        </defs>
        <rect width="120" height="68" fill="url(#sky-red)" />
        <circle cx="60" cy="24" r="22" fill="#ef4444" opacity="0.2" />
        {/* Fortress Battlements */}
        <path
          d="M14 58 L14 30 L24 30 L24 36 L34 36 L34 22 L46 22 L46 30 L74 30 L74 22 L86 22 L86 36 L96 36 L96 30 L106 30 L106 58 Z"
          fill="#2a0a0a"
          stroke="#fca5a5"
          strokeWidth="0.9"
        />
        {/* Gate */}
        <path d="M52 58 L52 44 C52 38, 68 38, 68 44 L68 58 Z" fill="#f97316" opacity="0.7" />
        {/* Crossed Spears */}
        <line x1="36" y1="14" x2="84" y2="48" stroke="#fde047" strokeWidth="1.8" />
        <line x1="84" y1="14" x2="36" y2="48" stroke="#fde047" strokeWidth="1.8" />
      </svg>
    );
  }

  // 4. Green (Science)
  if (card.color === 'green') {
    return (
      <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
        <defs>
          <linearGradient id="sky-sci" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#052e16" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
        </defs>
        <rect width="120" height="68" fill="url(#sky-sci)" />
        {/* Starry sky & Geometric rings */}
        <circle cx="20" cy="14" r="1.2" fill="#bbf7d0" />
        <circle cx="96" cy="18" r="1.5" fill="#fde047" />
        <circle cx="84" cy="10" r="1" fill="#bbf7d0" />
        <circle cx="60" cy="34" r="22" fill="none" stroke="#4ade80" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
        {/* Observatory Dome */}
        <path d="M36 56 L36 40 C36 24, 84 24, 84 40 L84 56 Z" fill="#064e3b" stroke="#6ee7b7" strokeWidth="1.2" />
        <ellipse cx="60" cy="40" rx="24" ry="4" fill="#10b981" opacity="0.35" />
        <line x1="60" y1="26" x2="78" y2="12" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // 5. Yellow (Commerce)
  if (card.color === 'yellow') {
    return (
      <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
        <defs>
          <linearGradient id="sky-yel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>
        <rect width="120" height="68" fill="url(#sky-yel)" />
        <circle cx="88" cy="20" r="13" fill="#fde047" opacity="0.35" />
        {/* Sea waves */}
        <path d="M0 50 Q15 45 30 50 T60 50 T90 50 T120 50 L120 68 L0 68 Z" fill="#0369a1" opacity="0.7" />
        {/* Merchant Ship */}
        <path d="M30 46 L90 46 L78 56 L42 56 Z" fill="#78350f" stroke="#fde047" strokeWidth="1" />
        <line x1="60" y1="14" x2="60" y2="46" stroke="#fef08a" strokeWidth="1.6" />
        <path d="M60 16 Q82 26 60 40 Z" fill="#fef08a" opacity="0.9" />
        <path d="M60 20 Q42 28 60 38 Z" fill="#fde047" opacity="0.75" />
      </svg>
    );
  }

  // 6. Blue (Civic)
  if (card.color === 'blue') {
    return (
      <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
        <defs>
          <linearGradient id="sky-blue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#172554" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
        </defs>
        <rect width="120" height="68" fill="url(#sky-blue)" />
        <circle cx="60" cy="28" r="24" fill="#60a5fa" opacity="0.22" />
        {/* Classical Marble Temple / Parthenon */}
        <polygon points="22,26 60,10 98,26" fill="#e2e8f0" stroke="#93c5fd" strokeWidth="1" />
        <rect x="26" y="26" width="68" height="4" fill="#cbd5e1" />
        <rect x="30" y="30" width="6" height="24" fill="#f8fafc" />
        <rect x="44" y="30" width="6" height="24" fill="#f8fafc" />
        <rect x="57" y="30" width="6" height="24" fill="#f8fafc" />
        <rect x="70" y="30" width="6" height="24" fill="#f8fafc" />
        <rect x="84" y="30" width="6" height="24" fill="#f8fafc" />
        <rect x="20" y="54" width="80" height="5" fill="#94a3b8" />
      </svg>
    );
  }

  // 7. Purple (Guild)
  return (
    <svg viewBox="0 0 120 68" className="card-art-svg" aria-hidden="true">
      <defs>
        <linearGradient id="sky-pur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2e1065" />
          <stop offset="100%" stopColor="#581c87" />
        </linearGradient>
      </defs>
      <rect width="120" height="68" fill="url(#sky-pur)" />
      <circle cx="60" cy="30" r="22" fill="#d8b4fe" opacity="0.18" />
      {/* Grand Guild Dome & Arches */}
      <path d="M32 56 L32 34 C32 16, 88 16, 88 34 L88 56 Z" fill="#3b0764" stroke="#e9d5ff" strokeWidth="1.2" />
      <circle cx="60" cy="24" r="6" fill="#fde047" opacity="0.85" />
      <path d="M44 56 L44 42 C44 36, 54 36, 54 42 L54 56 Z" fill="#a855f7" opacity="0.55" />
      <path d="M66 56 L66 42 C66 36, 76 36, 76 42 L76 56 Z" fill="#a855f7" opacity="0.55" />
    </svg>
  );
};

/**
 * Detailed Neo-Classic painterly artwork for all 12 Wonders.
 */
export const WonderArtwork: React.FC<{ wonderId: string; compact?: boolean }> = ({
  wonderId,
  compact = false,
}) => {
  return (
    <img
      src={`/assets/wonders/${wonderId}.jpg`}
      alt=""
      className={compact ? 'wonder-art-img is-compact' : 'wonder-art-img'}
      loading="lazy"
    />
  );
};

/**
 * Detailed ornate SVG medallions for all 7 Science Symbols.
 */
export const ScienceIcon: React.FC<{ symbol: ScienceSymbol; size?: number }> = ({
  symbol,
  size = 24,
}) => {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="inline-svg" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#064e3b" stroke="#4ade80" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="#a7f3d0" strokeWidth="0.7" opacity="0.5" />
      {symbol === 'wheel' && (
        <g stroke="#fde047" strokeWidth="1.6" fill="none">
          <circle cx="16" cy="16" r="7" />
          <circle cx="16" cy="16" r="2" fill="#fde047" />
          <line x1="16" y1="9" x2="16" y2="23" />
          <line x1="9" y1="16" x2="23" y2="16" />
          <line x1="11" y1="11" x2="21" y2="21" />
          <line x1="21" y1="11" x2="11" y2="21" />
        </g>
      )}
      {symbol === 'mortar' && (
        <g fill="#fde047">
          <path d="M9 15 H23 C22 21, 19 23, 16 23 C13 23, 10 21, 9 15 Z" />
          <line x1="17" y1="15" x2="22" y2="8" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
      {symbol === 'compass' && (
        <g stroke="#fde047" strokeWidth="1.7" fill="none" strokeLinecap="round">
          <circle cx="16" cy="10" r="2" fill="#fde047" />
          <line x1="16" y1="12" x2="10" y2="23" />
          <line x1="16" y1="12" x2="22" y2="23" />
          <path d="M12 18 Q16 20 20 18" stroke="#86efac" strokeWidth="1.3" />
        </g>
      )}
      {symbol === 'sundial' && (
        <g stroke="#fde047" strokeWidth="1.5" fill="none">
          <path d="M8 20 A8 8 0 0 1 24 20 Z" fill="#10b981" opacity="0.35" />
          <line x1="16" y1="20" x2="21" y2="11" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="20" x2="24" y2="20" />
        </g>
      )}
      {symbol === 'globe' && (
        <g stroke="#fde047" strokeWidth="1.4" fill="none">
          <circle cx="16" cy="16" r="7" />
          <ellipse cx="16" cy="16" rx="3.5" ry="7" />
          <line x1="9" y1="16" x2="23" y2="16" />
          <line x1="16" y1="23" x2="16" y2="25.5" />
        </g>
      )}
      {symbol === 'quill' && (
        <g fill="none" stroke="#fef08a" strokeWidth="1.6" strokeLinecap="round">
          <path d="M10 22 C12 14, 17 9, 23 8 C22 14, 18 19, 10 22 Z" fill="#fde047" opacity="0.85" />
          <line x1="9" y1="24" x2="20" y2="11" stroke="#78350f" strokeWidth="1.2" />
        </g>
      )}
      {symbol === 'scales' && (
        <g stroke="#fde047" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <line x1="16" y1="9" x2="16" y2="23" />
          <line x1="10" y1="12" x2="22" y2="12" />
          <path d="M8 18 L10 12 L12 18 Z" fill="#fef08a" opacity="0.8" />
          <path d="M20 18 L22 12 L24 18 Z" fill="#fef08a" opacity="0.8" />
          <line x1="12" y1="23" x2="20" y2="23" />
        </g>
      )}
    </svg>
  );
};
