import { Trade } from '../types';
import { parseTradeText as parseWithGemini } from './geminiService';

// Helper to parse numbers, handling both 1,234.56 and 1.234,56 and 2930,63 formats
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
      // Only commas present (e.g. "2930,63" or "1,234")
      const parts = cleaned.split(',');
      const lastPart = parts[parts.length - 1];

      // Heuristic: If the digits after the last comma are NOT 3, it's likely a decimal separator.
      // E.g.: "2930,63" (2 digits) -> Decimal. "0,5" (1 digit) -> Decimal.
      // "1,234" (3 digits) -> Thousand separator (American default).
      if (lastPart.length !== 3) {
           // Treat as European Decimal: Replace comma with dot
           cleaned = cleaned.replace(/,/g, '.');
      } else {
           // Treat as American Thousand Separator: Remove comma
           cleaned = cleaned.replace(/,/g, '');
      }
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

// ==========================================
// AIVORA PARSERS (Identify by "Open Time")
// ==========================================

// 1. Aivora VN Format
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

// 2. Aivora English (Grid/Desktop) - Uses "Open Time"
const parseFormatAivoraGrid = (text: string): Partial<Trade> | null => {
    // Aivora SPECIFIC keyword
    if (!text.includes('Open Time')) return null;

    console.log("Detected Format Aivora Grid");
    const trade: Partial<Trade> = { leverage: 100 };

    // --- Sub-format 1: Stacked Headers (Format B) ---
    // "Opening Average Price" followed closely by "Close Time"
    const isFormatStacked = /Open Time\s*\n\s*Opening Average Price\s*\n\s*Close Time/i.test(text);

    if (isFormatStacked) {
        const headerStackMatch = text.match(/Open Time\s*\n\s*Opening Average Price\s*\n\s*Close Time\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*\n\s*([\d.,]+)\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
        if (headerStackMatch) {
            trade.openTime = headerStackMatch[1].replace(' ', 'T');
            trade.openPrice = parseNumber(headerStackMatch[2]);
            trade.closeTime = headerStackMatch[3].replace(' ', 'T');
        }

        const closeStackMatch = text.match(/Closing Average Price\s*\n\s*Position Size\s*\n\s*Funding Fee\s*\n\s*([\d.,]+)\s*\n\s*([\d.,]+)\s*([A-Z]+)/i);
        if (closeStackMatch) {
            trade.closePrice = parseNumber(closeStackMatch[1]);
            trade.quantity = parseNumber(closeStackMatch[2]);
            trade.coin = closeStackMatch[3];
        }

        const feePnlMatch = text.match(/Fees\s*\n\s*Position PnL\s*\n\s*Realized PnL\s*\n\s*([-\d.,]+)[^\n]*\n\s*([+-\d.,]+)/i);
        if (feePnlMatch) {
            trade.fee = Math.abs(parseNumber(feePnlMatch[1]));
            trade.pnl = parseNumber(feePnlMatch[2]);
        }
    } else {
        // --- Sub-format 2: Sequential (Format A) ---
        const openBlock = text.match(/Open Time\s*\n\s*Opening Average Price\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*\n\s*([\d.,]+)/i);
        if (openBlock) {
            trade.openTime = openBlock[1].replace(' ', 'T');
            trade.openPrice = parseNumber(openBlock[2]);
        }

        const closeBlock = text.match(/Close Time\s*\n\s*Closing Average Price\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*\n\s*([\d.,]+)/i);
        if (closeBlock) {
            trade.closeTime = closeBlock[1].replace(' ', 'T');
            trade.closePrice = parseNumber(closeBlock[2]);
        }

        const qtyBlock = text.match(/Position Size\s*\n\s*Funding Fee\s*\n\s*([\d.,]+)\s*([A-Z]+)/i);
        if (qtyBlock) {
            trade.quantity = parseNumber(qtyBlock[1]);
            trade.coin = qtyBlock[2];
        }

        const feePnlBlock = text.match(/Fees\s*\n\s*Position PnL\s*\n\s*([-\d.,]+)[^\n]*\n\s*([+-\d.,]+)/i);
        if (feePnlBlock) {
            trade.fee = Math.abs(parseNumber(feePnlBlock[1]));
            trade.pnl = parseNumber(feePnlBlock[2]);
        }
    }

    // Common Aivora cleanup
    if (!trade.coin) {
        const coinMatch = text.match(/^([A-Z]+)USDT/i);
        if (coinMatch) trade.coin = coinMatch[1];
    }
    const levMatch = text.match(/(\d+)X/);
    if (levMatch) trade.leverage = parseInt(levMatch[1], 10);

    return trade;
};

// 3. Aivora English Fallback (Old style)
const parseFormatAivoraEn = (text: string): Partial<Trade> | null => {
  // Must have Opening Average Price but NOT be Bitunix (Time Opened)
  if (!text.includes('Opening Average Price') || text.includes('Time Opened')) return null;

  console.log("Detected Format Aivora English (Fallback)");
  const trade: Partial<Trade> = { leverage: 100 };

  const stdOpen = text.match(/Opening Average Price\s*\n\s*([\d.,]+)/i);
  if (stdOpen) trade.openPrice = parseNumber(stdOpen[1]);
  
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
  if (dateMatch) trade.openTime = dateMatch[1].replace(' ', 'T');

  const stdClose = text.match(/Closing Average Price\s*\n\s*([\d.,]+)/i);
  if (stdClose) trade.closePrice = parseNumber(stdClose[1]);

  const volMatch = text.match(/(?:Volume|Position Size)\s*\n?\s*([\d.,]+)\s+([A-Z]+)/i);
  if (volMatch) {
      trade.quantity = parseNumber(volMatch[1]);
      trade.coin = volMatch[2];
  }

  const feeStd = text.match(/Fees\s*\n\s*([-\d.,]+)/i);
  if (feeStd) trade.fee = Math.abs(parseNumber(feeStd[1]));

  const pnlStd = text.match(/Position PnL\s*\n\s*([+-\d.,]+)/i);
  if (pnlStd) trade.pnl = parseNumber(pnlStd[1]);

  const lev = text.match(/(\d+)X/i);
  if (lev) trade.leverage = parseInt(lev[1], 10);

  return trade;
};


// ==========================================
// BITUNIX PARSERS (Identify by "Time Opened")
// ==========================================

// 4. Bitunix Mobile/Vertical (Specific fix for Closing PnL)
const parseFormatBitunixMobile = (text: string): Partial<Trade> | null => {
    // Bitunix SPECIFIC keywords: "Time Opened"
    if (!text.includes('Time Opened')) return null;

    console.log("Detected Format Bitunix Mobile");
    const trade: Partial<Trade> = { leverage: 100 };

    // Basic fields
    const coinMatch = text.match(/^([A-Z]+)USDT/i);
    if (coinMatch) trade.coin = coinMatch[1];
    
    const levMatch = text.match(/(\d+)X/);
    if (levMatch) trade.leverage = parseInt(levMatch[1], 10);

    const openTimeMatch = text.match(/Time Opened\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
    if (openTimeMatch) trade.openTime = openTimeMatch[1].replace(' ', 'T');
    
    const entryMatch = text.match(/Entry Price\s*\n\s*([\d.,]+)/i);
    if (entryMatch) trade.openPrice = parseNumber(entryMatch[1]);
    
    const closeTimeMatch = text.match(/Time Closed\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
    if (closeTimeMatch) trade.closeTime = closeTimeMatch[1].replace(' ', 'T');

    const closePriceMatch = text.match(/Close Price\s*\n\s*([\d.,]+)/i);
    if (closePriceMatch) trade.closePrice = parseNumber(closePriceMatch[1]);

    // Quantity can be under "Max held" or "Closed Qty."
    const qtyMatch = text.match(/(?:Max held|Closed Qty\.?)\s*\n\s*([\d.,]+)/i);
    if (qtyMatch) trade.quantity = parseNumber(qtyMatch[1]);
    
    if (!trade.coin) {
         const coinUnderQty = text.match(/(?:Max held|Closed Qty\.?)\s*\n\s*[\d.,]+\s*\n\s*([A-Z]+)/i);
         if (coinUnderQty) trade.coin = coinUnderQty[1];
    }

    // --- CRITICAL FIX FOR PNL ---
    // User Requirement: Use "Closing PnL" if available, as it is the correct value for closed orders.
    // "Position PnL" often appears earlier but might include unrealized or different calcs.
    
    // Attempt to match Closing PnL first
    // Regex matches "Closing PnL" followed by new line, then a number (ignoring " USDT")
    const closingPnlMatch = text.match(/Closing PnL\s*\n\s*([+-\d.,]+)/i);
    
    if (closingPnlMatch) {
        trade.pnl = parseNumber(closingPnlMatch[1]);
    } else {
        // Fallback to Position PnL if Closing PnL is missing
        const posPnlMatch = text.match(/Position PnL\s*\n\s*([+-\d.,]+)/i);
        if (posPnlMatch) trade.pnl = parseNumber(posPnlMatch[1]);
    }

    const feeMatch = text.match(/Fees?\s*\n\s*([-\d.,]+)/i);
    if (feeMatch) trade.fee = Math.abs(parseNumber(feeMatch[1]));

    return trade;
};

// 5. Bitunix Legacy/Web (Fallback)
const parseFormatBitunixWeb = (text: string): Partial<Trade> | null => {
  if (!text.includes('Entry Price') || !text.includes('Time Opened')) return null;
  // If parsing matches mobile logic, skip this to avoid double processing, 
  // but keeping it as a safeguard for slightly different formats.
  
  console.log("Detected Format Bitunix Web");
  const trade: Partial<Trade> = { leverage: 100 };

  const entryMatch = text.match(/Entry Price\s*\n\s*([\d.,]+)/i);
  if (entryMatch) trade.openPrice = parseNumber(entryMatch[1]);

  const exitMatch = text.match(/Exit Price\s*\n\s*([\d.,]+)/i);
  if (exitMatch) trade.closePrice = parseNumber(exitMatch[1]);
  
  const openTimeMatch = text.match(/Open Time\s*\n\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i);
  if (openTimeMatch) trade.openTime = openTimeMatch[1].replace(' ', 'T');

  const pnlMatch = text.match(/Position PnL\s*\n\s*([+-\d.,]+)/i);
  if (pnlMatch) trade.pnl = parseNumber(pnlMatch[1]);

  return trade;
};

// --- Format Tabular (Generic/Excel) ---
const parseFormatTabular = (text: string): Partial<Trade> | null => {
    const parts = text.split(/\t/);
    if (parts.length < 8) return null;
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

// Main smart parser function
export async function parseTradeTextSmart(text: string): Promise<Trade> {
  // Priority: 
  // 1. Tabular (Excel copies)
  // 2. Aivora VN
  // 3. Aivora Grid (Open Time)
  // 4. Bitunix Mobile (Time Opened - specific fix for Closing PnL)
  // 5. Fallbacks
  const smartParse = 
    parseFormatTabular(text) ||
    parseFormatVN(text) || 
    parseFormatAivoraGrid(text) || 
    parseFormatBitunixMobile(text) || 
    parseFormatAivoraEn(text) || 
    parseFormatBitunixWeb(text);

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

  // Fallback to Gemini AI if no format detected
  console.log("No standard format detected, falling back to Gemini AI...");
  return parseWithGemini(text);
}