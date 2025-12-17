import React, { useState, useEffect, useRef } from 'react';

const formatCurrency = (value: number) => {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

interface EthPriceTickerProps {
  onPriceUpdate: (price: number) => void;
}

const EthPriceTicker: React.FC<EthPriceTickerProps> = ({ onPriceUpdate }) => {
  const [price, setPrice] = useState<string | null>(null);
  const [changeDirection, setChangeDirection] = useState<'up' | 'down' | 'none'>('none');
  const prevPriceRef = useRef<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const ws = new WebSocket('wss://ws.coincap.io/prices?assets=ethereum');

    ws.onopen = () => {
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.ethereum) {
          const newPriceStr = data.ethereum;
          const newPriceNum = parseFloat(newPriceStr);

          if (!isNaN(newPriceNum)) {
            onPriceUpdate(newPriceNum); // Lift the state up

            if (prevPriceRef.current !== null) {
              const currentNumeric = parseFloat(prevPriceRef.current);
              if (newPriceNum > currentNumeric) {
                setChangeDirection('up');
              } else if (newPriceNum < currentNumeric) {
                setChangeDirection('down');
              }
            }
            
            prevPriceRef.current = newPriceStr;
            setPrice(newPriceStr);
          }
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setConnectionStatus('disconnected');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    const intervalId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping'); // Keep connection alive if needed by server
        } else if (ws.readyState === WebSocket.CLOSED) {
            // Optional: try to reconnect
        }
    }, 30000);

    return () => {
      clearInterval(intervalId);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [onPriceUpdate]);

  const getStatusIndicator = () => {
    switch(connectionStatus) {
        case 'connected':
            return <span className="w-2 h-2 rounded-full bg-green-500" title="Connected"></span>;
        case 'connecting':
            return <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Connecting..."></span>;
        case 'disconnected':
            return <span className="w-2 h-2 rounded-full bg-red-500" title="Disconnected"></span>;
    }
  }

  const priceColor = changeDirection === 'up' ? 'text-green-400' : changeDirection === 'down' ? 'text-red-400' : 'text-gray-100';

  return (
    <div className="bg-gray-800 p-2 px-4 rounded-lg flex items-center space-x-3 shadow">
      <div className="flex items-center space-x-2">
        <i className="fab fa-ethereum text-cyan-400"></i>
        <span className="font-bold text-sm text-gray-300">ETH/USD</span>
        {getStatusIndicator()}
      </div>
      <div className={`text-lg font-mono font-bold transition-colors duration-300 ${priceColor}`}>
        {price ? (
          <>
            <span>{formatCurrency(parseFloat(price))}</span>
            {changeDirection === 'up' && <i className="fas fa-arrow-up ml-2 text-xs"></i>}
            {changeDirection === 'down' && <i className="fas fa-arrow-down ml-2 text-xs"></i>}
          </>
        ) : (
          <span>Loading...</span>
        )}
      </div>
    </div>
  );
};

export default EthPriceTicker;