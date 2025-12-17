
import { HedgedPair } from './types';

export const initialData: HedgedPair[] = [
  {
    id: "1",
    date: "2025-10-22",
    team: "Tuấn",
    tradeA: {
      uid: "10027267",
      openPrice: 108179.10,
      closePrice: 108163.70,
      openTime: "2025-10-22T15:58:01",
      closeTime: "2025-10-22T15:59:09",
      quantity: 0.05,
      coin: "BTC",
      fee: 5.00,
      pnl: -5.71,
      // Fix: Add missing leverage property.
      leverage: 100,
    },
    tradeB: {
      uid: "953533181",
      openPrice: 108179.00,
      closePrice: 108163.80,
      openTime: "2025-10-22T15:58:01",
      closeTime: "2025-10-22T15:59:09",
      quantity: 0.05,
      coin: "BTC",
      fee: 5.93,
      pnl: -5.24,
      // Fix: Add missing leverage property.
      leverage: 100,
    },
    note: "Initial test hedge."
  },
  {
    id: "2",
    date: "2025-10-23",
    team: "Ân",
    tradeA: {
      uid: "10027273",
      openPrice: 3818.99,
      closePrice: 3823.25,
      openTime: "2025-10-23T09:00:17",
      closeTime: "2025-10-23T10:49:56",
      quantity: 2.61,
      coin: "ETH",
      fee: 9.97,
      pnl: 11.11,
      // Fix: Add missing leverage property.
      leverage: 100,
    },
    tradeB: {
      uid: "10027273",
      openPrice: 3819.16,
      closePrice: 3823.15,
      openTime: "2025-10-23T09:00:18",
      closeTime: "2025-10-23T10:50:22",
      quantity: 2.59,
      coin: "ETH",
      fee: 9.90,
      pnl: -20.25,
      // Fix: Add missing leverage property.
      leverage: 100,
    },
     note: "ETH hedge during volatility."
  },
];