import { useState, useEffect } from 'react'
import { PriceFeed } from '../services/feed'

type Props = {
  feed: PriceFeed
}

export function ConnectionStatus({ feed }: Props) {
  const [status, setStatus] = useState(() => feed.getConnectionStatus())

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(feed.getConnectionStatus())
    }, 1000)

    return () => clearInterval(interval)
  }, [feed])

  const getStatusColor = () => {
    if (status.isConnected && status.usingWebSocket) return 'var(--pos)'
    if (status.usingWebSocket && !status.isConnected) return 'var(--neg)'
    return 'var(--muted)'
  }

  const getStatusText = () => {
    if (status.isConnected && status.usingWebSocket) return 'Live Data'
    if (status.usingWebSocket && !status.isConnected) return 'Connecting...'
    return 'Simulated'
  }

  const getStatusIcon = () => {
    if (status.isConnected && status.usingWebSocket) return '🟢'
    if (status.usingWebSocket && !status.isConnected) return '🟡'
    return '🔵'
  }

  return (
    <div className="connection-status">
      <span className="status-icon">{getStatusIcon()}</span>
      <span 
        className="status-text" 
        style={{ color: getStatusColor() }}
      >
        {getStatusText()}
      </span>
      {status.usingWebSocket && !status.isConnected && status.reconnectAttempts > 0 && (
        <span className="reconnect-info">
          (Attempt {status.reconnectAttempts})
        </span>
      )}
    </div>
  )
}
