import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { createChart, IChartApi, ISeriesApi, LineData, UTCTimestamp, CandlestickData, ColorType, AreaData, HistogramData } from 'lightweight-charts'
import type { SymbolCode, Tick, Candle } from '../types'
import { PriceFeed } from '../services/feed'
import { useDispatch } from 'react-redux'
import { setLastPrice } from '../store/marketSlice'

type Props = { 
  symbol: SymbolCode
  feed: PriceFeed
  isSelected?: boolean
  onSelect?: (symbol: SymbolCode, mode: Mode) => void
}
type Mode = 'line' | 'candles' | 'area' | 'histogram'

export const ChartPanel = memo(function ChartPanel({ symbol, feed, isSelected = false, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const areaRef = useRef<ISeriesApi<'Area'> | null>(null)
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [mode, setMode] = useState<Mode>('line')
  const [tooltip, setTooltip] = useState<{price: number, time: number, change?: number} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [priceChange, setPriceChange] = useState<number>(0)

  const dispatch = useDispatch()

  const workingCandle = useRef<Candle | null>(null)
  const priceHistory = useRef<number[]>([])
  const lastPrice = useRef<number>(0)

  // Chart theme based on current theme
  const chartTheme = useMemo(() => {
    const isDark = document.documentElement.dataset.theme === 'dark'
    return {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#e5e7eb' : '#0f172a',
      },
      grid: {
        vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
        horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
      },
      rightPriceScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textColor: isDark ? '#9ca3af' : '#6b7280',
      },
      timeScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textColor: isDark ? '#9ca3af' : '#6b7280',
        secondsVisible: true,
      },
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    
    const chart = createChart(containerRef.current, {
      height: 300,
      width: containerRef.current.clientWidth,
      ...chartTheme,
      crosshair: { 
        mode: 1,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: 2,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      rightPriceScale: {
        ...chartTheme.rightPriceScale,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    })
    chartRef.current = chart

    const line = chart.addLineSeries({ 
      priceLineVisible: true,
      priceLineColor: '#3b82f6',
      priceLineWidth: 1,
      priceLineStyle: 2,
      color: '#3b82f6',
      lineWidth: 2,
    })
    const candles = chart.addCandlestickSeries({ 
      priceLineVisible: true,
      priceLineColor: '#10b981',
      priceLineWidth: 1,
      priceLineStyle: 2,
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })
    const area = chart.addAreaSeries({
      priceLineVisible: true,
      priceLineColor: '#8b5cf6',
      priceLineWidth: 1,
      priceLineStyle: 2,
      lineColor: '#8b5cf6',
      topColor: 'rgba(139, 92, 246, 0.3)',
      bottomColor: 'rgba(139, 92, 246, 0.05)',
      lineWidth: 2,
    })
    const histogram = chart.addHistogramSeries({
      priceLineVisible: true,
      priceLineColor: '#f59e0b',
      priceLineWidth: 1,
      priceLineStyle: 2,
      color: '#f59e0b',
      priceFormat: {
        type: 'volume',
      },
    })
    lineRef.current = line
    candleRef.current = candles
    areaRef.current = area
    histogramRef.current = histogram

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)
    
    setIsLoading(false)
    
    return () => { 
      ro.disconnect()
      chart.remove() 
    }
  }, [chartTheme])

  // Enhanced tick processing with price change tracking
  const processTick = useCallback((tick: Tick) => {
    dispatch(setLastPrice({ symbol, price: tick.price }))
    const t = tick.ts as UTCTimestamp
    
    // Track price history for change calculation
    priceHistory.current.push(tick.price)
    if (priceHistory.current.length > 100) {
      priceHistory.current.shift()
    }
    
    const previousPrice = lastPrice.current
    lastPrice.current = tick.price
    setCurrentPrice(tick.price)
    
    // Calculate price change from first price in history
    if (priceHistory.current.length > 1) {
      setPriceChange(tick.price - priceHistory.current[0])
    }
    
    // Update line chart
    const ld: LineData = { time: t, value: tick.price }
    lineRef.current?.update(ld)

    // Update area chart
    const ad: AreaData = { time: t, value: tick.price }
    areaRef.current?.update(ad)

    // Update histogram chart (using price as volume for demonstration)
    const isUp = tick.price >= previousPrice
    const hd: HistogramData = { 
      time: t, 
      value: Math.abs(tick.price * 1000), 
      color: isUp ? '#10b981' : '#ef4444' 
    }
    histogramRef.current?.update(hd)

    // Update candlestick chart
    const wc = workingCandle.current
    if (!wc || wc.time !== t) {
      if (wc) {
        const cd: CandlestickData = { 
          time: wc.time as UTCTimestamp, 
          open: wc.open, 
          high: wc.high, 
          low: wc.low, 
          close: wc.close 
        }
        candleRef.current?.update(cd)
      }
      workingCandle.current = { 
        time: t, 
        open: tick.price, 
        high: tick.price, 
        low: tick.price, 
        close: tick.price 
      }
    } else {
      wc.high = Math.max(wc.high, tick.price)
      wc.low = Math.min(wc.low, tick.price)
      wc.close = tick.price
    }
  }, [symbol, feed, dispatch])

  useEffect(() => {
    const unsub = feed.subscribe(symbol, processTick)
    return () => { unsub() }
  }, [symbol, feed, processTick])

  useEffect(() => {
    // Hide all series first
    lineRef.current?.applyOptions({ visible: false })
    candleRef.current?.applyOptions({ visible: false })
    areaRef.current?.applyOptions({ visible: false })
    histogramRef.current?.applyOptions({ visible: false })
    
    // Show only the selected series
    switch (mode) {
      case 'line':
        lineRef.current?.applyOptions({ visible: true })
        break
      case 'candles':
        candleRef.current?.applyOptions({ visible: true })
        break
      case 'area':
        areaRef.current?.applyOptions({ visible: true })
        break
      case 'histogram':
        histogramRef.current?.applyOptions({ visible: true })
        break
    }
  }, [mode])

  // Enhanced tooltip with price change calculation
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const crosshairMoveHandler = (param: any) => {
      if (!param.point) {
        setTooltip(null)
        return
      }

      let series: ISeriesApi<any> | null = null
      switch (mode) {
        case 'line':
          series = lineRef.current
          break
        case 'candles':
          series = candleRef.current
          break
        case 'area':
          series = areaRef.current
          break
        case 'histogram':
          series = histogramRef.current
          break
      }
      
      if (!series) return

      const data = param.seriesData.get(series)
      if (!data) {
        setTooltip(null)
        return
      }

      let price: number
      if ('value' in data) {
        price = data.value as number
      } else if ('close' in data) {
        price = data.close as number
      } else {
        setTooltip(null)
        return
      }

      // Calculate price change
      const change = priceHistory.current.length > 1 
        ? price - priceHistory.current[0]
        : 0

      setTooltip({ 
        price, 
        time: (param.time as number) ?? 0,
        change
      })
    }

    chart.subscribeCrosshairMove(crosshairMoveHandler)
    return () => { chart.unsubscribeCrosshairMove(crosshairMoveHandler) }
  }, [mode])

