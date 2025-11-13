import { Trade } from '../types';

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled. Please set the GEMINI_API_KEY environment variable.");
}

// Use a plain JSON schema (no SDK-specific Type enum) so TypeScript doesn't require SDK types.
const tradeSchema = {
  type: 'object',
  properties: {
    openPrice: { type: 'number', description: 'The opening/entry price.' },
    closePrice: { type: 'number', description: 'The closing price.' },
    openTime: { type: 'string', description: 'The opening time in YYYY-MM-DDTHH:mm:ss ISO 8601 format.' },
    closeTime: { type: 'string', description: 'The closing time in YYYY-MM-DDTHH:mm:ss ISO 8601 format.' },
    quantity: { type: 'number', description: 'The position size or closed quantity.' },
    coin: { type: 'string', description: 'The cryptocurrency symbol (e.g., ETH, BTC).' },
    fee: { type: 'number', description: 'The trading fee amount, as an absolute positive number.' },
    pnl: { type: 'number', description: 'The Position PnL.' },
  },
  required: ['openPrice', 'closePrice', 'openTime', 'closeTime', 'quantity', 'coin', 'fee', 'pnl'],
};


export async function parseTradeText(text: string): Promise<Trade> {
  if (!API_KEY) {
    throw new Error("Gemini API key not configured.");
  }
  
  try {
    const prompt = `You are an expert data extraction bot. Your task is to parse trade confirmation text and extract key details into a structured JSON format according to the provided schema.

**CRITICAL Number Formatting Rules:**
- You will encounter numbers in two formats: American (e.g., "1,234.56") and European (e.g., "1.234,56").
- In American format, ',' is a thousands separator and '.' is the decimal.
- In European format, '.' is a thousands separator and ',' is the decimal.
- You MUST correctly interpret these and convert them to standard numbers (e.g., 1234.56).
- A number like "-124.593300" is a decimal number, NOT a large integer. Parse it as -124.5933.

**General Rules:**
- The coin symbol should be extracted from the pair (e.g., 'ETHUSDT' -> 'ETH').
- All prices, quantities, fees, and PnL should be numbers. Remove any currency symbols like 'USDT' or '$'.
- Fees should always be positive. If the text shows a negative fee, convert it to its absolute value.
- Timestamps must be converted to full ISO 8601 format (YYYY-MM-DDTHH:mm:ss).

**Example Format 1:**
---
ETHUSDT
Short
Open Time: 2025-10-31 10:24:44
Opening Average Price: 3.828,65
Close Time: 2025-10-31 11:22:04
Closing Average Price: 3.870,32
Position Size: 2.99 ETH
Fees: -11,509960 USDT
Position PnL: -124,593300
---

**Example Format 2:**
---
ETHUSDT 
Long
Time Opened: 2025-10-31 10:24:43
Entry Price: 3,828.66 USDT
Position PnL: +114.51099000 USDT
Time Closed: 2025-10-31 11:22:03
Close Price: 3,870.68 USDT
Closed Qty: 3.000 ETH
Fees: -11.54901000 USDT
---

**Example Format 3 (Bitbaby — a Bitunix variant, Vietnamese labels):**
---
ETHUSDT
Long
Cross
100 X
2025-11-12 17:35:03
3534.42
2025-11-12 18:07:12
3551.28
59.97 ETH số lương
0.000000
-254.957695 USDT phí
+1011.031000 pnl cho tô nha
+756.073304
+31.84%
---

Notes for Format 3:
- The quantity line may include Vietnamese words like "số lương" or "số lượng" after the number and the coin (e.g., "59.97 ETH số lương"). Extract the numeric quantity (59.97) and the coin (ETH).
- The fee line may include the word "phí" and a negative sign; take the absolute value for the 'fee' field (e.g., "-254.957695 USDT phí" -> 254.957695).
- The PnL line may include informal Vietnamese text (e.g., "pnl cho tô nha") and a leading plus/minus sign; prefer any field explicitly labeled 'pnl' or 'PnL' as the position PnL. If multiple numeric lines exist, choose the one containing the literal 'pnl'/'PnL' or the nearest numeric value labelled profit/loss.
- There may be extra summary lines (like a second numeric PnL or a percent). Ignore percent fields for the 'pnl' number; only populate 'pnl' with the absolute numeric USD value (signed +/ - allowed).
- Timestamps are in YYYY-MM-DD HH:mm:ss — convert to ISO 8601 (YYYY-MM-DDTHH:mm:ss).
- Always return numbers as plain JSON numbers (no currency suffixes, no % signs).

Here is the text to parse:
"${text}"`;

    // Dynamically import the Google GenAI SDK at runtime to avoid build-time type issues
    const genai = await import('@google/genai').catch(() => null as any);
    if (!genai) {
      throw new Error('Google GenAI SDK not available. Install @google/genai or enable AI features.');
    }
    const GenAIClient = genai.GoogleGenAI || genai.GoogleGenerativeAI || genai.default || genai;
    const ai = new GenAIClient({ apiKey: API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: tradeSchema,
      },
    });
    
    const parsedJson = JSON.parse(response.text);

    // Basic validation: ensure required fields exist and are not empty. If AI returned something incomplete,
    // fall back to the heuristic parser below.
    const required = ['openPrice', 'closePrice', 'openTime', 'closeTime', 'quantity', 'coin', 'fee', 'pnl'];
    const ok = required.every((k) => parsedJson[k] !== undefined && parsedJson[k] !== null && parsedJson[k] !== '');
    if (!ok) {
      console.warn('Gemini AI returned incomplete parse, attempting heuristic fallback for Bitbaby/Bitunix formats.');
      return heuristicParseBitbaby(text);
    }

    // The Gemini response is the main payload, we just need to add a placeholder for UID
    return { ...parsedJson, uid: '' };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // If AI parsing fails for any reason, attempt a heuristic fallback parser for known Bitbaby/Bitunix formats.
    try {
      console.warn('Falling back to heuristic parser for Bitbaby/Bitunix formats.');
      return heuristicParseBitbaby(text);
    } catch (hfErr) {
      console.error('Heuristic fallback parser also failed:', hfErr);
      throw new Error("Failed to parse trade data with Gemini and heuristic fallback. The text format might be incorrect or unsupported.");
    }
  }
}

