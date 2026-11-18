import { CARDS, WONDERS } from './cards';
import { GameState, PlayerState, ScienceSymbol, ScoreBreakdown } from './types';

export function getScienceSymbolCounts(player: PlayerState): Record<ScienceSymbol, number> {
  const counts: Record<ScienceSymbol, number> = {
    wheel: 0,
    mortar: 0,
    compass: 0,
    sundial: 0,
    globe: 0,
    quill: 0,
    scales: 0,
  };
  for (const cid of player.cards) {
    const card = CARDS[cid];
    if (card?.science) {
      counts[card.science]++;
    }
  }
  if (player.progressTokens.includes('pt_law')) {
    counts.scales++;
  }
  return counts;
}

export function getDistinctScienceCount(player: PlayerState): number {
  const counts = getScienceSymbolCounts(player);
  return Object.values(counts).filter((c) => c > 0).length;
}

export function getMilitaryVP(conflictPosition: number, playerIndex: 0 | 1): number {
  const pos = playerIndex === 0 ? conflictPosition : -conflictPosition;
  if (pos <= 0) return 0;
  if (pos <= 2) return 2;
  if (pos <= 5) return 5;
  return 10;
}

export function calculateScore(state: GameState, playerIndex: 0 | 1): ScoreBreakdown {
  const player = state.players[playerIndex];
  const opponent = state.players[playerIndex === 0 ? 1 : 0];

  let blue = 0;
  let green = 0;
  let yellow = 0;
  let purple = 0;

  for (const cid of player.cards) {
    const card = CARDS[cid];
    if (!card) continue;
    if (card.color === 'blue') blue += card.vp ?? 0;
    else if (card.color === 'green') green += card.vp ?? 0;
    else if (card.color === 'yellow') yellow += card.vp ?? 0;
    else if (card.color === 'purple' && card.guildVp) {
      if (card.guildVp.type === 'mostColor' && card.guildVp.colors) {
        const colors = card.guildVp.colors;
        const pCount = player.cards.filter((id) => colors.includes(CARDS[id]?.color)).length;
        const oCount = opponent.cards.filter((id) => colors.includes(CARDS[id]?.color)).length;
        purple += Math.max(pCount, oCount) * card.guildVp.vpPer;
      } else if (card.guildVp.type === 'mostWonders') {
        const pW = player.wonders.filter((w) => w.built).length;
        const oW = opponent.wonders.filter((w) => w.built).length;
        purple += Math.max(pW, oW) * card.guildVp.vpPer;
      } else if (card.guildVp.type === 'coins') {
        const maxCoins = Math.max(player.coins, opponent.coins);
        purple += Math.floor(maxCoins / 3) * card.guildVp.vpPer;
      }
    }
  }

  let wonders = 0;
  for (const w of player.wonders) {
    if (w.built) {
      wonders += WONDERS[w.wonderId]?.vp ?? 0;
    }
  }

  let progress = 0;
  for (const pt of player.progressTokens) {
    if (pt === 'pt_agriculture') progress += 4;
    if (pt === 'pt_philosophy') progress += 7;
    if (pt === 'pt_mathematics') progress += 3 * player.progressTokens.length;
  }

  const military = getMilitaryVP(state.conflictPosition, playerIndex);
  const coins = Math.floor(player.coins / 3);
  const total = blue + green + yellow + purple + wonders + progress + military + coins;

  return { blue, green, yellow, purple, wonders, progress, military, coins, total };
}
