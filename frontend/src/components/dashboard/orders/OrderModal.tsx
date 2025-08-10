import type { UIOrder } from './OrderItem'

type Props = { order: UIOrder; onClose: () => void; onCommit: (o: UIOrder) => void }

function OrderModal({ order, onClose, onCommit }: Props) {
  const priceText = order.currency === 'SATS' ? `sats${order.price}/kWh` : `£${order.price}/kWh`
  const shortKey = order.creatorKey
    ? `${order.creatorKey.slice(0, 6)}…${order.creatorKey.slice(-6)}`
    : '—'

  return (
    <div
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
          <p><strong>Price:</strong> {priceText}</p>
          <p><strong>Expires:</strong> {new Date(order.expiryISO).toLocaleString()}</p>
          <p><strong>Overlay:</strong> {order.overlayLabel}</p>
          <p><strong>Created:</strong> {new Date(order.createdISO).toLocaleString()}</p>
          <p><strong>Topic:</strong> {order.topic}</p>
          <p><strong>Creator Key:</strong> {shortKey}</p>
          <p><strong>Parent:</strong> {order.parent ?? 'null'}</p>
          <p style={{ wordBreak: 'break-all', opacity: 0.8 }}>
            <strong>TXID:</strong> {order.txid}
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
