export type HitStayMode = 'ai' | 'local' | 'online';
export type HitStayPhase =
  | 'reveal_one'
  | 'bet1'
  | 'hit_stay'
  | 'bet2'
  | 'round_end'
  | 'game_over';

export type CardValue = -1 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface HitStayCard {
  id: string;
  value: CardValue;
  faceUp: boolean;
}

export interface HitStayPlayer {
  id: number;
  name: string;
  isAI: boolean;
  chips: number;
  eliminated: boolean;
  hand: HitStayCard[];
  folded: boolean;
  stayed: boolean;
  hasRevealedInitial: boolean;
  hasActedInBet: boolean;
  roundBet: number;
  revealedHandOnEnd: boolean;
}

export interface SeatConfig {
  name: string;
  isAI: boolean;
}

export interface HitStayState {
  phase: HitStayPhase;
  mode: HitStayMode;
  roundNumber: number;
  ante: number;
  targetLimit: number; // 5..12 from 8-sided die
  dealerIndex: number;
  currentPlayer: number;
  pot: number;
  currentHighBet: number;
  roundBetCap: number;
  players: HitStayPlayer[];
  deck: HitStayCard[];
  discardPile: HitStayCard[];
  showDeckCounter: boolean;
  lastRoundSummary: string | null;
  lastWinners: number[];
  winner: number | null;
  logs: { id: number; text: string; player?: number }[];
}
