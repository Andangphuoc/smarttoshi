import React, { useState, useEffect, useMemo } from 'react';
import { HedgedPair, Trade, TradeKey } from '../types';
import AIPasteModal from './AIPasteModal';
import { calculateLiquidationInfo, formatCurrency } from '../utils/helpers';

interface OrderFormProps {
  pair: HedgedPair | null;
  onSave: (pair: HedgedPair) => void;
  onClose: () => void;
  currentEthPrice: number | null;
}

const emptyTrade: Trade = {
  uid: '', openPrice: 0, closePrice: 0, openTime: '', closeTime: '', quantity: 0, coin: 'ETH', fee: 0, pnl: 0, leverage: 100,
};

const emptyPair: HedgedPair = {
  id: '', date: new Date().toISOString().split('T')[0], team: '', tradeA: { ...emptyTrade }, tradeB: { ...emptyTrade }, note: '',
};

const OrderForm: React.FC<OrderFormProps> = ({ pair, onSave, onClose, currentEthPrice }) => {
  const [formData, setFormData] = useState<HedgedPair>(emptyPair);
  const [isAIPasteModalOpen, setIsAIPasteModalOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<TradeKey | null>(null);
  
  const [balanceA, setBalanceA] = useState(1000);
  const [balanceB, setBalanceB] = useState(1000);

  useEffect(() => {
    if (pair) {
      setFormData(pair);
    } else {
      setFormData(emptyPair);
    }
  }, [pair]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTradeChange = (tradeKey: TradeKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [tradeKey]: {
        ...prev[tradeKey],
        [name]: type === 'number' ? parseFloat(value) : value,
      },
    }));
  };
  
  const handleSetCurrentPrice = (tradeKey: TradeKey) => {
    if (currentEthPrice) {
      setFormData(prev => ({
        ...prev,
        [tradeKey]: {
          ...prev[tradeKey],
          openPrice: currentEthPrice,
        },
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const handleOpenAIPaste = (target: TradeKey) => {
    setAiTarget(target);
    setIsAIPasteModalOpen(true);
  };

  const handleAiParseComplete = (parsedTrade: Omit<Trade, 'uid' | 'leverage'>) => {
    if (aiTarget) {
        setFormData(prev => ({
            ...prev,
            [aiTarget]: {
                ...prev[aiTarget],
                ...parsedTrade,
            }
        }));
    }
    setIsAIPasteModalOpen(false);
    setAiTarget(null);
  };

  const liquidationA = useMemo(() => calculateLiquidationInfo(balanceA, formData.tradeA.openPrice, formData.tradeA.quantity, formData.tradeA.leverage), [balanceA, formData.tradeA]);
  const liquidationB = useMemo(() => calculateLiquidationInfo(balanceB, formData.tradeB.openPrice, formData.tradeB.quantity, formData.tradeB.leverage), [balanceB, formData.tradeB]);

  const renderLiquidationInfo = (info: ReturnType<typeof calculateLiquidationInfo>) => {
    if (!info.longLiq && !info.shortLiq) return null;
    return (
      <div className="mt-4 p-3 bg-gray-900/50 rounded-lg text-xs space-y-2">
         <div className="flex justify-between">
            <span className="text-gray-400">Est. Liq. Price (Long):</span>
            <span className="font-mono text-white">{info.longLiq ? formatCurrency(info.longLiq) : 'N/A'}</span>
         </div>
         <div className="flex justify-between">
            <span className="text-gray-400">Est. Liq. Price (Short):</span>
            <span className="font-mono text-white">{info.shortLiq ? formatCurrency(info.shortLiq) : 'N/A'}</span>
         </div>
      <div className="flex justify-between items-center pt-2 border-t border-gray-700">
        <span className="text-gray-400">Buffer to Liquidation (price points):</span>
        {info.isSafe ? (
          <span className="font-bold text-green-400 flex items-center"><i className="fas fa-check-circle mr-1"></i> {info.buffer?.toFixed(0)}</span>
        ) : (
          <span className="font-bold text-red-400 flex items-center"><i className="fas fa-exclamation-triangle mr-1"></i> {info.buffer?.toFixed(0)}</span>
        )}
      </div>
      </div>
    );
  };

  const renderTradeInputs = (tradeKey: TradeKey, title: string, balance: number, setBalance: (val: number) => void, liqInfo: ReturnType<typeof calculateLiquidationInfo>) => (
    <div className="bg-gray-800 p-4 rounded-lg flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold text-cyan-400">{title}</h4>
        <button
          type="button"
          onClick={() => handleOpenAIPaste(tradeKey)}
          className="bg-purple-600/50 hover:bg-purple-600 text-white font-bold py-1 px-3 text-xs rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
          title={`Paste trade data for ${title}`}
        >
          <i className="fas fa-magic mr-2"></i>AI Paste
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <input type="number" step="any" value={balance} onChange={(e) => setBalance(parseFloat(e.target.value) || 0)} placeholder="Account Balance" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
            <input type="number" step="any" name="leverage" value={formData[tradeKey].leverage} onChange={(e) => handleTradeChange(tradeKey, e)} placeholder="Leverage" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
        </div>
        <input type="text" name="coin" value={formData[tradeKey].coin} onChange={(e) => handleTradeChange(tradeKey, e)} placeholder="Coin (e.g., ETH)" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
        <input type="number" step="any" name="quantity" value={formData[tradeKey].quantity} onChange={(e) => handleTradeChange(tradeKey, e)} placeholder="Quantity" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
         <div className="relative">
            <input type="number" step="any" name="openPrice" value={formData[tradeKey].openPrice} onChange={(e) => handleTradeChange(tradeKey, e)} placeholder="Open Price" className="bg-gray-700 p-2 rounded-md w-full focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
            <button type="button" onClick={() => handleSetCurrentPrice(tradeKey)} title="Get current market price" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 disabled:opacity-50" disabled={!currentEthPrice}><i className="fas fa-sync-alt"></i></button>
        </div>
        <input type="datetime-local" name="openTime" value={formData[tradeKey].openTime} onChange={(e) => handleTradeChange(tradeKey, e)} className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
        <input type="number" step="any" name="closePrice" value={formData[tradeKey].closePrice} onChange={(e) => handleTradeChange(tradeKey, e)} placeholder="Close Price" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
        <input type="datetime-local" name="closeTime" value={formData[tradeKey].closeTime} onChange={(e) => handleTradeChange(tradeKey, e)} className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
        <input type="number" step="any" name="fee" value={formData[tradeKey].fee} onChange={(e) => handleTradeChange(tradeKey, e)} placeholder="Fee" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
        <input type="number" step="any" name="pnl" value={formData[tradeKey].pnl} onChange={(e) => handleTradeChange(tradeKey, e)} placeholder="Position PnL" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
      </div>
      {renderLiquidationInfo(liqInfo)}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg shadow-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">{pair ? 'Edit' : 'Add'} Hedge Pair</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold mb-3 text-cyan-400">Pair Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="date" name="date" value={formData.date} onChange={handleChange} className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                      <input type="text" name="team" value={formData.team} onChange={handleChange} placeholder="Team / Trader Name" className="bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
                  </div>
                  <textarea name="note" value={formData.note || ''} onChange={handleChange} placeholder="Note (optional)" rows={2} className="mt-4 w-full bg-gray-700 p-2 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none"></textarea>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {renderTradeInputs('tradeA', 'Exchange A: Aivora', balanceA, setBalanceA, liquidationA)}
                  {renderTradeInputs('tradeB', 'Exchange B: Bitunix', balanceB, setBalanceB, liquidationB)}
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                  <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300">Cancel</button>
                  <button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300">Save Pair</button>
              </div>
          </form>
        </div>
      </div>
      {isAIPasteModalOpen && (
        <AIPasteModal 
          onParseComplete={handleAiParseComplete}
          onClose={() => setIsAIPasteModalOpen(false)} 
        />
      )}
    </>
  );
};

export default OrderForm;