
import React, { useState } from 'react';
import { Trade } from '../types';
import { parseTradeText } from '../services/geminiService';

interface AIPasteModalProps {
  onParseComplete: (trade: Trade) => void;
  onClose: () => void;
}

const AIPasteModal: React.FC<AIPasteModalProps> = ({ onParseComplete, onClose }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) {
      setError("Please paste the trade information first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let parsedTrade: Trade = await parseTradeText(text);

      // If the pasted text contains a 'Closing PnL' field, prefer it as the realized pnl.
      const lower = text.toLowerCase();
      const hasClosing = /closing\s*pnL|closingpnl|closing pnl/i.test(text);
      if (hasClosing) {
        // Check if parser returned a separate closing field
        const anyParsed: any = parsedTrade as any;
        const possibleKeys = ['closingPnl', 'closingPNL', 'closing_pnl', 'closing_pnl', 'closingPnL', 'closing_pnl'];
        let closingVal: any = undefined;
        for (const k of possibleKeys) {
          if (anyParsed[k] !== undefined && anyParsed[k] !== null) {
            closingVal = anyParsed[k];
            break;
          }
        }

        // If parser didn't return closing pnl, try to extract from raw text
        if (closingVal === undefined) {
          const m = text.match(/Closing\s*PnL\s*[:\-\s]*([+\-]?[0-9.,]+)/i);
          if (m && m[1]) closingVal = m[1];
        }

        if (closingVal !== undefined && closingVal !== null) {
          // normalize number string like +126.06000000 or 1,234.56
          const s = String(closingVal).trim();
          const normalized = s.replace(/[^0-9+\-.,]/g, '');
          // handle European style 1.234,56 -> 1234.56
          const hasComma = normalized.indexOf(',') !== -1;
          const hasDot = normalized.indexOf('.') !== -1;
          let num = 0;
          if (hasComma && !hasDot) {
            num = parseFloat(normalized.replace(/\./g, '').replace(/,/g, '.'));
          } else {
            num = parseFloat(normalized.replace(/,/g, ''));
          }
          if (!isNaN(num)) {
            parsedTrade = { ...parsedTrade, pnl: num } as Trade;
          }
        }
      }

      onParseComplete(parsedTrade);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-purple-400"><i className="fas fa-magic mr-2"></i>AI Paste & Create</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl" disabled={isLoading}>&times;</button>
        </div>
        
        <p className="text-gray-400 text-sm mb-4">
            Paste the completed trade details from your exchange below. The AI will extract the information and pre-fill the form for you.
        </p>

        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste trade details here..."
            className="w-full h-48 p-3 bg-gray-800 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none mb-4"
            disabled={isLoading}
        />

        {error && <p className="text-red-400 mb-4 text-sm bg-red-900/20 p-3 rounded-md">{error}</p>}

        <div className="flex justify-end space-x-4">
            <button 
                type="button" 
                onClick={onClose} 
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 disabled:opacity-50"
                disabled={isLoading}
            >
                Cancel
            </button>
            <button 
                type="button" 
                onClick={handleParse} 
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                disabled={isLoading || !text.trim()}
            >
                {isLoading ? (
                    <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>Parsing...
                    </>
                ) : (
                    <>
                        <i className="fas fa-cogs mr-2"></i>Parse Trade
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default AIPasteModal;
