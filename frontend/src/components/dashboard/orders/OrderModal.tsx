// modal with esc/backdrop close and emoji buttons
// txid is clickable and opens on whatsonchain

import { useEffect, useCallback } from 'react'
import type { UIOrder } from './OrderItem'

type Props = { order: UIOrder; onClose: () => void; onCommit: (o: UIOrder) => void }

// shared price text
function priceText(o: UIOrder): string {
  return o.currency === 'SATS' ? `${o.price} sats/kWh` : `£${o.price}/kWh`
}

function OrderModal({ order, onClose, onCommit }: Props) {
  // esc to close
  const esc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [esc])

  // stop click bubbling
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  // build woc link (mainnet)
  const wocHref = `https://whatsonchain.com/tx/${order.txid}`

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.4)',
        zIndex: 9999
      }}
    >
      <div
        onClick={stop}
        style={{
          background: '#fff',
          color: '#000',
          padding: '1.5rem 2rem',
          borderRadius: 12,
          width: 460,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
      >
        <h3 style={{ textAlign: 'center', margin: 0 }}>
          {order.type.toUpperCase()} – {order.quantity} kWh
        </h3>

        <div style={{ marginTop: 16, display: 'grid', rowGap: 6 }}>
          <p><strong>Price:</strong> {priceText(order)}</p>
          <p><strong>Expires:</strong> {new Date(order.expiryISO).toLocaleString()}</p>
          <p><strong>Overlay:</strong> {order.overlayLabel}</p>
          <p><strong>Created:</strong> {new Date(order.createdISO).toLocaleString()}</p>
          <p><strong>Topic:</strong> {order.topic}</p>
          <p style={{ wordBreak: 'break-all' }}><strong>Creator Key:</strong> {order.creatorKey || 'unknown'}</p>
          <p style={{ wordBreak: 'break-all', opacity: 0.9 }}>
            <strong>TXID:</strong>{' '}
            <a
              href={wocHref}
              target="_blank"
              rel="noopener noreferrer"
              title="open on whatsonchain.com"
              style={{ color: '#0b69ff', textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {order.txid}
            </a>
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
          <button onClick={() => onCommit(order)} style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}>
            🤝 Commit
          </button>
          <button onClick={onClose} style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}>
            ❌ Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderModal
