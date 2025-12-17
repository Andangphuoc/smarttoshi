import { HedgedPair, Trade } from '../types';

export const calculateSlippage = (pair: HedgedPair) => {
  const openSlippage = Math.abs((pair.tradeB.openPrice || 0) - (pair.tradeA.openPrice || 0));
  const closeSlippage = Math.abs((pair.tradeB.closePrice || 0) - (pair.tradeA.closePrice || 0));
  return { openSlippage, closeSlippage, totalSlippage: openSlippage + closeSlippage };
};

export const calculateTotals = (pair: HedgedPair) => {
  const totalFee = (pair.tradeA.fee || 0) + (pair.tradeB.fee || 0);
  const totalPnl = (pair.tradeA.pnl || 0) + (pair.tradeB.pnl || 0);
  const tradingVolume = ((pair.tradeA.openPrice || 0) * (pair.tradeA.quantity || 0)) + ((pair.tradeB.openPrice || 0) * (pair.tradeB.quantity || 0));
  return { totalFee, totalPnl, tradingVolume };
};

export const formatCurrency = (value: number) => {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatNumber = (value: number, precision: number = 4) => {
    return value.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
}

// European format: 1.234,56
export const formatNumberEuropean = (value: number) => {
    return value.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

// Date format: d/m/yyyy H:mm:ss (e.g., 1/12/2025 10:19:16)
export const formatDateCustom = (isoStr: string | undefined) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${h}:${m}:${s}`;
};

export const formatTradeToClipboard = (trade: Trade): string => {
    // Format: OpenPrice [tab] ClosePrice [tab] OpenTime [tab] CloseTime [tab] Qty [tab] Coin [tab] Fee [tab] PnL
    // Example: 2.954,58	2.944,40	17/12/2025 10:16:52	17/12/2025 10:38:23	40,01	ETH	118,01	-407,30
    
    const openP = formatNumberEuropean(trade.openPrice);
    const closeP = trade.closePrice ? formatNumberEuropean(trade.closePrice) : "";
    const openT = formatDateCustom(trade.openTime);
    const closeT = formatDateCustom(trade.closeTime);
    const qty = formatNumberEuropean(trade.quantity);
    const coin = trade.coin;
    
    // Fee: Remove $ symbol. Assuming fee is positive cost.
    const fee = formatNumberEuropean(Math.abs(trade.fee));
    
    // PnL: Remove $ symbol. formatNumberEuropean handles negative sign (e.g. -407,30).
    const pnl = formatNumberEuropean(trade.pnl);

    return `${openP}\t${closeP}\t${openT}\t${closeT}\t${qty}\t${coin}\t${fee}\t${pnl}`;
};

export const calculateLiquidationInfo = (
  balance: number,
  entryPrice: number,
  quantity: number,
  leverage: number,
) => {
  if (!balance || !entryPrice || !quantity || !leverage) {
    return { longLiq: null, shortLiq: null, buffer: null, isSafe: false };
  }

  // Simplified liquidation price formula for cross margin (this is an estimation)
  // Assumes isolated margin concept for calculation simplicity.
  // Real cross margin liq price depends on the entire account balance and other positions.
  const margin = (entryPrice * quantity) / leverage;
  
  // For Long: Price has to drop
  const priceDrop = (balance + margin) / quantity;
  const longLiq = entryPrice - priceDrop;

  // For Short: Price has to rise
  const priceRise = (balance + margin) / quantity;
  const shortLiq = entryPrice + priceRise;
  
  const buffer = Math.abs(entryPrice - longLiq);
  const isSafe = buffer > 120;

  return { 
    longLiq: longLiq > 0 ? longLiq : 0, 
    shortLiq, 
    buffer, 
    isSafe 
  };
};