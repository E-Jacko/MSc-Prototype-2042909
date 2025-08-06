import OrderItem from './OrderItem'
import type { Order } from './OrderItem'

type Props = {
  orders: Order[]
  onSelect: (order: Order) => void
}

function OrderList({ orders, onSelect }: Props) {
  if (orders.length === 0) {
    return <p>No active orders found.</p>
  }

  return (
    <div>
      {orders.map(order => (
        <OrderItem key={order.id} order={order} onClick={() => onSelect(order)} />
      ))}
    </div>
  )
}

export default OrderList
