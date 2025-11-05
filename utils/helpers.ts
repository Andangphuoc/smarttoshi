import { HedgedPair } from '../types';

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

export const calculateLiquidationInfo = (
  balance: number,
  entryPrice: number,
  quantity: number,
  leverage: number,
  maintenancePercent: number = 0.5, // percent (e.g., 0.5 means 0.5%)
  feeRate: number = 0.001 // fee rate as decimal (e.g., 0.001 = 0.1%)
) => {
  if (!balance || !entryPrice || !quantity || !leverage) {
    return { longLiq: null, shortLiq: null, buffer: null, isSafe: false };
  }
  // New liquidation logic per user's formula:
  // Margin Balance = Position Margin + Unrealized P/L - (Position Value * Fee Rate)
  // We find price P where Margin Balance = 0 => liquidated.
  // Position Margin = (entryPrice * quantity) / leverage
  const positionMargin = (entryPrice * quantity) / leverage;

  // Solve for P:
  // For Long: positionMargin + (P - entryPrice) * q - (P * q * feeRate) = 0
  // => P * q * (1 - feeRate) = entryPrice * q - positionMargin
  // => P = (entryPrice * q - positionMargin) / (q * (1 - feeRate))
  // Simplifies to:
  const longLiq = (entryPrice * quantity - positionMargin) / (quantity * (1 - feeRate));

  // For Short: positionMargin + (entryPrice - P) * q - (P * q * feeRate) = 0
  // => P * q * (1 + feeRate) = entryPrice * q + positionMargin
  // => P = (entryPrice * q + positionMargin) / (q * (1 + feeRate))
  const shortLiq = (entryPrice * quantity + positionMargin) / (quantity * (1 + feeRate));

  // maintenance amount as a simple reserve based on provided maintenancePercent
  const maintenanceAmount = balance * (maintenancePercent / 100);
  const effectiveCollateral = balance - maintenanceAmount;
  const marginRequired = positionMargin;

  // distance (absolute) from entry to liquidation price for long/short
  const bufferLong = Math.abs(entryPrice - longLiq);
  const bufferShort = Math.abs(shortLiq - entryPrice);

  // isSafe: effective collateral should cover marginRequired
  const isSafe = effectiveCollateral > marginRequired;

  return {
    longLiq: longLiq > 0 ? longLiq : 0,
    shortLiq,
    buffer: bufferLong,
    isSafe,
    maintenanceAmount,
    effectiveCollateral,
    marginRequired,
  } as any;
};