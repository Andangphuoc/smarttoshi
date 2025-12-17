import { Trade } from '../types';
import { parseTradeText as parseWithGemini } from './geminiService';

// Helper to parse numbers, handling both 1,234.56 and 1.234,56 formats
const parseNumber = (str: string): number => {
  if (!str) return 0;
  
  // Safety: if string looks like a date (YYYY-MM-DD), return 0 to avoid parsing year as price
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) return 0;
  if (str.match(/^\d{2}\/\d{2}\/\d{4}/)) return 0; // Check DD/MM/YYYY

  // Remove currency symbols and non-numeric chars except . , -
  let cleaned = str.replace(/[^\d.,-]/g, '');
  
  // Handle signs
  const isNegative = cleaned.startsWith('-');
  if (isNegative) cleaned = cleaned.substring(1);
  
  // Heuristic for Separators
  // If string contains ',' and '.', the one that appears LAST is the decimal separator.
  const lastCommaIndex = cleaned.lastIndexOf(',');
  const lastDotIndex = cleaned.lastIndexOf('.');

  if (lastCommaIndex > -1 && lastDotIndex > -1) {
      if (lastCommaIndex > lastDotIndex) {
          // European: 1.234,56 -> 1234.56
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
          // American: 1,234.56 -> 1234.56
          cleaned = cleaned.replace(/,/g, '');
      }
  } else if (lastCommaIndex > -1) {
      // Only commas. 1,234 -> 1234. 
      // In crypto contexts, if we have 3 digits after comma, it's usually a thousand separator.
      // If we have 1 or 2 digits, it might be a decimal comma (European).
      // However, simplified rule for safety: Remove commas (American standard default).
      cleaned = cleaned.replace(/,/g, '');
  }
  
  return (isNegative ? -1 : 1) * parseFloat(cleaned);
};

