// Simple card for one order. No changes needed elsewhere.
export type UIOrder = {
  txid: string
  type: 'offer' | 'demand' | 'commitment' | 'contract' | 'proof'
  quantity: number
  price: number
  currency: 'GBP' | 'SATS'
  expiryISO: string
  overlayLabel: string
  topic: string
  createdISO: string
  creatorKey: string
  parent: string | null
}

type Props = { order: UIOrder; onClick: () => void }

function OrderItem({ order, onClick }: Props) {
  const formatted = order.currency === 'SATS'
    ? `sats${order.price}/kWh`
    : `£${order.price}/kWh`

  return (
    <div
      onClick={onClick}
      style={{
        padding: '1rem',
        backgroundColor: '#333',
        borderRadius: 10,
        marginBottom: '1rem',
        cursor: 'pointer',
        color: '#f1f1f1'
      }}
    >
      <strong>{order.type.toUpperCase()} – {order.quantity} kWh @ {formatted}</strong>
      <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.85 }}>
        Expires: {new Date(order.expiryISO).toLocaleString()} | Overlay: {order.overlayLabel}
      </p>
    </div>
  )
}

export default OrderItem
