import { useState } from 'react'
import CreateOrderForm, { type OrderFormData } from './CreateOrderForm'
import { type Order } from './OrderItem'
import OrderList from './OrderList'
import OrderModal from './OrderModal'

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const handleCreateOrder = (data: OrderFormData) => {
    const newOrder: Order = {
      id: crypto.randomUUID(),
      ...data
    }
    setOrders(prev => [newOrder, ...prev])
  }

  const handleCommit = (order: Order) => {
    console.log('Commit to order:', order)
    setSelectedOrder(null)
  }

  return (
    <div style={{ display: 'flex', gap: '4rem', alignItems: 'flex-start', paddingTop: '2rem' }}>
      <div style={{ flex: 1 }}>
        <h2>Create Order</h2>
        <CreateOrderForm onSubmit={handleCreateOrder} />
      </div>

      <div style={{ flex: 2 }}>
        <h2>Active Orders</h2>
        <OrderList orders={orders} onSelect={setSelectedOrder} />
      </div>

      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onCommit={handleCommit} />
      )}
    </div>
  )
}

export default OrdersTab
