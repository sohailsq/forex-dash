export type SymbolCode = 'EURUSD' | 'GBPUSD' | 'XAUUSD';

export type Tick = {
  symbol: SymbolCode;
  price: number;
  ts: number; // epoch seconds
};

export type Candle = {
  time: number; // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Position = {
  symbol: SymbolCode;
  qty: number;          // positive for long, negative for short
  avgPrice: number;     // average fill price
};

export type Trade = {
  id: string;
  symbol: SymbolCode;
  qty: number;
  price: number;
  ts: number;
  side: 'BUY' | 'SELL';
};
