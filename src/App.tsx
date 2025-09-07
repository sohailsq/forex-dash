import { useEffect, useMemo, memo, useState, useCallback } from 'react'
import { ChartPanel } from './components/ChartPanel'
import { LargeChart } from './components/LargeChart'
import { Portfolio } from './components/Portfolio'
import { ThemeToggle } from './components/ThemeToggle'
import { ConnectionStatus } from './components/ConnectionStatus'
import { Tabs } from './components/Tabs'
import { PriceFeed } from './services/feed'
import type { SymbolCode } from './types'

type ChartMode = 'line' | 'candles' | 'area' | 'histogram'

const App = memo(function App() {
  const feed = useMemo(() => new PriceFeed(), [])
  useEffect(() => { feed.start(); return () => feed.stop() }, [feed])
  
  const [selectedChart, setSelectedChart] = useState<{symbol: SymbolCode, mode: ChartMode}>({
    symbol: 'EURUSD',
    mode: 'line'
  })

  const handleChartSelect = useCallback((symbol: SymbolCode, mode: ChartMode) => {
    setSelectedChart({ symbol, mode })
  }, [])

  const tabs = useMemo(() => [
    {
      id: 'dashboard',
      label: 'Dashboard',
     
      content: (
        <div className="dashboard-container">
          {/* Three main charts displayed prominently */}
          <div className="three-charts-grid">
            <div className="chart-wrapper">
              <h3 className="chart-title">EUR/USD</h3>
              <ChartPanel 
                symbol="EURUSD" 
                feed={feed} 
                isSelected={selectedChart.symbol === 'EURUSD'}
                onSelect={handleChartSelect}
              />
            </div>
            <div className="chart-wrapper">
              <h3 className="chart-title">GBP/USD</h3>
              <ChartPanel 
                symbol="GBPUSD" 
                feed={feed} 
                isSelected={selectedChart.symbol === 'GBPUSD'}
                onSelect={handleChartSelect}
              />
            </div>
            <div className="chart-wrapper">
              <h3 className="chart-title">XAU/USD (Gold)</h3>
              <ChartPanel 
                symbol="XAUUSD" 
                feed={feed} 
                isSelected={selectedChart.symbol === 'XAUUSD'}
                onSelect={handleChartSelect}
              />
            </div>
          </div>
          
          {/* Large chart displays the selected chart below the 3 main charts */}
          <div className="large-chart-section">
            <h3 className="section-title">Detailed View - {selectedChart.symbol}</h3>
            <LargeChart 
              symbol={selectedChart.symbol}
              feed={feed}
              mode={selectedChart.mode}
            />
          </div>
        </div>
      )
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      
      content: <Portfolio />
    }
  ], [feed, selectedChart, handleChartSelect])

  return (
    <div className="app">
      <header>
        <h1>📈 Forex Dashboard</h1>
        <div className="header-controls">
          <ConnectionStatus feed={feed} />
          <ThemeToggle />
        </div>
      </header>

      <main>
        <Tabs tabs={tabs} defaultTab="dashboard" />
      </main>
    </div>
  )
})

export default App
