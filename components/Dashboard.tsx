import React from 'react';
import { HedgedPair, Trade } from '../types';
import OrderForm from './OrderForm';
import { calculateSlippage, calculateTotals, formatCurrency, formatNumber, formatTradeToClipboard } from '../utils/helpers';
import { translations, Language } from '../utils/translations';

interface DashboardProps {
  pairs: HedgedPair[];
  onEdit: (pair: HedgedPair) => void;
  onDelete: (id: string) => void;
  onQuickClose: (pair: HedgedPair) => void;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  editingPair: HedgedPair | null;
  onSave: (pair: HedgedPair) => void;
  currentEthPrice: number | null;
  lang: Language;
}

const Dashboard: React.FC<DashboardProps> = ({ pairs, onEdit, onDelete, onQuickClose, isModalOpen, setIsModalOpen, editingPair, onSave, currentEthPrice, lang }) => {
  const t = translations[lang];

  const handleCopyTrade = (trade: Trade) => {
    const text = formatTradeToClipboard(trade);
    navigator.clipboard.writeText(text).then(() => {
        // Optional: Could show a toast notification here
        alert("Trade details copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy: ", err);
    });
  };

  const renderTradeRow = (trade: Trade, exchangeName: string, isShort: boolean = false) => {
    const isOpen = !trade.closePrice && trade.closePrice !== 0;
    let unrealizedPnl: number | null = null;
    if (isOpen && currentEthPrice && trade.openPrice) {
        if (isShort) {
            unrealizedPnl = (trade.openPrice - currentEthPrice) * trade.quantity;
        } else {
            unrealizedPnl = (currentEthPrice - trade.openPrice) * trade.quantity;
        }
    }

    return (
    <>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap group relative">
          <div className="flex items-center space-x-2">
            <span>{exchangeName}</span>
            <button 
                onClick={() => handleCopyTrade(trade)} 
                className="text-gray-500 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Copy details"
            >
                <i className="fas fa-copy"></i>
            </button>
          </div>
      </td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{formatCurrency(trade.openPrice)}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{trade.closePrice ? formatCurrency(trade.closePrice) : <span className="text-gray-500">Open</span>}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{trade.quantity}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{trade.coin}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{formatCurrency(trade.fee)}</td>
      <td className={`p-3 text-sm font-bold whitespace-nowrap`}>
          {unrealizedPnl !== null ? (
              <span className={unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(unrealizedPnl)} ({t.unrealized})
              </span>
          ) : (
               <span className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                {formatCurrency(trade.pnl)}
              </span>
          )}
      </td>
    </>
  )};

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">{t.pairDetails}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700/50">
              <tr>
                <th rowSpan={2} className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.pairDetails}</th>
                <th colSpan={7} className="p-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">{t.tradeDetails}</th>
                <th colSpan={4} className="p-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">{t.aggregates}</th>
                 <th rowSpan={2} className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.actions}</th>
              </tr>
              <tr>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">{t.exchange}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.openPrice}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.closePrice}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.qty}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.coin}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.fee}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.pnl}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">{t.totalFee}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.totalFee}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.openSlip}</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{t.closeSlip}</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {pairs.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-4 text-center text-gray-400">No hedge pairs found. Add one to get started.</td>
                </tr>
              )}
              {pairs.map((pair) => {
                const isOpen = !pair.tradeA.closePrice || !pair.tradeB.closePrice;
                const { openSlippage, closeSlippage } = calculateSlippage(pair);
                const { totalFee } = calculateTotals(pair);

                let totalPnl;
                if(isOpen && currentEthPrice) {
                    const pnlA = (currentEthPrice - pair.tradeA.openPrice) * pair.tradeA.quantity;
                    const pnlB = (pair.tradeB.openPrice - currentEthPrice) * pair.tradeB.quantity;
                    totalPnl = pnlA + pnlB;
                } else {
                    totalPnl = (pair.tradeA.pnl || 0) + (pair.tradeB.pnl || 0);
                }

                return (
                  <React.Fragment key={pair.id}>
                    <tr className={`transition-colors duration-200 group ${isOpen ? 'bg-gray-700/40' : 'hover:bg-gray-700/50'}`}>
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 border-t-2 border-cyan-500">
                         <div className="flex items-center gap-2">
                          {isOpen && <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" title="Position is open"></span>}
                          <strong>{t.team}:</strong> {pair.team}
                        </div>
                        <div><strong>{t.date}:</strong> {pair.date}</div>
                        {pair.note && <div className="text-xs text-gray-400 mt-1"><strong>{t.note}:</strong> {pair.note}</div>}
                      </td>
                      {renderTradeRow(pair.tradeA, t.exchangeA)}
                      <td rowSpan={2} className={`p-3 text-sm font-bold whitespace-nowrap border-l border-gray-600 border-t-2 border-cyan-500 ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(totalPnl)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-yellow-400 whitespace-nowrap border-t-2 border-cyan-500">{formatCurrency(totalFee)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 whitespace-nowrap border-t-2 border-cyan-500">{formatNumber(openSlippage, 2)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 whitespace-nowrap border-t-2 border-cyan-500">{formatNumber(closeSlippage, 2)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 whitespace-nowrap border-t-2 border-cyan-500">
                        {isOpen && <button onClick={() => onQuickClose(pair)} className="text-yellow-400 hover:text-yellow-300 mr-3" title={t.quickClose}><i className="fas fa-bolt"></i></button>}
                        <button onClick={() => onEdit(pair)} className="text-blue-400 hover:text-blue-300 mr-3" title={t.edit}><i className="fas fa-edit"></i></button>
                        <button onClick={() => onDelete(pair.id)} className="text-red-400 hover:text-red-300" title={t.delete}><i className="fas fa-trash"></i></button>
                      </td>
                    </tr>
                    <tr className={`transition-colors duration-200 group ${isOpen ? 'bg-gray-700/40' : 'hover:bg-gray-700/50'}`}>
                       {renderTradeRow(pair.tradeB, t.exchangeB, true)}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && <OrderForm pair={editingPair} onSave={onSave} onClose={() => setIsModalOpen(false)} currentEthPrice={currentEthPrice} lang={lang} />}
    </>
  );
};

export default Dashboard;