import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { SymbolCode } from '../types'

type MarketState = {
  lastPrice: Record<SymbolCode, number | undefined>
}

const initialState: MarketState = {
  lastPrice: {
    EURUSD: undefined,
    GBPUSD: undefined,
    ETHUSD: undefined,
  },
}

const market = createSlice({
  name: 'market',
  initialState,
  reducers: {
    setLastPrice(state, action: PayloadAction<{symbol: SymbolCode, price: number}>) {
      const { symbol, price } = action.payload
      state.lastPrice[symbol] = price
    }
  }
})

export const { setLastPrice } = market.actions
export default market.reducer
