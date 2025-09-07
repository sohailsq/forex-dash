import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'
import type { Position, Trade, SymbolCode } from '../types'

type PortfolioState = {
  cash: number
  positions: Record<SymbolCode, Position | undefined>
  trades: Trade[]
}

const initialState: PortfolioState = {
  cash: 100000,
  positions: {
    EURUSD: undefined,
    GBPUSD: undefined,
    XAUUSD: undefined,
  },
  trades: [],
}

type OrderPayload = {
  symbol: SymbolCode
  qty: number // positive to buy, negative to sell
  price: number
}

const portfolio = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    placeOrder: {
      reducer(state, action: PayloadAction<{trade: Trade}>) {
        const trade = action.payload.trade
        const sign = trade.side === 'BUY' ? 1 : -1
        const cost = trade.price * trade.qty * sign

        state.cash -= cost

        const existing = state.positions[trade.symbol]
        const q = trade.qty * sign

        if (!existing) {
          state.positions[trade.symbol] = { symbol: trade.symbol, qty: q, avgPrice: trade.price }
        } else {
          const prevQty = existing.qty
          const newQty = prevQty + q

          if (newQty === 0) {
            state.positions[trade.symbol] = undefined
          } else if (Math.sign(prevQty) === Math.sign(newQty)) {
            const totalCost = existing.avgPrice * Math.abs(prevQty) + trade.price * Math.abs(q)
            existing.avgPrice = totalCost / (Math.abs(prevQty) + Math.abs(q))
            existing.qty = newQty
          } else {
            existing.qty = newQty
            if (Math.sign(newQty) !== Math.sign(prevQty)) {
              existing.avgPrice = trade.price
            }
          }
        }

        state.trades.unshift(trade)
      },
      prepare({ symbol, qty, price }: OrderPayload) {
        const side = qty >= 0 ? 'BUY' : 'SELL'
        return { payload: { trade: { id: nanoid(), symbol, qty: Math.abs(qty), price, ts: Math.floor(Date.now()/1000), side } as Trade } }
      }
    }
  }
})

export const { placeOrder } = portfolio.actions
export default portfolio.reducer
