import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { createChart, IChartApi, ISeriesApi, LineData, UTCTimestamp, CandlestickData, ColorType, AreaData, HistogramData, PriceScaleMode } from 'lightweight-charts'
import type { SymbolCode, Tick, Candle } from '../types'
import { PriceFeed } from '../services/feed'
import { useDispatch } from 'react-redux'
import { setLastPrice } from '../store/marketSlice'

type Props = { 
  symbol: SymbolCode
  feed: PriceFeed
  mode: 'line' | 'candles' | 'area' | 'histogram'
}

export const LargeChart = memo(function LargeChart({ symbol, feed, mode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const areaRef = useRef<ISeriesApi<'Area'> | null>(null)
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const bollingerUpperRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bollingerMiddleRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bollingerLowerRef = useRef<ISeriesApi<'Line'> | null>(null)
  const sma20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const sma50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const [tooltip, setTooltip] = useState<{price: number, time: number, change?: number} | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [showIndicators, setShowIndicators] = useState(true)

  const dispatch = useDispatch()

  const workingCandle = useRef<Candle | null>(null)
  const priceHistory = useRef<number[]>([])
  const candleHistory = useRef<Candle[]>([])

  // Helper functions for technical indicators
  const calculateSMA = useCallback((prices: number[], period: number): number => {
    if (prices.length < period) return 0
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0)
    return sum / period
  }, [])

  const calculateBollingerBands = useCallback((prices: number[], period: number = 20, stdDev: number = 2) => {
    if (prices.length < period) return { upper: 0, middle: 0, lower: 0 }
    
    const sma = calculateSMA(prices, period)
    const recentPrices = prices.slice(-period)
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period
    const standardDeviation = Math.sqrt(variance)
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    }
  }, [calculateSMA])

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
      height: 500,
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
        mode: PriceScaleMode.Normal,
      },
    })
    chartRef.current = chart

    // Main price series
    const line = chart.addLineSeries({ 
      priceLineVisible: false,
      color: '#3b82f6',
      lineWidth: 3,
    })
    const candles = chart.addCandlestickSeries({ 
      priceLineVisible: false,
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })
    const area = chart.addAreaSeries({
      priceLineVisible: false,
      lineColor: '#8b5cf6',
      topColor: 'rgba(139, 92, 246, 0.3)',
      bottomColor: 'rgba(139, 92, 246, 0.05)',
      lineWidth: 3,
    })
    const histogram = chart.addHistogramSeries({
      priceLineVisible: false,
      color: '#f59e0b',
      priceFormat: {
        type: 'volume',
      },
    })

    // Technical indicators
    const volume = chart.addHistogramSeries({
      priceLineVisible: false,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    })

    // Bollinger Bands
    const bollingerUpper = chart.addLineSeries({
      priceLineVisible: false,
      color: '#8b5cf6',
      lineWidth: 1,
      lineStyle: 2, // dashed
    })
    const bollingerMiddle = chart.addLineSeries({
      priceLineVisible: false,
      color: '#f59e0b',
      lineWidth: 1,
    })
    const bollingerLower = chart.addLineSeries({
      priceLineVisible: false,
      color: '#8b5cf6',
      lineWidth: 1,
      lineStyle: 2, // dashed
    })

    // Moving Averages
    const sma20 = chart.addLineSeries({
      priceLineVisible: false,
      color: '#10b981',
      lineWidth: 2,
    })
    const sma50 = chart.addLineSeries({
      priceLineVisible: false,
      color: '#ef4444',
      lineWidth: 2,
    })

    // Set up volume price scale
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    lineRef.current = line
    candleRef.current = candles
    areaRef.current = area
    histogramRef.current = histogram
    volumeRef.current = volume
    bollingerUpperRef.current = bollingerUpper
    bollingerMiddleRef.current = bollingerMiddle
    bollingerLowerRef.current = bollingerLower
    sma20Ref.current = sma20
    sma50Ref.current = sma50

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

  // Enhanced tick processing with price change tracking and technical indicators
  const processTick = useCallback((tick: Tick) => {
    dispatch(setLastPrice({ symbol, price: tick.price }))
    const t = tick.ts as UTCTimestamp
    
    // Track price history for change calculation
    priceHistory.current.push(tick.price)
    if (priceHistory.current.length > 100) {
      priceHistory.current.shift()
    }
    
    setCurrentPrice(tick.price)
    
    // Calculate price change from first price in history
    if (priceHistory.current.length > 1) {
      setPriceChange(tick.price - priceHistory.current[0])
    }
    
    // Update main price series
    const ld: LineData = { time: t, value: tick.price }
    lineRef.current?.update(ld)

    const ad: AreaData = { time: t, value: tick.price }
    areaRef.current?.update(ad)

    const hd: HistogramData = { time: t, value: Math.abs(tick.price * 1000), color: tick.price >= (priceHistory.current[priceHistory.current.length - 2] || tick.price) ? '#10b981' : '#ef4444' }
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
        candleHistory.current.push({
          time: wc.time,
          open: wc.open,
          high: wc.high,
          low: wc.low,
          close: wc.close
        })
        if (candleHistory.current.length > 100) {
          candleHistory.current.shift()
        }
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

    // Update volume (simulated volume based on price movement)
    const volumeValue = Math.abs(tick.price * 1000) + Math.random() * 10000
    const volumeData: HistogramData = { 
      time: t, 
      value: volumeValue, 
      color: tick.price >= (priceHistory.current[priceHistory.current.length - 2] || tick.price) ? '#10b981' : '#ef4444' 
    }
    volumeRef.current?.update(volumeData)

    // Update technical indicators if we have enough data
    if (priceHistory.current.length >= 20 && showIndicators) {
      // Bollinger Bands
      const bb = calculateBollingerBands(priceHistory.current, 20, 2)
      bollingerUpperRef.current?.update({ time: t, value: bb.upper })
      bollingerMiddleRef.current?.update({ time: t, value: bb.middle })
      bollingerLowerRef.current?.update({ time: t, value: bb.lower })

      // Moving Averages
      const sma20Value = calculateSMA(priceHistory.current, 20)
      const sma50Value = calculateSMA(priceHistory.current, 50)
      
      if (sma20Value > 0) {
        sma20Ref.current?.update({ time: t, value: sma20Value })
      }
      if (sma50Value > 0) {
        sma50Ref.current?.update({ time: t, value: sma50Value })
      }
    }
  }, [symbol, feed, dispatch, calculateSMA, calculateBollingerBands, showIndicators])

  useEffect(() => {
    const unsub = feed.subscribe(symbol, processTick)
    return () => { unsub() }
  }, [symbol, feed, processTick])

  useEffect(() => {
    // Hide all main series first
    lineRef.current?.applyOptions({ visible: false })
    candleRef.current?.applyOptions({ visible: false })
    areaRef.current?.applyOptions({ visible: false })
    histogramRef.current?.applyOptions({ visible: false })
    
    // Show only the selected main series
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

    // Always show volume and technical indicators
    volumeRef.current?.applyOptions({ visible: true })
    
    if (showIndicators) {
      bollingerUpperRef.current?.applyOptions({ visible: true })
      bollingerMiddleRef.current?.applyOptions({ visible: true })
      bollingerLowerRef.current?.applyOptions({ visible: true })
      sma20Ref.current?.applyOptions({ visible: true })
      sma50Ref.current?.applyOptions({ visible: true })
    } else {
      bollingerUpperRef.current?.applyOptions({ visible: false })
      bollingerMiddleRef.current?.applyOptions({ visible: false })
      bollingerLowerRef.current?.applyOptions({ visible: false })
      sma20Ref.current?.applyOptions({ visible: false })
      sma50Ref.current?.applyOptions({ visible: false })
    }
  }, [mode, showIndicators])

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

  const formatPrice = useCallback((price: number) => {
    if (symbol === 'ETHUSDT') {
      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }
    return price.toLocaleString(undefined, { 
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
    })
  }, [symbol])

  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString()
  }, [])

  const toggleIndicators = useCallback(() => {
    setShowIndicators(prev => !prev)
  }, [])

  return (
    <div className="large-chart-panel">
      <div className="large-chart-header">
        <div className="large-chart-symbol">{symbol}</div>
        <div className="large-chart-controls">
          <button 
            className={`indicators-toggle ${showIndicators ? 'active' : ''}`}
            onClick={toggleIndicators}
            title="Toggle Technical Indicators"
          >
            📊 Indicators
          </button>
        </div>
        <div className="large-chart-info">
          <span className="large-chart-price">{formatPrice(currentPrice)}</span>
          <span className={`large-chart-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
            {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)}
          </span>
        </div>
      </div>
      
      <div className="large-chart-container">
        {isLoading && (
          <div className="large-chart-loading">
            <div className="loading-spinner"></div>
            <div>Loading large chart...</div>
          </div>
        )}
        
        {/* Large chart is rendered in this container */}
        <div ref={containerRef} className="large-chart" style={{ display: isLoading ? 'none' : 'block' }} />
        
        {tooltip && (
          <div className="large-tooltip">
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
    </div>
  )
})
