import type { SymbolCode } from './types';

export const SYMBOLS: SymbolCode[] = ['EURUSD', 'GBPUSD', 'ETHUSDT'];
export const STARTING_PRICES: Record<SymbolCode, number> = {
  EURUSD: 1.0850,
  GBPUSD: 1.2700,
  ETHUSDT: 3200.0
};

export const TICK_MS = 500; // update interval
