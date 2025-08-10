import OrderItem, { type UIOrder } from './OrderItem'

type Props = { orders: UIOrder[]; onSelect: (o: UIOrder) => void }

function OrderList({ orders, onSelect }: Props) {
  if (!orders.length) return <p>No active orders found.</p>
  return (
    <div>
      {orders.map((o) => (
        <OrderItem key={o.txid} order={o} onClick={() => onSelect(o)} />
      ))}
    </div>
  )
}

export default OrderList