// Helper to parse Vietnamese/Custom Date: "17/12/2025 10:16:52 SA" or "1/12/2025 10:19:16" -> ISO String
const parseCustomDate = (dateStr: string): string | undefined => {
    try {
        // Match DD/MM/YYYY HH:MM:SS with optional SA/CH
        const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(SA|CH)?/i);
        if (match) {
            let [_, day, month, year, hour, minute, second, meridiem] = match;
            let h = parseInt(hour, 10);
            if (meridiem) {
                if (meridiem.toUpperCase() === 'CH' && h < 12) h += 12;
                if (meridiem.toUpperCase() === 'SA' && h === 12) h = 0;
            }
            // Return YYYY-MM-DDTHH:mm:ss
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${h.toString().padStart(2, '0')}:${minute}:${second}`;
        }
    } catch (e) {
        return undefined;
    }
    return undefined;
};

// --- 5. Format Tabular (Copy/Paste from Excel/Custom) ---
// 2.860,90	2.827,45	1/12/2025 10:19:16	1/12/2025 10:39:12	15,00	ETH	$42,66	-$501,75
const parseFormatTabular = (text: string): Partial<Trade> | null => {
    // Split by tab (\t) or 4+ spaces to handle visual separation
    const parts = text.split(/\t/);
    
    // We expect roughly 8 columns
    if (parts.length < 8) return null;

    // Check if the first part looks like a number (Entry Price)
    if (!/^\d/.test(parts[0].trim())) return null;

    console.log("Detected Format Tabular");
    const trade: Partial<Trade> = { leverage: 100 };

    trade.openPrice = parseNumber(parts[0]);
    trade.closePrice = parseNumber(parts[1]);
    
    trade.openTime = parseCustomDate(parts[2]);
    trade.closeTime = parseCustomDate(parts[3]);
    
    trade.quantity = parseNumber(parts[4]);
    trade.coin = parts[5].trim();
    
    trade.fee = Math.abs(parseNumber(parts[6]));
    trade.pnl = parseNumber(parts[7]);

    return trade;
};

// --- 1. Format Tiếng Việt (Aivora VN) ---
const parseFormatVN = (text: string): Partial<Trade> | null => {
    if (!text.includes('Giá Mở') && !text.includes('Giá Đóng')) return null;

    console.log("Detected Format VN");
    const trade: Partial<Trade> = { leverage: 100 };

    const coinMatch = text.match(/Coin\s*\n\s*([A-Z]+)/i);
    if (coinMatch) trade.coin = coinMatch[1];

    const qtyMatch = text.match(/SL\s*\n\s*([\d.,]+)/i);
    if (qtyMatch) trade.quantity = parseNumber(qtyMatch[1]);

    const openPriceMatch = text.match(/Giá Mở\s*\n\s*([\d.,]+)/i);
    if (openPriceMatch) trade.openPrice = parseNumber(openPriceMatch[1]);

    const closePriceMatch = text.match(/Giá Đóng\s*\n\s*([\d.,]+)/i);
    if (closePriceMatch) trade.closePrice = parseNumber(closePriceMatch[1]);

    const dateMatches = Array.from(text.matchAll(/Ngày\s*\n\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s*(?:SA|CH)?)/gi));
    if (dateMatches.length > 0) {
        trade.openTime = parseCustomDate(dateMatches[0][1]);
        if (dateMatches.length > 1) {
            trade.closeTime = parseCustomDate(dateMatches[1][1]);
        }
    }

    const feeMatch = text.match(/Phí\s*\n\s*([-\d.,]+)/i);
    if (feeMatch) trade.fee = Math.abs(parseNumber(feeMatch[1]));

    const pnlMatch = text.match(/PnL\s*\n\s*([+-\d.,]+)/i);
    if (pnlMatch) trade.pnl = parseNumber(pnlMatch[1]);
    
    const levMatch = text.match(/Đòn Bẩy\s*\n\s*(\d+)/i);
    if (levMatch) trade.leverage = parseInt(levMatch[1], 10);

    return trade;
};

// --- 2. Format Aivora English (Standard & Columnar) ---
const parseFormatAivoraEn = (text: string): Partial<Trade> | null => {
  if (!text.includes('Opening Average Price')) return null;

  console.log("Detected Format Aivora English");
  const trade: Partial<Trade> = { leverage: 100 };

  const colOpenMatch = text.match(/Open Time[\s\S]*?Opening Average Price[\s\S]*?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})[\s\S]*?(\d+[\.,]\d+)/i);
  if (colOpenMatch) {
      trade.openTime = colOpenMatch[1].replace(' ', 'T');
      trade.openPrice = parseNumber(colOpenMatch[2]);
  } else {
      const stdOpen = text.match(/Opening Average Price\s*\n\s*([\d.,]+)/i);
      if (stdOpen && !stdOpen[1].match(/^\d{4}-\d{2}-\d{2}/)) {
           trade.openPrice = parseNumber(stdOpen[1]);
      }
      const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
      if (dateMatch) trade.openTime = dateMatch[1].replace(' ', 'T');
  }

  const colCloseMatch = text.match(/Close Time[\s\S]*?Closing Average Price[\s\S]*?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})[\s\S]*?(\d+[\.,]\d+)/i);
  if (colCloseMatch) {
      trade.closeTime = colCloseMatch[1].replace(' ', 'T');
      trade.closePrice = parseNumber(colCloseMatch[2]);
  } else {
      const stdClose = text.match(/Closing Average Price\s*\n\s*([\d.,]+)/i);
      if (stdClose && !stdClose[1].match(/^\d{4}-\d{2}-\d{2}/)) {
           trade.closePrice = parseNumber(stdClose[1]);
      }
      if (!trade.closeTime) {
          const dates = text.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/g);
          if (dates && dates.length > 1) trade.closeTime = dates[dates.length - 1].replace(' ', 'T');
      }
  }

  const posSizeStack = text.match(/Position Size[\s\S]*?Funding Fee[\s\S]*?([\d.,]+)\s*([A-Z]+)/i);
  if (posSizeStack) {
      trade.quantity = parseNumber(posSizeStack[1]);
      trade.coin = posSizeStack[2];
  } else {
      const volMatch = text.match(/(?:Volume|Position Size)\s*\n?\s*([\d.,]+)\s+([A-Z]+)/i);
      if (volMatch) {
          trade.quantity = parseNumber(volMatch[1]);
          trade.coin = volMatch[2];
      }
  }

  const feePnlStack = text.match(/Fees[\s\S]*?Position PnL[\s\S]*?([-\d.,]+)\s*[A-Z]*\s*\n\s*([-\d.,]+)/i);
  if (feePnlStack) {
      trade.fee = Math.abs(parseNumber(feePnlStack[1]));
      trade.pnl = parseNumber(feePnlStack[2]);
  } else {
      const feeStd = text.match(/Fees\s*\n\s*([-\d.,]+)/i) || text.match(/Fee\s*\n\s*([-\d.,]+)/i);
      if (feeStd) trade.fee = Math.abs(parseNumber(feeStd[1]));

      const pnlStd = text.match(/Position PnL\s*\n\s*([+-\d.,]+)/i);
      if (pnlStd) trade.pnl = parseNumber(pnlStd[1]);
  }

  const lev = text.match(/(\d+)X/i);
  if (lev) trade.leverage = parseInt(lev[1], 10);

  return trade;
};

// --- 3. Format C: Generic Fixed ---
const parseFormatFixed = (text: string): Partial<Trade> | null => {
  if (!text.includes('Time Opened') && !text.includes('Entry Price')) return null;

  console.log("Detected Format Fixed/Generic");
  const trade: Partial<Trade> = { leverage: 100 };

  const openTimeMatch = text.match(/Time Opened\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
  if (openTimeMatch) trade.openTime = openTimeMatch[1].replace(' ', 'T');

  const entryMatch = text.match(/Entry Price\s*\n\s*([\d.,]+)/i);
  if (entryMatch) trade.openPrice = parseNumber(entryMatch[1]);

  const closeTimeMatch = text.match(/Time Closed\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
  if (closeTimeMatch) trade.closeTime = closeTimeMatch[1].replace(' ', 'T');

  const closeMatch = text.match(/Close Price\s*\n\s*([\d.,]+)/i);
  if (closeMatch) trade.closePrice = parseNumber(closeMatch[1]);

  const qtyMatch = text.match(/Closed Qty\.?\s*\n\s*([\d.,]+)(?:\s*\n\s*|\s+)([A-Z]+)/i);
  if (qtyMatch) {
      trade.quantity = parseNumber(qtyMatch[1]);
      trade.coin = qtyMatch[2];
  }

  const feeMatch = text.match(/Fees\s*\n\s*([-\d.,]+)/i);
  if (feeMatch) trade.fee = Math.abs(parseNumber(feeMatch[1]));

  const closingPnlMatch = text.match(/Closing PnL\s*\n\s*([+-\d.,]+)/i);
  const posPnlMatch = text.match(/Position PnL\s*\n\s*([+-\d.,]+)/i);
  if (closingPnlMatch) trade.pnl = parseNumber(closingPnlMatch[1]);
  else if (posPnlMatch) trade.pnl = parseNumber(posPnlMatch[1]);

  const levMatch = text.match(/(\d+)X/i);
  if (levMatch) trade.leverage = parseInt(levMatch[1], 10);

  return trade;
};

// --- 4. Format B: Bitunix Standard ---
const parseFormatBitunix = (text: string): Partial<Trade> | null => {
  if (!text.includes('Entry Price') || text.includes('Time Opened')) return null;

  console.log("Detected Format Bitunix");
  const trade: Partial<Trade> = { leverage: 100 };

  const entryMatch = text.match(/Entry Price\s*\n\s*([\d.,]+)/i);
  if (entryMatch) trade.openPrice = parseNumber(entryMatch[1]);

  const exitMatch = text.match(/Exit Price\s*\n\s*([\d.,]+)/i);
  if (exitMatch) trade.closePrice = parseNumber(exitMatch[1]);
  
  const openTimeMatch = text.match(/Open Time\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
  if (openTimeMatch) trade.openTime = openTimeMatch[1].replace(' ', 'T');

  const closeTimeMatch = text.match(/Close Time\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
  if (closeTimeMatch) trade.closeTime = closeTimeMatch[1].replace(' ', 'T');

  const qtyMatch = text.match(/Quantity\s*\n\s*([\d.,]+)\s+([A-Z]+)/i);
  if (qtyMatch) {
      trade.quantity = parseNumber(qtyMatch[1]);
      trade.coin = qtyMatch[2];
  }

  const feeMatch = text.match(/Trading Fee\s*\n\s*([-\d.,]+)/i);
  if (feeMatch) trade.fee = Math.abs(parseNumber(feeMatch[1]));

  const pnlMatch = text.match(/Position PnL\s*\n\s*([+-\d.,]+)/i);
  if (pnlMatch) trade.pnl = parseNumber(pnlMatch[1]);

  const lev = text.match(/(\d+)X/i);
  if (lev) trade.leverage = parseInt(lev[1], 10);

  return trade;
};

// Main smart parser function
export async function parseTradeTextSmart(text: string): Promise<Trade> {
  // Priority: Tabular -> VN -> Aivora En -> Fixed -> Bitunix -> Gemini
  const smartParse = 
    parseFormatTabular(text) ||
    parseFormatVN(text) || 
    parseFormatAivoraEn(text) || 
    parseFormatFixed(text) || 
    parseFormatBitunix(text);

  if (smartParse && smartParse.openPrice && (smartParse.quantity || smartParse.coin)) {
      // Fill missing required fields with defaults to satisfy Trade type
      return {
          uid: '',
          leverage: 100,
          openPrice: 0,
          openTime: new Date().toISOString(),
          quantity: 0,
          coin: 'ETH',
          fee: 0,
          pnl: 0,
          ...smartParse
      } as Trade;
  }

  // 2. Fallback to Gemini AI if no format detected
  console.log("No standard format detected, falling back to Gemini AI...");
  return parseWithGemini(text);
}