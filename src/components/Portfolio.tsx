import { useSelector, useDispatch } from 'react-redux'
import type { RootState } from '../store'
import { placeOrder } from '../store/portfolioSlice'
import type { SymbolCode } from '../types'
import { useState, useMemo, useCallback, memo } from 'react'

const fmt = (n?: number) => (n === undefined ? '-' : n.toLocaleString(undefined, { maximumFractionDigits: 5 }))

function rowPnl(qty: number, avg: number, last?: number) {
  if (last === undefined) return 0
  return (last - avg) * qty
}

function calculateTotalPnl(positions: Record<SymbolCode, any>, lastPrices: Record<SymbolCode, number | undefined>) {
  return Object.entries(positions).reduce((total, [symbol, position]) => {
    if (!position) return total
    const lastPrice = lastPrices[symbol as SymbolCode]
    if (lastPrice === undefined) return total
    return total + rowPnl(position.qty, position.avgPrice, lastPrice)
  }, 0)
}

export const Portfolio = memo(function Portfolio() {
  const { cash, positions, trades } = useSelector((s: RootState) => s.portfolio)
  const last = useSelector((s: RootState) => s.market.lastPrice)
  const dispatch = useDispatch()
  const [form, setForm] = useState<{symbol: SymbolCode, qty: number}>({symbol: 'EURUSD', qty: 1000})

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const totalPnl = calculateTotalPnl(positions, last)
    const totalValue = (['EURUSD','GBPUSD','XAUUSD'] as SymbolCode[]).reduce((acc, sym) => {
      const p = positions[sym]
      return acc + (p ? p.qty * (last[sym] ?? 0) : 0)
    }, 0)
    
    const equity = cash + totalValue
    const dayChange = totalPnl
    const dayChangePercent = equity > 0 ? (dayChange / equity) * 100 : 0
    
    return {
      equity,
      totalPnl,
      dayChange,
      dayChangePercent,
      totalValue
    }
  }, [cash, positions, last])

  const handleTrade = useCallback((side: 'BUY' | 'SELL') => {
    const qty = side === 'BUY' ? Math.abs(form.qty) : -Math.abs(form.qty)
    const price = last[form.symbol] ?? 0
    
    if (price > 0) {
      dispatch(placeOrder({ symbol: form.symbol, qty, price }))
    }
  }, [form.symbol, form.qty, last, dispatch])

  const handleFormChange = useCallback((field: 'symbol' | 'qty', value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // Memoize symbols array to prevent unnecessary re-renders
  const symbols = useMemo(() => ['EURUSD', 'GBPUSD', 'XAUUSD'] as SymbolCode[], [])

  // Memoize recent trades to prevent unnecessary re-renders
  const recentTrades = useMemo(() => trades.slice(0, 20), [trades])

  return (
    <div className="portfolio">
      <h3>Portfolio</h3>
      
      {/* Portfolio Summary Cards */}
      <div className="portfolio-summary">
        <div className="summary-card">
          <div className="summary-label">Total Equity</div>
          <div className="summary-value">{fmt(portfolioMetrics.equity)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Available Cash</div>
          <div className="summary-value">{fmt(cash)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Unrealized P&L</div>
          <div className={`summary-value ${portfolioMetrics.totalPnl >= 0 ? 'positive' : 'negative'}`}>
            {fmt(portfolioMetrics.totalPnl)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Day Change</div>
          <div className={`summary-value ${portfolioMetrics.dayChange >= 0 ? 'positive' : 'negative'}`}>
            {fmt(portfolioMetrics.dayChange)} ({portfolioMetrics.dayChangePercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      <h4>📊 Current Positions</h4>
      <div className="positions-table-container">
        <table className="positions-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Quantity</th>
              <th>Avg Price</th>
              <th>Last Price</th>
              <th>Market Value</th>
              <th>Unrealized P&L</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map(sym => {
              const p = positions[sym]
              const pnl = p ? rowPnl(p.qty, p.avgPrice, last[sym]) : 0
              const marketValue = p ? p.qty * (last[sym] ?? 0) : 0
              const hasPosition = p && p.qty !== 0
              
              return (
                <tr key={sym} className={hasPosition ? 'has-position' : 'no-position'}>
                  <td>
                    <span className="symbol-badge">{sym}</span>
                  </td>
                  <td className={p?.qty && p.qty > 0 ? 'long' : p?.qty && p.qty < 0 ? 'short' : ''}>
                    {p?.qty ?? 0}
                  </td>
                  <td>{fmt(p?.avgPrice)}</td>
                  <td>{fmt(last[sym])}</td>
                  <td>{fmt(marketValue)}</td>
                  <td className={pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>
                    {fmt(pnl)}
                    {pnl !== 0 && (
                      <span className="pnl-percent">
                        ({((pnl / (p?.avgPrice || 1)) * 100).toFixed(2)}%)
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h4>🎯 Trade Simulator</h4>
      <div className="trade-form">
        <label>
          Symbol
          <select 
            value={form.symbol} 
            onChange={e => handleFormChange('symbol', e.target.value as SymbolCode)}
          >
            {symbols.map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input 
            type="number" 
            value={form.qty} 
            onChange={e => handleFormChange('qty', Number(e.target.value))}
            min="1"
            step="1"
          />
        </label>
        <div className="actions">
          <button 
            className="buy-button"
            onClick={() => handleTrade('BUY')}
            disabled={!last[form.symbol]}
          >
            📈 Buy
          </button>
          <button 
            className="sell-button"
            onClick={() => handleTrade('SELL')}
            disabled={!last[form.symbol]}
          >
            📉 Sell
          </button>
        </div>
      </div>
      
      {last[form.symbol] && (
        <div className="trade-info">
          <div className="current-price">
            Current {form.symbol} Price: <strong>{fmt(last[form.symbol])}</strong>
          </div>
          <div className="trade-value">
            Trade Value: <strong>{fmt(Math.abs(form.qty) * (last[form.symbol] ?? 0))}</strong>
          </div>
        </div>
      )}

      <h4>📋 Recent Trades</h4>
      <div className="trades-table-container">
        <table className="trades-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Side</th>
              <th>Symbol</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {recentTrades.map(t => (
              <tr key={t.id} className={`trade-${t.side.toLowerCase()}`}>
                <td>{new Date(t.ts * 1000).toLocaleTimeString()}</td>
                <td>
                  <span className={`side-badge ${t.side.toLowerCase()}`}>
                    {t.side === 'BUY' ? '📈' : '📉'} {t.side}
                  </span>
                </td>
                <td>
                  <span className="symbol-badge">{t.symbol}</span>
                </td>
                <td>{t.qty}</td>
                <td>{fmt(t.price)}</td>
                <td>{fmt(t.qty * t.price)}</td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={6} className="no-trades">
                  No trades yet. Start trading to see your history here!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
})
