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

    // The Gemini response is the main payload, we just need to add a placeholder for UID
    return { ...parsedJson, uid: '' };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to parse trade data with Gemini. The text format might be incorrect or unsupported.");
  }
}