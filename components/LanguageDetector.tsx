import React, { useState } from 'react';
import { detectLanguage } from '../services/geminiService';

const LanguageDetector: React.FC = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ language: string; confidence: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetect = async () => {
    if (!text.trim()) {
      setError('Please enter some text to detect.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const detectionResult = await detectLanguage(text);
      setResult(detectionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 p-4 rounded-lg shadow-md border border-gray-700">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-grow min-w-[200px]">
          <label htmlFor="language-input" className="sr-only">Text to detect</label>
          <input
            id="language-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text for language detection..."
            className="w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-gray-400"
            disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && handleDetect()}
          />
        </div>
        <button
          onClick={handleDetect}
          disabled={isLoading || !text.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <><i className="fas fa-spinner fa-spin mr-2"></i>Detecting...</>
          ) : (
            <><i className="fas fa-language mr-2"></i>Detect Language</>
          )}
        </button>
        <div className="flex-grow text-center md:text-left">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {result && (
            <p className="text-gray-300">
              Detected Language: <span className="font-bold text-cyan-400">{result.language}</span> ({(result.confidence * 100).toFixed(1)}% confidence)
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LanguageDetector;