// Heuristic parser for Bitbaby / Bitunix-like pasted trade text. This is a best-effort fallback when AI fails.
function heuristicParseBitbaby(text: string): Trade {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const parseNumber = (s: string) => {
    if (!s) return NaN;
    let str = String(s).replace(/[^0-9,\.\+\-]/g, '').trim();
    const hasComma = str.indexOf(',') !== -1;
    const hasDot = str.indexOf('.') !== -1;
    if (hasComma && hasDot) {
      // determine which is decimal by position: if comma occurs after dot, likely European (3.828,65)
      if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
        str = str.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // American: remove commas
        str = str.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      // comma as decimal
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // plain number, remove commas
      str = str.replace(/,/g, '');
    }
    const n = parseFloat(str);
    return isNaN(n) ? NaN : n;
  };

  const result: any = {
    uid: '',
    openPrice: NaN,
    closePrice: NaN,
    openTime: '',
    closeTime: '',
    quantity: NaN,
    coin: '',
    fee: NaN,
    pnl: NaN,
    leverage: 0,
  };

  // 1) Pair (e.g., ETHUSDT)
  for (const l of lines) {
    const m = l.match(/([A-Z]{3,6}USDT)/);
    if (m) {
      result.coin = (m[1].replace(/USDT$/, '') || '').toUpperCase();
      break;
    }
  }

  // 2) Timestamps and associated prices: find timestamp lines and next-line price
  const tsRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
  const timestamps: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (tsRegex.test(lines[i])) {
      timestamps.push(lines[i]);
      // next non-empty line as price
      if (i + 1 < lines.length) {
        const p = parseNumber(lines[i + 1]);
        if (!isNaN(p)) {
          if (!result.openTime) {
            result.openTime = timestamps[0].replace(' ', 'T');
            result.openPrice = p;
          } else if (!result.closeTime) {
            result.closeTime = timestamps[1] ? timestamps[1].replace(' ', 'T') : timestamps[0].replace(' ', 'T');
            result.closePrice = p;
          }
        }
      }
    }
  }

  // 3) Leverage (e.g., 100 X)
  for (const l of lines) {
    const m = l.match(/(\d+(?:[.,]\d+)?)\s*[xX]/);
    if (m) {
      const lev = parseNumber(m[1]);
      if (!isNaN(lev)) result.leverage = lev;
      break;
    }
  }

  // 4) Quantity line (e.g., 59.97 ETH số lương)
  for (const l of lines) {
    const m = l.match(/([+\-]?[0-9.,]+)\s*([A-Za-z]{2,5})\b/);
    if (m) {
      const num = parseNumber(m[1]);
      if (!isNaN(num) && m[2].toUpperCase() === result.coin) {
        result.quantity = num;
        break;
      }
      // if coin not matched, still accept first quantity-looking line
      if (!result.quantity || isNaN(result.quantity)) result.quantity = num;
    }
  }

  // 5) Fee (look for 'phí' or 'fee' or line with USDT and negative sign)
  for (const l of lines) {
    if (/ph[ií]|fee/i.test(l) && /USDT/i.test(l)) {
      const m = l.match(/([+\-]?[0-9.,]+)/);
      if (m) {
        const f = parseNumber(m[1]);
        if (!isNaN(f)) result.fee = Math.abs(f);
        break;
      }
    }
  }
  // fallback: any USDT number after fees line
  if (isNaN(result.fee)) {
    for (const l of lines) {
      if (/USDT/i.test(l) && /[+\-]?[0-9.,]+/.test(l)) {
        const m = l.match(/([+\-]?[0-9.,]+)/);
        if (m) {
          const f = parseNumber(m[1]);
          if (!isNaN(f)) {
            result.fee = Math.abs(f);
            break;
          }
        }
      }
    }
  }

  // 6) PnL: prefer line with 'pnl' or 'PnL'
  for (const l of lines) {
    if (/\bpnl\b/i.test(l)) {
      const m = l.match(/([+\-]?[0-9.,]+)/);
      if (m) {
        const p = parseNumber(m[1]);
        if (!isNaN(p)) {
          result.pnl = p;
          break;
        }
      }
    }
  }
  // fallback: first numeric USD-like value after fee
  if (isNaN(result.pnl)) {
    let feeIndex = -1;
    for (let i = 0; i < lines.length; i++) if (/ph[ií]|fee/i.test(lines[i])) { feeIndex = i; break; }
    if (feeIndex >= 0) {
      for (let i = feeIndex + 1; i < Math.min(lines.length, feeIndex + 6); i++) {
        const m = lines[i].match(/([+\-]?[0-9.,]+)/);
        if (m) {
          const p = parseNumber(m[1]);
          if (!isNaN(p)) { result.pnl = p; break; }
        }
      }
    }
  }

  // final sanity: set defaults if still missing
  if (!result.coin) result.coin = 'ETH';
  if (!result.openTime) result.openTime = new Date().toISOString();
  if (!result.closeTime) result.closeTime = result.openTime;
  if (isNaN(result.openPrice)) result.openPrice = 0;
  if (isNaN(result.closePrice)) result.closePrice = 0;
  if (isNaN(result.quantity)) result.quantity = 0;
  if (isNaN(result.fee)) result.fee = 0;
  if (isNaN(result.pnl)) result.pnl = 0;

  return result as Trade;
}