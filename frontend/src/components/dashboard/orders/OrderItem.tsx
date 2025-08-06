export type Order = {
    id: string
    type: 'offer' | 'demand'
    quantity: number
    price: number
    currency: 'GBP' | 'SATS'
    expiryDate: string
    overlay: string
  }
  
  type Props = {
    order: Order
    onClick: () => void
  }
  
  function OrderItem({ order, onClick }: Props) {
    const formattedPrice = order.currency === 'SATS'
      ? `sats${order.price}/kWh`
      : `£${order.price}/kWh`
  
    return (
      <div
        onClick={onClick}
        style={{
          padding: '1rem',
          backgroundColor: '#333',
          borderRadius: '8px',
          marginBottom: '1rem',
          cursor: 'pointer',
          color: '#f1f1f1'
        }}
      >
        <strong>{order.type.toUpperCase()} – {order.quantity} kWh @ {formattedPrice}</strong>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Expires: {order.expiryDate} | Overlay: {order.overlay}
        </p>
      </div>
    )
  }
  
  export default OrderItem
  