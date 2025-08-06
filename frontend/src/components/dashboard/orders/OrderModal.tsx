import type { Order } from './OrderItem'

type Props = {
  order: Order
  onClose: () => void
  onCommit: (order: Order) => void
}

function OrderModal({ order, onClose, onCommit }: Props) {
  const formattedPrice = order.currency === 'SATS'
    ? `sats${order.price}/kWh`
    : `£${order.price}/kWh`

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#fff',
      color: '#000',
      padding: '2rem',
      borderRadius: '10px',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      zIndex: 9999
    }}>
      <h3>{order.type.toUpperCase()} – {order.quantity} kWh</h3>
      <p><strong>Price:</strong> {formattedPrice}</p>
      <p><strong>Expires:</strong> {order.expiryDate}</p>
      <p><strong>Overlay:</strong> {order.overlay}</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
        <button onClick={() => onCommit(order)} style={{ backgroundColor: 'black', color: 'white', padding: '0.5rem 1rem' }}>
          🤝 Commit
        </button>
        <button onClick={onClose} style={{ backgroundColor: 'black', color: 'white', padding: '0.5rem 1rem' }}>
          ❌ Close
        </button>
      </div>
    </div>
  )
}

export default OrderModal
