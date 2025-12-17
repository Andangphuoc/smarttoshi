import React, { useState } from 'react';
import { Trade } from '../types';
import { parseTradeTextSmart } from '../services/tradeParser';

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
      // Use the smart parser which tries regex first, then Gemini
      const parsedTrade = await parseTradeTextSmart(text);
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
            <h3 className="text-2xl font-bold text-purple-400"><i className="fas fa-magic mr-2"></i>Smart AI Paste</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl" disabled={isLoading}>&times;</button>
        </div>
        
        <div className="bg-gray-800 p-3 rounded-md mb-4 border border-gray-700">
            <p className="text-gray-300 text-sm font-semibold mb-1">Supported Formats:</p>
            <ul className="text-xs text-gray-400 list-disc list-inside">
                <li><span className="text-cyan-400">Aivora</span> (Format A: "Opening Average Price"...)</li>
                <li><span className="text-cyan-400">Bitunix</span> (Format B: "Entry Price"...)</li>
                <li>Other formats will be analyzed by <span className="text-purple-400">Gemini AI</span>.</li>
            </ul>
        </div>

        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your trade text here..."
            className="w-full h-48 p-3 bg-gray-800 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none mb-4 font-mono text-xs"
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
                        <i className="fas fa-spinner fa-spin mr-2"></i>Processing...
                    </>
                ) : (
                    <>
                        <i className="fas fa-bolt mr-2"></i>Auto Parse
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default AIPasteModal;