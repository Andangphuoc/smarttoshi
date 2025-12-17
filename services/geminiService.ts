import { GoogleGenAI, Type } from "@google/genai";
import { Trade } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const tradeSchema = {
  type: Type.OBJECT,
  properties: {
    openPrice: { type: Type.NUMBER, description: 'The opening/entry price.' },
    closePrice: { type: Type.NUMBER, description: 'The closing price.' },
    openTime: { type: Type.STRING, description: 'The opening time in YYYY-MM-DDTHH:mm:ss ISO 8601 format.' },
    closeTime: { type: Type.STRING, description: 'The closing time in YYYY-MM-DDTHH:mm:ss ISO 8601 format.' },
    quantity: { type: Type.NUMBER, description: 'The position size or closed quantity.' },
    coin: { type: Type.STRING, description: 'The cryptocurrency symbol (e.g., ETH, BTC).' },
    fee: { type: Type.NUMBER, description: 'The trading fee amount, as an absolute positive number.' },
    pnl: { type: Type.NUMBER, description: 'The Position PnL.' },
  },
  required: ['openPrice', 'closePrice', 'openTime', 'closeTime', 'quantity', 'coin', 'fee', 'pnl'],
};

const languageSchema = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING, description: 'The detected language name (e.g., "English", "Vietnamese").' },
    confidence: { type: Type.NUMBER, description: 'The confidence score from 0.0 to 1.0.' },
  },
  required: ['language', 'confidence'],
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

Here is the text to parse:
"${text}"`;

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

export async function detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
  if (!API_KEY) {
    throw new Error("Gemini API key not configured.");
  }

  try {
     const prompt = `Analyze the following text and determine its primary language. Provide the language name and a confidence score. Text: "${text}"`;
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: languageSchema,
        },
     });

     return JSON.parse(response.text);

  } catch (error) {
    console.error("Error calling Gemini API for language detection:", error);
    throw new Error("Failed to detect language with Gemini.");
  }
}
