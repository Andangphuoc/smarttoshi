export interface Trade {
  uid: string;
  openPrice: number;
  closePrice?: number;
  openTime: string;
  closeTime?: string;
  quantity: number;
  coin: string;
  fee: number;
  pnl: number;
  leverage: number;
}

export interface HedgedPair {
  id: string;
  date: string;
  team: string;
  tradeA: Trade; // Exchange A: Aivora
  tradeB: Trade; // Exchange B: Bitunix
  note?: string;
}

export interface UserData {
  hedgedPairs: HedgedPair[];
  monthlyVolumeTarget: number;
  startingEquity: number;
}

export type TradeKey = 'tradeA' | 'tradeB';