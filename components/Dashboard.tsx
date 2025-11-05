import React from 'react';
import { HedgedPair } from '../types';
import OrderForm from './OrderForm';
import { calculateSlippage, calculateTotals, formatCurrency, formatNumber } from '../utils/helpers';

interface DashboardProps {
  pairs: HedgedPair[];
  onEdit: (pair: HedgedPair) => void;
  onDelete: (id: string) => void;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  editingPair: HedgedPair | null;
  onSave: (pair: HedgedPair) => void;
  currentEthPrice: number | null;
}

const Dashboard: React.FC<DashboardProps> = ({ pairs, onEdit, onDelete, isModalOpen, setIsModalOpen, editingPair, onSave, currentEthPrice }) => {
  const copyTextToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        console.info('Copied to clipboard');
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        console.info('Copied to clipboard (fallback)');
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyTradeToClipboard = (trade: any) => {
    const headers = [
      '开仓价格\nGiá mở lệnh',
      '平仓价格\nGiá đóng lệnh',
      '开仓时间\nThời gian mở lệnh',
      '平仓时间\nThời gian đóng lệnh',
      '仓位数量\nKhối lượng giao dịch',
      'COIN',
      '手续费\nPhí thủ tục',
      '平仓盈亏\nPosition PnL'
    ];

    // Format numbers with dot thousand separator and comma decimal (e.g. 3.852,42)
    const euroNumber = (n: number | null | undefined, digits = 2) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '';
      return new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
    };

    const euroCurrency = (n: number | null | undefined, digits = 2) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '';
      // format number with de-DE formatting then attach $ before without space
      const formatted = euroNumber(n, digits);
      // Return just the formatted number for clipboard copy (no currency symbol)
      return formatted;
    };

    const formatDateTime = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const pad = (n: number) => String(n).padStart(2, '0');
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const seconds = pad(d.getSeconds());
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    // Build values in the order you requested and as a single TSV line (no header)
    const values = [
      euroNumber(trade.openPrice),
      euroNumber(trade.closePrice),
      formatDateTime(trade.openTime),
      formatDateTime(trade.closeTime),
      // quantity with comma decimal
      euroNumber(trade.quantity, 2),
      trade.coin || '',
      euroCurrency(trade.fee),
      euroCurrency(trade.pnl),
    ];

    const tsvLine = values.join('\t');
    copyTextToClipboard(tsvLine);
  };

  const renderTradeRow = (trade: any, exchangeName: string) => (
    <>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <span>{exchangeName}</span>
          <button onClick={() => copyTradeToClipboard(trade)} title="Copy row to clipboard (TSV)" className="text-gray-400 hover:text-white">
            <i className="fas fa-copy"></i>
          </button>
        </div>
      </td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{formatCurrency(trade.openPrice)}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{formatCurrency(trade.closePrice)}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{trade.quantity}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{trade.coin}</td>
      <td className="p-3 text-sm text-gray-300 whitespace-nowrap">{formatCurrency(trade.fee)}</td>
      <td className={`p-3 text-sm font-bold whitespace-nowrap ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {formatCurrency(trade.pnl)}
      </td>
    </>
  );

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Hedge Positions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700/50">
              <tr>
                <th rowSpan={2} className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pair Details</th>
                <th colSpan={7} className="p-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">Trade Details</th>
                <th colSpan={4} className="p-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">Aggregates</th>
                 <th rowSpan={2} className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
              <tr>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">Exchange</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Open Price</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Close Price</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Qty</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Coin</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fee</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">PnL</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-l border-gray-600">Total PnL</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Fee</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Open Slip</th>
                <th className="p-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Close Slip</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {pairs.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-4 text-center text-gray-400">No hedge pairs found. Add one to get started.</td>
                </tr>
              )}
              {pairs.map((pair) => {
                const { openSlippage, closeSlippage } = calculateSlippage(pair);
                const { totalPnl, totalFee } = calculateTotals(pair);
                return (
                  <React.Fragment key={pair.id}>
                    <tr className="hover:bg-gray-700/50 transition-colors duration-200">
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 border-t-2 border-cyan-500">
                        <div><strong>Team:</strong> {pair.team}</div>
                        <div><strong>Date:</strong> {pair.date}</div>
                        {pair.note && <div className="text-xs text-gray-400 mt-1"><strong>Note:</strong> {pair.note}</div>}
                      </td>
                      {renderTradeRow(pair.tradeA, 'Aivora')}
                      <td rowSpan={2} className={`p-3 text-sm font-bold whitespace-nowrap border-l border-gray-600 border-t-2 border-cyan-500 ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(totalPnl)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-yellow-400 whitespace-nowrap border-t-2 border-cyan-500">{formatCurrency(totalFee)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 whitespace-nowrap border-t-2 border-cyan-500">{formatNumber(openSlippage, 2)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 whitespace-nowrap border-t-2 border-cyan-500">{formatNumber(closeSlippage, 2)}</td>
                      <td rowSpan={2} className="p-3 text-sm text-gray-300 whitespace-nowrap border-t-2 border-cyan-500">
                        <button onClick={() => onEdit(pair)} className="text-blue-400 hover:text-blue-300 mr-3"><i className="fas fa-edit"></i></button>
                        <button onClick={() => onDelete(pair.id)} className="text-red-400 hover:text-red-300"><i className="fas fa-trash"></i></button>
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-700/50 transition-colors duration-200">
                       {renderTradeRow(pair.tradeB, 'Bitunix')}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && <OrderForm pair={editingPair} onSave={onSave} onClose={() => setIsModalOpen(false)} currentEthPrice={currentEthPrice} />}
    </>
  );
};

export default Dashboard;