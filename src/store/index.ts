import { configureStore } from '@reduxjs/toolkit'
import portfolio from './portfolioSlice'
import market from './marketSlice'

export const store = configureStore({
  reducer: {
    portfolio,
    market,
  },
  middleware: (getDefault) => getDefault(),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
