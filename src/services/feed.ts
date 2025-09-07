import type { SymbolCode, Tick } from '../types'
import { STARTING_PRICES, TICK_MS } from '../constants'

type Subscriber = (tick: Tick) => void

const FINNHUB_KEY = ((import.meta as any).env?.VITE_FINNHUB_API_KEY) || "d1ehg3pr01qjssrk5gkgd1ehg3pr01qjssrk5gl0"

const mapToFinnhub: Record<SymbolCode, string> = {
  EURUSD: 'OANDA:EUR_USD',
  GBPUSD: 'OANDA:GBP_USD',
  XAUUSD: 'OANDA:XAU_USD',
}
const mapFromFinnhub: Record<string, SymbolCode> = {
  'OANDA:EUR_USD': 'EURUSD',
  'OANDA:GBP_USD': 'GBPUSD',
  'OANDA:XAU_USD': 'XAUUSD',
}

export class PriceFeed {
  private subs: Record<SymbolCode, Set<Subscriber>> = {
    EURUSD: new Set(),
    GBPUSD: new Set(),
    XAUUSD: new Set(),
  }
  private timer?: number
  private prices: Record<SymbolCode, number> = { ...STARTING_PRICES }
  private ws?: WebSocket
  private usingWs = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnected = false

  start() {
    if (FINNHUB_KEY && !this.ws) {
      try {
        this.initWs()
        this.usingWs = true
        return
      } catch (e) {
        console.warn('WebSocket initialization failed, falling back to simulation', e)
        this.startSim()
      }
    } else {
      this.startSim()
    }
  }

  private startSim() {
    if (this.timer) return
    this.timer = window.setInterval(() => {
      const ts = Math.floor(Date.now() / 1000)
      ;(Object.keys(this.subs) as SymbolCode[]).forEach(symbol => {
        const last = this.prices[symbol]
        const vol = symbol === 'XAUUSD' ? 0.004 : 0.0003
        const next = last * (1 + (Math.random() - 0.5) * vol)
        this.prices[symbol] = next
        const tick: Tick = { symbol, price: Number(next.toFixed(5)), ts }
        this.subs[symbol].forEach(cb => cb(tick))
      })
    }, TICK_MS)
  }

  private initWs() {
    const url = `wss://ws.finnhub.io?token=${FINNHUB_KEY}`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.addEventListener('open', () => {
      console.log('WebSocket connected to Finnhub')
      this.isConnected = true
      this.reconnectAttempts = 0
      
      // Subscribe to all symbols
      Object.values(mapToFinnhub).forEach(sym => {
        ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }))
        console.log(`Subscribed to ${sym}`)
      })
    })

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        
        if (msg.type === 'trade' && Array.isArray(msg.data)) {
          msg.data.forEach((d: any) => {
            const s = mapFromFinnhub[d.s]
            if (!s) return
            
            const tick: Tick = { 
              symbol: s, 
              price: Number(d.p), 
              ts: Math.floor(d.t / 1000) 
            }
            
            this.prices[s] = tick.price
            this.subs[s].forEach(cb => cb(tick))
          })
        } else if (msg.type === 'error') {
          console.error('WebSocket error:', msg.msg)
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    })

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error)
      this.isConnected = false
      this.handleReconnect()
    })

    ws.addEventListener('close', (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      this.isConnected = false
      this.cleanupWs()
      this.handleReconnect()
    })
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.initWs()
        }
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.warn('Max reconnection attempts reached, falling back to simulation')
      this.startSim()
    }
  }

  private cleanupWs() {
    if (this.ws) {
      try { 
        this.ws.close() 
      } catch (error) {
        console.error('Error closing WebSocket:', error)
      }
      this.ws = undefined
    }
    this.usingWs = false
    this.isConnected = false
  }

  // Public method to get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      usingWebSocket: this.usingWs,
      reconnectAttempts: this.reconnectAttempts
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    if (this.ws) {
      this.cleanupWs()
    }
  }

  subscribe(symbol: SymbolCode, cb: Subscriber) {
    this.subs[symbol].add(cb)
    cb({ symbol, price: this.prices[symbol], ts: Math.floor(Date.now()/1000) })
    return () => this.subs[symbol].delete(cb)
  }
}