const formatPrice = useCallback((price?: number) => {
  if (price === undefined || price === null || isNaN(price)) {
    return "—"; // fallback when no valid price
  }

  if (symbol === 'ETHUSDT') {
    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return price.toLocaleString(undefined, {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  });
}, [symbol]);


  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString()
  }, [])

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode)
    onSelect?.(symbol, newMode)
  }, [symbol, onSelect])

  const handlePanelClick = useCallback(() => {
    onSelect?.(symbol, mode)
  }, [symbol, mode, onSelect])

  return (
    <div className={`panel ${isSelected ? 'selected' : ''}`} onClick={handlePanelClick}>
      <div className="panel-head">
        <div className="symbol">{symbol}</div>
        <div className="modes">
          <button 
            className={mode === 'line' ? 'active' : ''} 
            onClick={() => handleModeChange('line')}
          >
            📈 Line
          </button>
          <button 
            className={mode === 'candles' ? 'active' : ''} 
            onClick={() => handleModeChange('candles')}
          >
            🕯️ Candles
          </button>
          <button 
            className={mode === 'area' ? 'active' : ''} 
            onClick={() => handleModeChange('area')}
          >
            📊 Area
          </button>
          <button 
            className={mode === 'histogram' ? 'active' : ''} 
            onClick={() => handleModeChange('histogram')}
          >
            📊 Histogram
          </button>
        </div>
      </div>
      
      <div className="chart-layout">
        <div className="chart-main">
          {isLoading && (
            <div className="chart-loading">
              <div className="loading-spinner"></div>
              <div>Loading chart...</div>
            </div>
          )}
          
          {/* Chart is rendered in this container */}
          <div ref={containerRef} className="chart-container" style={{ display: isLoading ? 'none' : 'block' }} />
          
          {/* Price overlay on chart */}
          {!isLoading && currentPrice > 0 && (
            <div className="chart-price-overlay">
              <div className="overlay-price">{formatPrice(currentPrice)}</div>
              <div className={`overlay-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)}
              </div>
            </div>
          )}
          
          {tooltip && (
            <div className="tooltip">
              <div className="tooltip-symbol">{symbol}</div>
              <div className="tooltip-price">{formatPrice(tooltip.price)}</div>
              {tooltip.change !== undefined && (
                <div className={`tooltip-change ${tooltip.change >= 0 ? 'positive' : 'negative'}`}>
                  {tooltip.change >= 0 ? '+' : ''}{formatPrice(tooltip.change)}
                </div>
              )}
              <div className="tooltip-time">{formatTime(tooltip.time)}</div>
            </div>
          )}
        </div>
        
        <div className="price-panel">
          <div className="price-header">
            <h4>Live Prices</h4>
            <div className="chart-location">
              {/* Comment showing where the graph is displayed */}
              <small>📍 Chart displayed in Dashboard tab</small>
            </div>
          </div>
          
          <div className="price-info">
            <div className="price-item">
              <span className="price-label">Current Price:</span>
              <span className="price-value current-price">{formatPrice(currentPrice)}</span>
            </div>
            
            <div className="price-item">
              <span className="price-label">Change:</span>
              <span className={`price-value ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)}
              </span>
            </div>
            
            <div className="price-item">
              <span className="price-label">Change %:</span>
              <span className={`price-value ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                {currentPrice > 0 ? ((priceChange / currentPrice) * 100).toFixed(2) : '0.00'}%
              </span>
            </div>
            
            <div className="price-item">
              <span className="price-label">High:</span>
              <span className="price-value">
                {priceHistory.current.length > 0 ? formatPrice(Math.max(...priceHistory.current)) : formatPrice(currentPrice)}
              </span>
            </div>
            
            <div className="price-item">
              <span className="price-label">Low:</span>
              <span className="price-value">
                {priceHistory.current.length > 0 ? formatPrice(Math.min(...priceHistory.current)) : formatPrice(currentPrice)}
              </span>
            </div>
            
            <div className="price-item">
              <span className="price-label">Chart Type:</span>
              <span className="price-value chart-type">
                {mode === 'line' && '📈 Line Chart'}
                {mode === 'candles' && '🕯️ Candlestick'}
                {mode === 'area' && '📊 Area Chart'}
                {mode === 'histogram' && '📊 Histogram'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

