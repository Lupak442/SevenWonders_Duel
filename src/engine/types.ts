export type ResourceType = 'wood' | 'clay' | 'stone' | 'glass' | 'papyrus';

export type CardColor = 'brown' | 'grey' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';

export type ScienceSymbol =
  | 'wheel'
  | 'mortar'
  | 'compass'
  | 'sundial'
  | 'globe'
  | 'quill'
  | 'scales';

export type ChainSymbol =
  | 'horseshoe'
  | 'sword'
  | 'tower'
  | 'target'
  | 'helmet'
  | 'book'
  | 'gear'
  | 'harp'
  | 'lamp'
  | 'mask'
  | 'pillar'
  | 'moon'
  | 'sun'
  | 'drop'
  | 'temple'
  | 'vase'
  | 'barrel';

export interface CardCost {
  coins?: number;
  resources?: Partial<Record<ResourceType, number>>;
}

export interface CardDef {
  id: string;
  name: string;
  nameKo: string;
  age: 1 | 2 | 3;
  color: CardColor;
  cost: CardCost;
  chainFrom?: ChainSymbol;
  chainTo?: ChainSymbol;
  produces?: Partial<Record<ResourceType, number>>;
  flexibleProduces?: ResourceType[];
  vp?: number;
  shields?: number;
  science?: ScienceSymbol;
  coins?: number;
  tradingDiscount?: ResourceType[];
  coinsPerCard?: {
    target: 'self' | 'maxBoth';
    colors: CardColor[];
    amount: number;
    includeWonders?: boolean;
  };
  guildVp?: {
    type: 'mostColor' | 'mostWonders' | 'coins';
    colors?: CardColor[];
    vpPer: number;
  };
}

export interface WonderDef {
  id: string;
  name: string;
  nameKo: string;
  cost: Partial<Record<ResourceType, number>>;
  vp?: number;
  shields?: number;
  coins?: number;
  opponentLoseCoins?: number;
  flexibleProduces?: ResourceType[];
  playAgain?: boolean;
  destroyOpponentCard?: 'brown' | 'grey';
  buildFromDiscard?: boolean;
  drawDiscardedProgress?: boolean;
  descriptionKo: string;
}

export interface ProgressTokenDef {
  id: string;
  name: string;
  nameKo: string;
  descriptionKo: string;
}

export interface BuiltWonder {
  wonderId: string;
  built: boolean;
  ageBuilt?: 1 | 2 | 3;
}

export interface PlayerState {
  id: 0 | 1;
  name: string;
  isAI: boolean;
  coins: number;
  cards: string[];
  wonders: BuiltWonder[];
  progressTokens: string[];
}

export interface PyramidSlot {
  index: number;
  row: number;
  col: number;
  x: number; // Horizontal center position in half-card units
  faceUp: boolean;
  cardId: string | null;
  blockedBy: number[]; // Slot indices in row+1 that block this slot
}

export type GamePhase =
  | 'wonder_draft'
  | 'playing'
  | 'choose_progress'
  | 'destroy_card'
  | 'build_discard'
  | 'choose_discarded_progress'
  | 'choose_age_starter'
  | 'game_over';

export type GameMode = 'ai' | 'local' | 'online';
export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'master';
export type VictoryType = 'military' | 'scientific' | 'civilian';

export interface LogEntry {
  id: number;
  text: string;
  player?: 0 | 1;
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  players: [PlayerState, PlayerState];
  currentPlayer: 0 | 1;
  age: 1 | 2 | 3;
  pyramid: PyramidSlot[];
  discardPile: string[];
  conflictPosition: number; // -9 to +9. Positive = P0 advantage, Negative = P1 advantage
  militaryTokensRemoved: {
    p0_3: boolean;
    p0_6: boolean;
    p1_3: boolean;
    p1_6: boolean;
  };
  boardProgressTokens: string[];
  discardedProgressTokens: string[];
  wonderDraft: {
    pool: string[];
    step: number; // 0..3 within each round (1-2-1)
    round: 1 | 2;
    firstPicker: 0 | 1;
  };
  totalWondersBuilt: number;
  pendingPlayAgain: boolean;
  pendingDestroyColor: 'brown' | 'grey' | null;
  nextAgeStarterChooser: 0 | 1 | null;
  winner: 0 | 1 | null;
  victoryType: VictoryType | null;
  logs: LogEntry[];
  turnCount: number;
}

export interface ScoreBreakdown {
  blue: number;
  green: number;
  yellow: number;
  purple: number;
  wonders: number;
  progress: number;
  military: number;
  coins: number;
  total: number;
}
