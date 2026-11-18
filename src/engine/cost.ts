import { CARDS, WONDERS } from './cards';
import { CardDef, PlayerState, ResourceType, WonderDef } from './types';

export const ALL_RESOURCES: ResourceType[] = ['wood', 'clay', 'stone', 'glass', 'papyrus'];

export function getFixedProduction(player: PlayerState): Record<ResourceType, number> {
  const prod: Record<ResourceType, number> = {
    wood: 0,
    clay: 0,
    stone: 0,
    glass: 0,
    papyrus: 0,
  };
  for (const cardId of player.cards) {
    const card = CARDS[cardId];
    if (card?.produces) {
      for (const r of ALL_RESOURCES) {
        prod[r] += card.produces[r] ?? 0;
      }
    }
  }
  return prod;
}

export function getFlexibleProducers(player: PlayerState): ResourceType[][] {
  const flex: ResourceType[][] = [];
  for (const cardId of player.cards) {
    const card = CARDS[cardId];
    if (card?.flexibleProduces) {
      flex.push(card.flexibleProduces);
    }
  }
  for (const w of player.wonders) {
    if (w.built) {
      const wonder = WONDERS[w.wonderId];
      if (wonder?.flexibleProduces) {
        flex.push(wonder.flexibleProduces);
      }
    }
  }
  return flex;
}

export function getTradingDiscounts(player: PlayerState): Set<ResourceType> {
  const set = new Set<ResourceType>();
  for (const cardId of player.cards) {
    const card = CARDS[cardId];
    if (card?.tradingDiscount) {
      for (const r of card.tradingDiscount) {
        set.add(r);
      }
    }
  }
  return set;
}

export function getUnitTradeCost(
  buyer: PlayerState,
  opponent: PlayerState,
  resource: ResourceType
): number {
  const discounts = getTradingDiscounts(buyer);
  if (discounts.has(resource)) return 1;
  const oppFixed = getFixedProduction(opponent);
  return 2 + oppFixed[resource];
}

export interface CostResult {
  canAfford: boolean;
  totalCoins: number;
  tradeCoins: number;
  baseCoins: number;
  freeByChain: boolean;
}

export function hasChainForCard(player: PlayerState, card: CardDef): boolean {
  if (!card.chainFrom) return false;
  return player.cards.some((cid) => CARDS[cid]?.chainTo === card.chainFrom);
}

/**
 * Computes the exact minimum coin cost to pay a resource requirement,
 * accounting for fixed production, flexible production, and optional
 * resource discount (e.g. Architecture/Masonry = 2 any resources).
 */
export function computeResourceTradeCost(
  player: PlayerState,
  opponent: PlayerState,
  req: Partial<Record<ResourceType, number>>,
  freeResourceDiscount = 0
): number {
  const fixed = getFixedProduction(player);
  const missing: Record<ResourceType, number> = {
    wood: Math.max(0, (req.wood ?? 0) - fixed.wood),
    clay: Math.max(0, (req.clay ?? 0) - fixed.clay),
    stone: Math.max(0, (req.stone ?? 0) - fixed.stone),
    glass: Math.max(0, (req.glass ?? 0) - fixed.glass),
    papyrus: Math.max(0, (req.papyrus ?? 0) - fixed.papyrus),
  };

  const unitCost: Record<ResourceType, number> = {
    wood: getUnitTradeCost(player, opponent, 'wood'),
    clay: getUnitTradeCost(player, opponent, 'clay'),
    stone: getUnitTradeCost(player, opponent, 'stone'),
    glass: getUnitTradeCost(player, opponent, 'glass'),
    papyrus: getUnitTradeCost(player, opponent, 'papyrus'),
  };

  const flexList = getFlexibleProducers(player);

  let bestCost = Infinity;

  function applyDiscountAndSum(rem: Record<ResourceType, number>): number {
    // Greedily apply freeResourceDiscount to the most expensive missing resources
    const items: number[] = [];
    for (const r of ALL_RESOURCES) {
      for (let i = 0; i < rem[r]; i++) {
        items.push(unitCost[r]);
      }
    }
    items.sort((a, b) => b - a);
    let sum = 0;
    for (let i = freeResourceDiscount; i < items.length; i++) {
      sum += items[i];
    }
    return sum;
  }

  function dfs(idx: number, rem: Record<ResourceType, number>) {
    if (idx === flexList.length) {
      const cost = applyDiscountAndSum(rem);
      if (cost < bestCost) bestCost = cost;
      return;
    }
    const options = flexList[idx];
    let usedAny = false;
    for (const r of options) {
      if (rem[r] > 0) {
        usedAny = true;
        rem[r]--;
        dfs(idx + 1, rem);
        rem[r]++;
      }
    }
    if (!usedAny) {
      dfs(idx + 1, rem);
    }
  }

  dfs(0, { ...missing });
  return bestCost;
}

export function getCardBuildCost(
  player: PlayerState,
  opponent: PlayerState,
  card: CardDef
): CostResult {
  if (hasChainForCard(player, card)) {
    return {
      canAfford: true,
      totalCoins: 0,
      tradeCoins: 0,
      baseCoins: 0,
      freeByChain: true,
    };
  }

  const baseCoins = card.cost.coins ?? 0;
  const discount =
    card.color === 'blue' && player.progressTokens.includes('pt_masonry') ? 2 : 0;
  const tradeCoins = card.cost.resources
    ? computeResourceTradeCost(player, opponent, card.cost.resources, discount)
    : 0;
  const totalCoins = baseCoins + tradeCoins;

  return {
    canAfford: player.coins >= totalCoins,
    totalCoins,
    tradeCoins,
    baseCoins,
    freeByChain: false,
  };
}

export function getWonderBuildCost(
  player: PlayerState,
  opponent: PlayerState,
  wonder: WonderDef
): CostResult {
  const discount = player.progressTokens.includes('pt_architecture') ? 2 : 0;
  const tradeCoins = computeResourceTradeCost(player, opponent, wonder.cost, discount);
  return {
    canAfford: player.coins >= tradeCoins,
    totalCoins: tradeCoins,
    tradeCoins,
    baseCoins: 0,
    freeByChain: false,
  };
}
